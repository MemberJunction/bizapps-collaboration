/**
 * CX-13 Server Integration: MJ Docs (`MJ: Artifacts` Markdown Document + `MJ: Artifact Versions`
 * + `SpaceItem`) across Team and Shared bands in subtyped spaces.
 *
 * - Registers `CollaborationSpaceItemArtifactPermissionDelegate` (`BaseArtifactPermissionDelegate`)
 *   for `'MJ_BizApps_Collaboration: Space Items'` so MJ's `ArtifactPermissionEngine` honors Team vs.
 *   Shared band isolation (`Team` sees `Team` + `Shared`; `Shared` sees ONLY `Shared`).
 * - Provides fail-closed CRUD + promotion operations for Space MJ Docs.
 */
import {
    BaseEntity,
    CompositeKey,
    type IMetadataProvider,
    LogError,
    RunView,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import {
    type ArtifactDelegateContext,
    BaseArtifactPermissionDelegate,
    type DelegatePermissionDecision,
    type MJArtifactEntity,
    type MJArtifactVersionEntity,
} from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import {
    type Band,
    evaluateSpaceDocAccess,
    filterVisibleSpaceDocs,
    membershipReaches,
    spaceIsReadOnly,
} from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { resolvePerRootDeliveryPrincipal } from './delivery-principal.js';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { SpaceItemEntityServer, vouchStoredFile } from './SpaceItemEntityServer.js';
import { parseUuid } from './uuid.js';

const ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';
const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const ARTIFACTS_ENTITY = 'MJ: Artifacts';
const ARTIFACT_VERSIONS_ENTITY = 'MJ: Artifact Versions';
const ARTIFACT_TYPES_ENTITY = 'MJ: Artifact Types';
const MARKDOWN_DOCUMENT_TYPE_NAME = 'Markdown Document';

export interface SpaceDocRecord {
    spaceItemId: string;
    spaceId: string;
    artifactId: string;
    versionId: string;
    versionNumber: number;
    title: string;
    content: string;
    band: Band;
    folder: string | null;
    authorUserId: string;
    promotedByUserId: string | null;
    promotedAt: Date | null;
}

export type SpaceDocOutcome<T> =
    | { ok: true; data: T }
    | { ok: false; code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'READ_ONLY' | 'INVALID_INPUT' | 'FAILED'; message: string };

interface SpaceItemDocRow {
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Band: Band;
    Folder: string | null;
    ArtifactVersionID: string | null;
    PromotedAt: string | Date | null;
    PromotedByUserID: string | null;
}

interface ArtifactSummaryRow {
    ID: string;
    Name: string;
    TypeID: string;
    UserID: string;
    DelegateEntityID: string | null;
    DelegateRecordID: string | null;
}

interface ArtifactVersionSummaryRow {
    ID: string;
    ArtifactID: string;
    VersionNumber: number;
    Content: string | null;
    UserID: string;
}

function escapeSql(value: string): string {
    return value.replace(/'/g, "''");
}

function extractRecordUuid(recordId: string): string | null {
    const trimmed = recordId.trim();
    const raw = trimmed.toLowerCase().startsWith('id|') ? trimmed.slice(3) : trimmed;
    return parseUuid(raw);
}

async function resolveMarkdownDocTypeId(provider: IMetadataProvider, system: UserInfo): Promise<string> {
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<{ ID: string }>(
        {
            EntityName: ARTIFACT_TYPES_ENTITY,
            ExtraFilter: `Name = '${escapeSql(MARKDOWN_DOCUMENT_TYPE_NAME)}'`,
            Fields: ['ID'],
            ResultType: 'simple',
            MaxRows: 1,
        },
        system,
    );
    const id = res.Success ? res.Results?.[0]?.ID : undefined;
    if (!id) {
        throw new Error(`MJ has no artifact type named "${MARKDOWN_DOCUMENT_TYPE_NAME}".`);
    }
    return id;
}

/**
 * MJ Docs permission delegate for `'MJ_BizApps_Collaboration: Space Items'` (CX-13).
 * Ensures ArtifactPermissionEngine enforces Space seat reach and Team vs. Shared band isolation.
 */
@RegisterClass(BaseArtifactPermissionDelegate, ITEMS_ENTITY)
export class CollaborationSpaceItemArtifactPermissionDelegate extends BaseArtifactPermissionDelegate {
    private async resolveSpaceItemReach(context: ArtifactDelegateContext, user: UserInfo) {
        const itemId = extractRecordUuid(context.DelegateRecordID);
        const callerId = parseUuid(user?.ID);
        if (!itemId || !callerId) {
            return null;
        }
        const system = (await WellKnownUserSource.Instance.GetSystemUser(context.Provider)) ?? user;
        const rv = RunView.FromMetadataProvider(context.Provider);
        const itemRes = await rv.RunView<{ ID: string; SpaceID: string; Band: Band }>(
            {
                EntityName: ITEMS_ENTITY,
                ExtraFilter: `ID = '${itemId}'`,
                Fields: ['ID', 'SpaceID', 'Band'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            system,
        );
        const item = itemRes.Success ? itemRes.Results?.[0] : undefined;
        if (!item) return null;

        const probe = await context.Provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, user);
        const writeCtx = await loadWriteContext(probe, user, item.SpaceID, null);
        const spaceNode = writeCtx.spaces.find((s) => s.id.toLowerCase() === item.SpaceID.toLowerCase()) ?? null;
        const reach = membershipReaches(writeCtx.spaces, writeCtx.memberships, callerId, item.SpaceID);
        const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(user, context.Provider);
        const isOwner = Boolean(spaceNode && spaceNode.ownerId.toLowerCase() === callerId.toLowerCase());
        return {
            item,
            reach,
            isAdmin,
            isOwner,
            spaceReadOnly: spaceNode ? spaceIsReadOnly(spaceNode) : false,
        };
    }

    public override async CanRead(context: ArtifactDelegateContext, user: UserInfo): Promise<DelegatePermissionDecision> {
        try {
            const resolved = await this.resolveSpaceItemReach(context, user);
            if (!resolved) return 'Deny';
            const verdict = evaluateSpaceDocAccess({
                callerReach: resolved.reach,
                docBand: resolved.item.Band,
                operation: 'read',
                isAdmin: resolved.isAdmin,
                isSpaceOwner: resolved.isOwner,
                spaceReadOnly: resolved.spaceReadOnly,
            });
            return verdict.allowed ? 'Allow' : 'Deny';
        } catch (err) {
            LogError(`CollaborationSpaceItemArtifactPermissionDelegate.CanRead failed: ${err instanceof Error ? err.message : String(err)}`);
            return 'Deny';
        }
    }

    public override async CanEdit(context: ArtifactDelegateContext, user: UserInfo): Promise<DelegatePermissionDecision> {
        try {
            const resolved = await this.resolveSpaceItemReach(context, user);
            if (!resolved) return 'Deny';
            const verdict = evaluateSpaceDocAccess({
                callerReach: resolved.reach,
                docBand: resolved.item.Band,
                operation: 'update',
                isAdmin: resolved.isAdmin,
                isSpaceOwner: resolved.isOwner,
                spaceReadOnly: resolved.spaceReadOnly,
            });
            return verdict.allowed ? 'Allow' : 'Deny';
        } catch (err) {
            LogError(`CollaborationSpaceItemArtifactPermissionDelegate.CanEdit failed: ${err instanceof Error ? err.message : String(err)}`);
            return 'Deny';
        }
    }

    public override async CanDelete(context: ArtifactDelegateContext, user: UserInfo): Promise<DelegatePermissionDecision> {
        try {
            const resolved = await this.resolveSpaceItemReach(context, user);
            if (!resolved) return 'Deny';
            const verdict = evaluateSpaceDocAccess({
                callerReach: resolved.reach,
                docBand: resolved.item.Band,
                operation: 'delete',
                isAdmin: resolved.isAdmin,
                isSpaceOwner: resolved.isOwner,
                spaceReadOnly: resolved.spaceReadOnly,
            });
            return verdict.allowed ? 'Allow' : 'Deny';
        } catch {
            return 'Deny';
        }
    }

    public override async CanShare(context: ArtifactDelegateContext, user: UserInfo): Promise<DelegatePermissionDecision> {
        try {
            const resolved = await this.resolveSpaceItemReach(context, user);
            if (!resolved) return 'Deny';
            if (resolved.item.Band === 'Shared') {
                return resolved.isAdmin || Boolean(resolved.reach?.role.canInvite) ? 'Allow' : 'Deny';
            }
            const verdict = evaluateSpaceDocAccess({
                callerReach: resolved.reach,
                docBand: 'Team',
                operation: 'promote',
                isAdmin: resolved.isAdmin,
                isSpaceOwner: resolved.isOwner,
                spaceReadOnly: resolved.spaceReadOnly,
            });
            return verdict.allowed ? 'Allow' : 'Deny';
        } catch {
            return 'Deny';
        }
    }
}

export function LoadCollaborationSpaceItemArtifactPermissionDelegate(): void {
    void CollaborationSpaceItemArtifactPermissionDelegate;
}

/**
 * Creates a new MJ Doc (`MJ: Artifacts` Markdown Document + initial `MJ: Artifact Versions`)
 * filed into a Space on the requested `Team` or `Shared` band.
 */
export async function createSpaceDoc(params: {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
    title: string;
    content: string;
    band: Band;
    folder?: string | null;
    attributionUser?: UserInfo;
}): Promise<SpaceDocOutcome<SpaceDocRecord>> {
    const cleanSpaceId = parseUuid(params.spaceId);
    const callerId = parseUuid(params.callerUser?.ID);
    const title = params.title.trim();
    if (!cleanSpaceId || !callerId || !title) {
        return { ok: false, code: 'INVALID_INPUT', message: 'SpaceID, callerUser, and non-empty title are required.' };
    }

    const probe = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, params.callerUser);
    const system = await requireSystemUser(probe);
    let writeContext;
    try {
        writeContext = await loadWriteContext(probe, params.callerUser, cleanSpaceId, null);
    } catch (err) {
        return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: err instanceof Error ? err.message : 'Space could not be read.',
        };
    }

    const spaceNode = writeContext.spaces.find((s) => s.id.toLowerCase() === cleanSpaceId.toLowerCase());
    if (!spaceNode) {
        return { ok: false, code: 'NOT_FOUND', message: `Space ${cleanSpaceId} was not found.` };
    }
    const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(params.callerUser, params.provider);
    const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);
    const verdict = evaluateSpaceDocAccess({
        callerReach: reach,
        docBand: params.band,
        operation: 'create',
        isAdmin,
        isSpaceOwner: spaceNode.ownerId.toLowerCase() === callerId.toLowerCase(),
        spaceReadOnly: spaceIsReadOnly(spaceNode),
    });
    if (!verdict.allowed) {
        return {
            ok: false,
            code: spaceIsReadOnly(spaceNode) ? 'READ_ONLY' : 'UNAUTHORIZED',
            message: verdict.reason,
        };
    }

    const artifactsEntity = params.provider.EntityByName(ARTIFACTS_ENTITY);
    const itemsEntity = params.provider.EntityByName(ITEMS_ENTITY);
    if (!artifactsEntity || !itemsEntity) {
        return { ok: false, code: 'FAILED', message: 'Required MJ: Artifacts or Space Items entity metadata is missing.' };
    }

    const markdownTypeId = await resolveMarkdownDocTypeId(params.provider, system);
    const authorUser = params.attributionUser ?? params.callerUser;

    const artifact = await params.provider.GetEntityObject<MJArtifactEntity>(ARTIFACTS_ENTITY, system);
    artifact.NewRecord();
    artifact.Name = title;
    artifact.TypeID = markdownTypeId;
    artifact.UserID = authorUser.ID;
    if (!(await artifact.Save()) || !artifact.ID) {
        return {
            ok: false,
            code: 'FAILED',
            message: artifact.LatestResult?.CompleteMessage ?? 'Failed to save MJ: Artifacts record.',
        };
    }

    const version = await params.provider.GetEntityObject<MJArtifactVersionEntity>(ARTIFACT_VERSIONS_ENTITY, system);
    version.NewRecord();
    version.ArtifactID = artifact.ID;
    version.VersionNumber = 1;
    version.Name = title;
    version.ContentMode = 'Text';
    version.Content = params.content;
    version.UserID = authorUser.ID;
    if (!(await version.Save()) || !version.ID) {
        await artifact.Delete();
        return {
            ok: false,
            code: 'FAILED',
            message: version.LatestResult?.CompleteMessage ?? 'Failed to save MJ: Artifact Versions record.',
        };
    }

    const item = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, authorUser);
    vouchStoredFile(item);
    item.NewRecord();
    item.SpaceID = cleanSpaceId;
    item.EntityID = artifactsEntity.ID;
    item.RecordID = `ID|${artifact.ID}`;
    item.Band = verdict.effectiveBand;
    item.Folder = params.folder?.trim() || null;
    item.ArtifactVersionID = version.ID;
    if (!(await item.Save()) || !item.ID) {
        await version.Delete();
        await artifact.Delete();
        return {
            ok: false,
            code: 'FAILED',
            message: item.LatestResult?.CompleteMessage ?? 'Failed to file document in Space Items.',
        };
    }

    // Bind artifact delegation to the filed SpaceItem so MJ ArtifactPermissionEngine mirrors band isolation
    artifact.DelegateEntityID = itemsEntity.ID;
    artifact.DelegateRecordID = item.ID;
    await artifact.Save();

    return {
        ok: true,
        data: {
            spaceItemId: item.ID,
            spaceId: cleanSpaceId,
            artifactId: artifact.ID,
            versionId: version.ID,
            versionNumber: 1,
            title,
            content: params.content,
            band: item.Band,
            folder: item.Folder,
            authorUserId: authorUser.ID,
            promotedByUserId: item.PromotedByUserID ?? null,
            promotedAt: item.PromotedAt ?? null,
        },
    };
}

/**
 * Lists MJ Docs filed in `spaceId` strictly honoring Team vs. Shared band visibility isolation.
 * Shared-band participants receive ONLY Shared docs (zero Team doc leakage).
 */
export async function listSpaceDocs(params: {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
    requestedBand?: Band;
}): Promise<SpaceDocOutcome<SpaceDocRecord[]>> {
    const cleanSpaceId = parseUuid(params.spaceId);
    const callerId = parseUuid(params.callerUser?.ID);
    if (!cleanSpaceId || !callerId) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Valid SpaceID and callerUser are required.' };
    }

    const probe = await params.provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, params.callerUser);
    const system = await requireSystemUser(probe);
    let writeContext;
    try {
        writeContext = await loadWriteContext(probe, params.callerUser, cleanSpaceId, null);
    } catch (err) {
        return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: err instanceof Error ? err.message : 'Space could not be read.',
        };
    }

    const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(params.callerUser, params.provider);
    const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);
    if (!reach && !isAdmin) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Caller does not hold an active seat reaching this space.' };
    }

    const canSeeTeam = isAdmin || Boolean(reach?.role.canSeeTeamBand);
    if (params.requestedBand === 'Team' && !canSeeTeam) {
        return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Access denied: Shared-band participants cannot list Team-band documents.',
        };
    }

    const artifactsEntity = params.provider.EntityByName(ARTIFACTS_ENTITY);
    if (!artifactsEntity) {
        return { ok: true, data: [] };
    }

    const rv = RunView.FromMetadataProvider(params.provider);
    const bandClause = !canSeeTeam
        ? ` AND Band = 'Shared'`
        : params.requestedBand
          ? ` AND Band = '${params.requestedBand}'`
          : '';
    const itemsRes = await rv.RunView<SpaceItemDocRow>(
        {
            EntityName: ITEMS_ENTITY,
            ExtraFilter: `SpaceID = '${cleanSpaceId}' AND EntityID = '${artifactsEntity.ID}'${bandClause}`,
            Fields: ['ID', 'SpaceID', 'EntityID', 'RecordID', 'Band', 'Folder', 'ArtifactVersionID', 'PromotedAt', 'PromotedByUserID'],
            ResultType: 'simple',
            MaxRows: 500, // row-cap-ok: space documents per space
        },
        system,
    );
    if (!itemsRes.Success) {
        return { ok: false, code: 'FAILED', message: itemsRes.ErrorMessage ?? 'Failed to read space items.' };
    }

    const itemRows = filterVisibleSpaceDocs(
        (itemsRes.Results ?? []).map((r) => ({ ...r, band: r.Band })),
        canSeeTeam,
        isAdmin,
    );
    if (itemRows.length === 0) {
        return { ok: true, data: [] };
    }

    const artifactIds = [
        ...new Set(
            itemRows
                .map((r) => extractRecordUuid(r.RecordID))
                .filter((id): id is string => id !== null),
        ),
    ];
    const versionIds = [
        ...new Set(
            itemRows
                .map((r) => parseUuid(r.ArtifactVersionID))
                .filter((id): id is string => id !== null),
        ),
    ];

    const [artifactsRes, versionsRes] = await Promise.all([
        artifactIds.length > 0
            ? rv.RunView<ArtifactSummaryRow>(
                  {
                      EntityName: ARTIFACTS_ENTITY,
                      ExtraFilter: `ID IN (${artifactIds.map((id) => `'${escapeSql(id)}'`).join(', ')})`,
                      Fields: ['ID', 'Name', 'TypeID', 'UserID', 'DelegateEntityID', 'DelegateRecordID'],
                      ResultType: 'simple',
                      MaxRows: 500, // row-cap-ok: matches itemRows bound
                  },
                  system,
              )
            : Promise.resolve({ Success: true, Results: [] as ArtifactSummaryRow[], ErrorMessage: '' }),
        versionIds.length > 0
            ? rv.RunView<ArtifactVersionSummaryRow>(
                  {
                      EntityName: ARTIFACT_VERSIONS_ENTITY,
                      ExtraFilter: `ID IN (${versionIds.map((id) => `'${escapeSql(id)}'`).join(', ')})`,
                      Fields: ['ID', 'ArtifactID', 'VersionNumber', 'Content', 'UserID'],
                      ResultType: 'simple',
                      MaxRows: 500, // row-cap-ok: matches itemRows bound
                  },
                  system,
              )
            : Promise.resolve({ Success: true, Results: [] as ArtifactVersionSummaryRow[], ErrorMessage: '' }),
    ]);

    const artifactMap = new Map<string, ArtifactSummaryRow>();
    for (const a of artifactsRes.Results ?? []) {
        artifactMap.set(a.ID.toLowerCase(), a);
    }
    const versionMap = new Map<string, ArtifactVersionSummaryRow>();
    for (const v of versionsRes.Results ?? []) {
        versionMap.set(v.ID.toLowerCase(), v);
    }

    const docs: SpaceDocRecord[] = [];
    for (const item of itemRows) {
        const artifactId = extractRecordUuid(item.RecordID);
        if (!artifactId) continue;
        const artifact = artifactMap.get(artifactId.toLowerCase());
        const versionId = parseUuid(item.ArtifactVersionID);
        const version = versionId ? versionMap.get(versionId.toLowerCase()) : undefined;
        if (!artifact || !version) continue;

        docs.push({
            spaceItemId: item.ID,
            spaceId: item.SpaceID,
            artifactId: artifact.ID,
            versionId: version.ID,
            versionNumber: version.VersionNumber,
            title: artifact.Name,
            content: version.Content ?? '',
            band: item.Band,
            folder: item.Folder ?? null,
            authorUserId: artifact.UserID,
            promotedByUserId: item.PromotedByUserID ?? null,
            promotedAt: item.PromotedAt ? new Date(item.PromotedAt) : null,
        });
    }

    return { ok: true, data: docs };
}

/**
 * Loads a single MJ Doc from a space after verifying caller reach and Team vs. Shared band clearance.
 */
export async function getSpaceDoc(params: {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
    spaceItemId?: string;
    artifactId?: string;
}): Promise<SpaceDocOutcome<SpaceDocRecord>> {
    const cleanSpaceId = parseUuid(params.spaceId);
    const callerId = parseUuid(params.callerUser?.ID);
    const targetItemId = parseUuid(params.spaceItemId);
    const targetArtifactId = parseUuid(params.artifactId);
    if (!cleanSpaceId || !callerId || (!targetItemId && !targetArtifactId)) {
        return { ok: false, code: 'INVALID_INPUT', message: 'SpaceID, callerUser, and spaceItemId or artifactId are required.' };
    }

    const probe = await params.provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, params.callerUser);
    const system = await requireSystemUser(probe);
    let writeContext;
    try {
        writeContext = await loadWriteContext(probe, params.callerUser, cleanSpaceId, null);
    } catch (err) {
        return { ok: false, code: 'UNAUTHORIZED', message: err instanceof Error ? err.message : 'Space could not be read.' };
    }

    const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(params.callerUser, params.provider);
    const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);
    const rv = RunView.FromMetadataProvider(params.provider);

    const filter = targetItemId
        ? `ID = '${targetItemId}' AND SpaceID = '${cleanSpaceId}'`
        : `SpaceID = '${cleanSpaceId}' AND (RecordID = '${targetArtifactId}' OR RecordID = 'ID|${targetArtifactId}')`;
    const itemRes = await rv.RunView<SpaceItemDocRow>(
        {
            EntityName: ITEMS_ENTITY,
            ExtraFilter: filter,
            Fields: ['ID', 'SpaceID', 'EntityID', 'RecordID', 'Band', 'Folder', 'ArtifactVersionID', 'PromotedAt', 'PromotedByUserID'],
            ResultType: 'simple',
            MaxRows: 1,
        },
        system,
    );
    const item = itemRes.Success ? itemRes.Results?.[0] : undefined;
    if (!item) {
        return { ok: false, code: 'NOT_FOUND', message: 'Space document was not found.' };
    }

    const verdict = evaluateSpaceDocAccess({
        callerReach: reach,
        docBand: item.Band,
        operation: 'read',
        isAdmin,
        spaceReadOnly: false,
    });
    if (!verdict.allowed) {
        return { ok: false, code: 'UNAUTHORIZED', message: verdict.reason };
    }

    const artifactId = extractRecordUuid(item.RecordID);
    const versionId = parseUuid(item.ArtifactVersionID);
    if (!artifactId || !versionId) {
        return { ok: false, code: 'NOT_FOUND', message: 'Space document artifact linkage is incomplete.' };
    }

    const [artifactRes, versionRes] = await Promise.all([
        rv.RunView<ArtifactSummaryRow>(
            {
                EntityName: ARTIFACTS_ENTITY,
                ExtraFilter: `ID = '${artifactId}'`,
                Fields: ['ID', 'Name', 'TypeID', 'UserID', 'DelegateEntityID', 'DelegateRecordID'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            system,
        ),
        rv.RunView<ArtifactVersionSummaryRow>(
            {
                EntityName: ARTIFACT_VERSIONS_ENTITY,
                ExtraFilter: `ID = '${versionId}'`,
                Fields: ['ID', 'ArtifactID', 'VersionNumber', 'Content', 'UserID'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            system,
        ),
    ]);
    const artifact = artifactRes.Success ? artifactRes.Results?.[0] : undefined;
    const version = versionRes.Success ? versionRes.Results?.[0] : undefined;
    if (!artifact || !version) {
        return { ok: false, code: 'NOT_FOUND', message: 'Space document artifact or version was not found.' };
    }

    return {
        ok: true,
        data: {
            spaceItemId: item.ID,
            spaceId: item.SpaceID,
            artifactId: artifact.ID,
            versionId: version.ID,
            versionNumber: version.VersionNumber,
            title: artifact.Name,
            content: version.Content ?? '',
            band: item.Band,
            folder: item.Folder ?? null,
            authorUserId: artifact.UserID,
            promotedByUserId: item.PromotedByUserID ?? null,
            promotedAt: item.PromotedAt ? new Date(item.PromotedAt) : null,
        },
    };
}

/**
 * Updates an existing Space MJ Doc by appending a new `MJ: Artifact Versions` version
 * and updating `SpaceItem.ArtifactVersionID` after verifying Team vs. Shared write authorization.
 */
export async function updateSpaceDoc(params: {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
    spaceItemId: string;
    content: string;
    title?: string;
}): Promise<SpaceDocOutcome<SpaceDocRecord>> {
    const cleanSpaceId = parseUuid(params.spaceId);
    const cleanItemId = parseUuid(params.spaceItemId);
    const callerId = parseUuid(params.callerUser?.ID);
    if (!cleanSpaceId || !cleanItemId || !callerId) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Valid SpaceID, spaceItemId, and callerUser are required.' };
    }

    const probe = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, params.callerUser);
    const system = await requireSystemUser(probe);
    let writeContext;
    try {
        writeContext = await loadWriteContext(probe, params.callerUser, cleanSpaceId, null);
    } catch (err) {
        return { ok: false, code: 'UNAUTHORIZED', message: err instanceof Error ? err.message : 'Space could not be read.' };
    }

    const spaceNode = writeContext.spaces.find((s) => s.id.toLowerCase() === cleanSpaceId.toLowerCase());
    if (!spaceNode) {
        return { ok: false, code: 'NOT_FOUND', message: `Space ${cleanSpaceId} was not found.` };
    }

    const item = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, system);
    if (!(await item.Load(cleanItemId)) || item.SpaceID.toLowerCase() !== cleanSpaceId.toLowerCase()) {
        return { ok: false, code: 'NOT_FOUND', message: 'Space document item was not found in this space.' };
    }

    const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(params.callerUser, params.provider);
    const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);
    const verdict = evaluateSpaceDocAccess({
        callerReach: reach,
        docBand: item.Band,
        operation: 'update',
        isAdmin,
        isSpaceOwner: spaceNode.ownerId.toLowerCase() === callerId.toLowerCase(),
        spaceReadOnly: spaceIsReadOnly(spaceNode),
    });
    if (!verdict.allowed) {
        return {
            ok: false,
            code: spaceIsReadOnly(spaceNode) ? 'READ_ONLY' : 'UNAUTHORIZED',
            message: verdict.reason,
        };
    }

    const artifactId = extractRecordUuid(item.RecordID);
    if (!artifactId) {
        return { ok: false, code: 'NOT_FOUND', message: 'Space document artifact ID is missing.' };
    }
    const artifact = await params.provider.GetEntityObject<MJArtifactEntity>(ARTIFACTS_ENTITY, system);
    if (!(await artifact.Load(artifactId))) {
        return { ok: false, code: 'NOT_FOUND', message: 'Target MJ: Artifacts record was not found.' };
    }

    const rv = RunView.FromMetadataProvider(params.provider);
    const prevVersionRes = await rv.RunView<{ VersionNumber: number }>(
        {
            EntityName: ARTIFACT_VERSIONS_ENTITY,
            ExtraFilter: `ArtifactID = '${artifactId}'`,
            Fields: ['VersionNumber'],
            OrderBy: 'VersionNumber DESC',
            ResultType: 'simple',
            MaxRows: 1,
        },
        system,
    );
    const nextVersionNumber = (prevVersionRes.Results?.[0]?.VersionNumber ?? 0) + 1;
    const nextTitle = params.title?.trim() || artifact.Name;

    if (params.title?.trim() && nextTitle !== artifact.Name) {
        artifact.Name = nextTitle;
        if (!(await artifact.Save())) {
            return {
                ok: false,
                code: 'FAILED',
                message: artifact.LatestResult?.CompleteMessage ?? 'Failed to update document title.',
            };
        }
    }

    const version = await params.provider.GetEntityObject<MJArtifactVersionEntity>(ARTIFACT_VERSIONS_ENTITY, system);
    version.NewRecord();
    version.ArtifactID = artifact.ID;
    version.VersionNumber = nextVersionNumber;
    version.Name = nextTitle;
    version.ContentMode = 'Text';
    version.Content = params.content;
    version.UserID = params.callerUser.ID;
    if (!(await version.Save()) || !version.ID) {
        return {
            ok: false,
            code: 'FAILED',
            message: version.LatestResult?.CompleteMessage ?? 'Failed to save new document version.',
        };
    }

    const itemAsCaller = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, params.callerUser);
    if (!(await itemAsCaller.Load(cleanItemId))) {
        return { ok: false, code: 'NOT_FOUND', message: 'Space document item could not be reloaded.' };
    }
    vouchStoredFile(itemAsCaller);
    itemAsCaller.ArtifactVersionID = version.ID;
    if (!(await itemAsCaller.Save())) {
        return {
            ok: false,
            code: 'FAILED',
            message: itemAsCaller.LatestResult?.CompleteMessage ?? 'Failed to update SpaceItem ArtifactVersionID.',
        };
    }

    return {
        ok: true,
        data: {
            spaceItemId: itemAsCaller.ID,
            spaceId: cleanSpaceId,
            artifactId: artifact.ID,
            versionId: version.ID,
            versionNumber: nextVersionNumber,
            title: nextTitle,
            content: params.content,
            band: itemAsCaller.Band,
            folder: itemAsCaller.Folder ?? null,
            authorUserId: artifact.UserID,
            promotedByUserId: itemAsCaller.PromotedByUserID ?? null,
            promotedAt: itemAsCaller.PromotedAt ?? null,
        },
    };
}

/**
 * Promotes a Team-band MJ Doc to the Shared band attributed to the resolved per-root delivery principal (CA-4).
 */
export async function promoteSpaceDocToShared(params: {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
    spaceItemId: string;
}): Promise<SpaceDocOutcome<SpaceDocRecord>> {
    const cleanSpaceId = parseUuid(params.spaceId);
    const cleanItemId = parseUuid(params.spaceItemId);
    const callerId = parseUuid(params.callerUser?.ID);
    if (!cleanSpaceId || !cleanItemId || !callerId) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Valid SpaceID, spaceItemId, and callerUser are required.' };
    }

    const probe = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, params.callerUser);
    const system = await requireSystemUser(probe);
    let writeContext;
    try {
        writeContext = await loadWriteContext(probe, params.callerUser, cleanSpaceId, null);
    } catch (err) {
        return { ok: false, code: 'UNAUTHORIZED', message: err instanceof Error ? err.message : 'Space could not be read.' };
    }

    const spaceNode = writeContext.spaces.find((s) => s.id.toLowerCase() === cleanSpaceId.toLowerCase());
    if (!spaceNode) {
        return { ok: false, code: 'NOT_FOUND', message: `Space ${cleanSpaceId} was not found.` };
    }

    const item = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, system);
    if (!(await item.Load(cleanItemId)) || item.SpaceID.toLowerCase() !== cleanSpaceId.toLowerCase()) {
        return { ok: false, code: 'NOT_FOUND', message: 'Space document item was not found in this space.' };
    }

    const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(params.callerUser, params.provider);
    const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);
    const verdict = evaluateSpaceDocAccess({
        callerReach: reach,
        docBand: item.Band,
        operation: 'promote',
        isAdmin,
        isSpaceOwner: spaceNode.ownerId.toLowerCase() === callerId.toLowerCase(),
        spaceReadOnly: spaceIsReadOnly(spaceNode),
    });
    if (!verdict.allowed) {
        return {
            ok: false,
            code: spaceIsReadOnly(spaceNode) ? 'READ_ONLY' : 'UNAUTHORIZED',
            message: verdict.reason,
        };
    }

    const principalOutcome = await resolvePerRootDeliveryPrincipal({
        provider: params.provider,
        systemUser: system,
        spaceId: cleanSpaceId,
    });
    if (!principalOutcome.ok) {
        return { ok: false, code: 'UNAUTHORIZED', message: principalOutcome.message };
    }

    const itemAsPrincipal = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, principalOutcome.principalUser);
    if (!(await itemAsPrincipal.Load(cleanItemId))) {
        return { ok: false, code: 'NOT_FOUND', message: 'Space document item could not be loaded under delivery principal.' };
    }
    vouchStoredFile(itemAsPrincipal);
    itemAsPrincipal.Band = 'Shared';
    if (!(await itemAsPrincipal.Save())) {
        return {
            ok: false,
            code: 'FAILED',
            message: itemAsPrincipal.LatestResult?.CompleteMessage ?? 'Failed to promote document to Shared band.',
        };
    }

    return getSpaceDoc({
        provider: params.provider,
        callerUser: principalOutcome.principalUser,
        spaceId: cleanSpaceId,
        spaceItemId: cleanItemId,
    });
}
