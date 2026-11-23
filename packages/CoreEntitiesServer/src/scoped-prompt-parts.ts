/**
 * CX-4: Server Scoped Prompt Parts Resolution & MJ PromptComponentResolver integration.
 *
 * Resolves scoped prompt parts along the `SpaceType -> Root -> Space` hierarchy using
 * batched `RunView` (`ResultType: 'simple'` + `IN` clauses, zero N+1 hydration) across both
 * `MJ: Scoped Prompt Parts` and declarative `CollaborationSettings.PromptParts`.
 */

import {
    LogError,
    RunView,
    WellKnownUserSource,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import type { MJScopedPromptPartEntity } from '@memberjunction/core-entities';
import { PromptComponentResolver, type PromptComponentScope } from '@memberjunction/ai-agents';
import { RegisterClass } from '@memberjunction/global';
import {
    resolveScopedPromptParts,
    type Band,
    type CollaborationSettings,
    type ScopedPromptPartConfigEntry,
    type ScopedPromptPartInput,
    type ScopedPromptPartMergeBehavior,
    type ScopedPromptPartRole,
    type ScopedPromptPartScopeLevel,
    type ScopedPromptPartStatus,
    type ScopedPromptResolutionResult,
    type ScopedPromptSecondaryValue,
} from '@mj-biz-apps/collaboration-core';
import { loadSpaceConfiguration, type LoadedSpaceConfiguration } from './space-configuration.js';
import { asMetadata, parseUuid } from './uuid.js';

const SCOPED_PROMPT_PARTS_ENTITY = 'MJ: Scoped Prompt Parts';
const SPACE_TYPES_ENTITY = 'MJ_BizApps_Collaboration: Space Types';
const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const MAX_PROMPT_PART_ROWS = 500;

interface ScopedPromptPartSimpleRow {
    ID: string;
    PromptID: string;
    Name: string;
    Role: string;
    Sort: number;
    Text: string;
    PrimaryScopeEntityID: string | null;
    PrimaryScopeRecordID: string | null;
    SecondaryScopes: string | null;
    Status: string;
    MergeBehavior: string;
    Priority: number;
}

export interface ResolveSpaceScopedPromptPartsParams {
    provider: IMetadataProvider;
    systemUser?: UserInfo;
    spaceId: string;
    promptId?: string | null;
    audience?: Band;
    secondaryScopes?: Record<string, ScopedPromptSecondaryValue> | null;
    maxTotalChars?: number;
    loadedConfiguration?: LoadedSpaceConfiguration;
    /** Optional caller-supplied extra candidates (primarily for tests/extension seams). */
    additionalCandidates?: readonly ScopedPromptPartInput[];
}

function coerceRole(raw: string | null | undefined): ScopedPromptPartRole {
    if (raw === 'User' || raw === 'Assistant') return raw;
    return 'System';
}

function coerceMergeBehavior(raw: string | null | undefined): ScopedPromptPartMergeBehavior {
    return raw === 'Append' ? 'Append' : 'Override';
}

function coerceStatus(raw: string | null | undefined): ScopedPromptPartStatus | null {
    if (raw === 'Active' || raw === 'Provisional' || raw === 'Archived') {
        return raw;
    }
    return null;
}

function parseSecondaryScopesJson(raw: string | null | undefined): {
    ok: boolean;
    band: Band | null;
    scopes: Record<string, ScopedPromptSecondaryValue> | null;
} {
    if (!raw || !raw.trim()) {
        return { ok: true, band: null, scopes: null };
    }
    try {
        const parsed = JSON.parse(raw) as Record<string, ScopedPromptSecondaryValue>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, band: null, scopes: null };
        }
        const bandRaw = parsed['Band'];
        const band: Band | null = bandRaw === 'Team' || bandRaw === 'Shared' ? bandRaw : null;
        const cleanScopes: Record<string, ScopedPromptSecondaryValue> = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (k === 'Band') continue;
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                cleanScopes[k] = v;
            }
        }
        return {
            ok: true,
            band,
            scopes: Object.keys(cleanScopes).length > 0 ? cleanScopes : null,
        };
    } catch {
        return { ok: false, band: null, scopes: null };
    }
}

function mapConfigPromptParts(
    entries: readonly ScopedPromptPartConfigEntry[] | undefined,
    scopeLevel: ScopedPromptPartScopeLevel,
    scopeRecordId: string,
): ScopedPromptPartInput[] {
    if (!entries || !entries.length) {
        return [];
    }
    return entries.map((entry, idx) => ({
        ID: entry.ID ?? `cfg:${scopeLevel}:${scopeRecordId}:${idx}:${entry.Name}`,
        PromptID: entry.PromptID ?? null,
        Name: entry.Name,
        Role: coerceRole(entry.Role),
        Text: entry.Text,
        Sort: typeof entry.Sort === 'number' ? entry.Sort : 0,
        Priority: typeof entry.Priority === 'number' ? entry.Priority : 0,
        MergeBehavior: coerceMergeBehavior(entry.MergeBehavior),
        Status: entry.Status ?? 'Active',
        ScopeLevel: scopeLevel,
        ScopeRecordID: scopeRecordId,
        Band: entry.Band ?? 'Shared',
    }));
}

function parseSpaceConfigSafe(raw: string | null | undefined): CollaborationSettings | null {
    if (!raw || !raw.trim()) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as CollaborationSettings;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

async function resolveEntityIdsForScopes(
    provider: IMetadataProvider,
    rv: RunView,
    system: UserInfo,
): Promise<{ spaceTypesEntityId: string | null; spacesEntityId: string | null }> {
    const md = asMetadata(provider);
    const cachedTypeEntity = md?.EntityByName(SPACE_TYPES_ENTITY);
    const cachedSpaceEntity = md?.EntityByName(SPACES_ENTITY);
    if (cachedTypeEntity?.ID && cachedSpaceEntity?.ID) {
        return {
            spaceTypesEntityId: parseUuid(cachedTypeEntity.ID),
            spacesEntityId: parseUuid(cachedSpaceEntity.ID),
        };
    }

    const res = await rv.RunView<{ ID: string; Name: string }>({
        EntityName: 'MJ: Entities',
        ExtraFilter: `Name IN ('${SPACE_TYPES_ENTITY}', '${SPACES_ENTITY}')`,
        Fields: ['ID', 'Name'],
        ResultType: 'simple',
        // row-cap-ok: bounded lookup of 2 fixed collaboration entity definitions
        MaxRows: 10,
    }, system);

    let spaceTypesEntityId = cachedTypeEntity?.ID ? parseUuid(cachedTypeEntity.ID) : null;
    let spacesEntityId = cachedSpaceEntity?.ID ? parseUuid(cachedSpaceEntity.ID) : null;
    if (res.Success && res.Results) {
        for (const row of res.Results) {
            if (row.Name === SPACE_TYPES_ENTITY) spaceTypesEntityId = parseUuid(row.ID);
            if (row.Name === SPACES_ENTITY) spacesEntityId = parseUuid(row.ID);
        }
    }
    return { spaceTypesEntityId, spacesEntityId };
}

/**
 * Loads and resolves Scoped Prompt Parts for `params.spaceId` along `SpaceType -> Root -> Space`
 * using batched `RunView` (`ResultType: 'simple'`) queries without N+1 entity hydration.
 */
export async function resolveSpaceScopedPromptParts(
    params: ResolveSpaceScopedPromptPartsParams,
): Promise<ScopedPromptResolutionResult> {
    const spaceId = parseUuid(params.spaceId);
    if (!spaceId) {
        return resolveScopedPromptParts([], { spaceTypeId: '', rootSpaceId: '', spaceId: '' });
    }

    const system = params.systemUser ?? (await WellKnownUserSource.Instance.GetSystemUser(params.provider));
    if (!system) {
        throw new Error('System user is required to resolve scoped prompt parts.');
    }

    const loaded = params.loadedConfiguration ?? (await loadSpaceConfiguration(params.provider, spaceId, { reader: system }));
    const chain = loaded.chain;
    if (!chain.length) {
        return resolveScopedPromptParts([], { spaceTypeId: '', rootSpaceId: '', spaceId: '' });
    }

    const targetRow = chain[0];
    const rootRow = chain[chain.length - 1];
    const spaceTypeId = parseUuid(targetRow.SpaceTypeID);
    const rootSpaceId = parseUuid(rootRow.ID);
    if (!spaceTypeId || !rootSpaceId) {
        return resolveScopedPromptParts([], { spaceTypeId: '', rootSpaceId: '', spaceId: '' });
    }

    const candidates: ScopedPromptPartInput[] = [...(params.additionalCandidates ?? [])];

    // 1. Collect declarative PromptParts from SpaceType -> Root -> Space configurations
    candidates.push(...mapConfigPromptParts(loaded.typeSettings?.PromptParts, 'SpaceType', spaceTypeId));
    const rootConfig = parseSpaceConfigSafe(rootRow.Configuration);
    candidates.push(...mapConfigPromptParts(rootConfig?.PromptParts, 'Root', rootSpaceId));
    if (rootSpaceId !== spaceId) {
        const spaceConfig = parseSpaceConfigSafe(targetRow.Configuration);
        candidates.push(...mapConfigPromptParts(spaceConfig?.PromptParts, 'Space', spaceId));
    }

    // 2. Load MJ: Scoped Prompt Parts in a single batched RunView (ResultType: 'simple')
    const rv = RunView.FromMetadataProvider(params.provider);
    const { spaceTypesEntityId, spacesEntityId } = await resolveEntityIdsForScopes(params.provider, rv, system);
    const recordIds = [...new Set([spaceTypeId, rootSpaceId, spaceId])];
    const inClause = recordIds.map((id) => `'${id}'`).join(', ');
    const promptClause = params.promptId && parseUuid(params.promptId)
        ? ` AND PromptID = '${parseUuid(params.promptId)}'`
        : '';

    const partsRes = await rv.RunView<ScopedPromptPartSimpleRow>({
        EntityName: SCOPED_PROMPT_PARTS_ENTITY,
        ExtraFilter: `PrimaryScopeRecordID IN (${inClause}) AND Status IN ('Active', 'Provisional')${promptClause}`,
        Fields: [
            'ID',
            'PromptID',
            'Name',
            'Role',
            'Sort',
            'Text',
            'PrimaryScopeEntityID',
            'PrimaryScopeRecordID',
            'SecondaryScopes',
            'Status',
            'MergeBehavior',
            'Priority',
        ],
        ResultType: 'simple',
        // row-cap-ok: bounded scoped prompt parts query for 1 SpaceType + 1 Root + 1 Space
        MaxRows: MAX_PROMPT_PART_ROWS,
    }, system);

    if (!partsRes.Success) {
        const msg = partsRes.ErrorMessage ?? 'RunView failed';
        LogError(`resolveSpaceScopedPromptParts: failed loading ${SCOPED_PROMPT_PARTS_ENTITY}: ${msg}`);
        throw new Error(`Scoped prompt parts could not be read: ${msg}`);
    }

    for (const row of partsRes.Results ?? []) {
        const status = coerceStatus(row.Status);
        if (!status) continue;
        const recId = parseUuid(row.PrimaryScopeRecordID);
        if (!recId) continue;
        const entityId = parseUuid(row.PrimaryScopeEntityID);

        let scopeLevel: ScopedPromptPartScopeLevel | null = null;
        if (recId === spaceId && (!entityId || !spacesEntityId || entityId === spacesEntityId)) {
            scopeLevel = 'Space';
        } else if (recId === rootSpaceId && (!entityId || !spacesEntityId || entityId === spacesEntityId)) {
            scopeLevel = 'Root';
        } else if (recId === spaceTypeId && (!entityId || !spaceTypesEntityId || entityId === spaceTypesEntityId)) {
            scopeLevel = 'SpaceType';
        }
        if (!scopeLevel) continue;

        const parsedSecondary = parseSecondaryScopesJson(row.SecondaryScopes);
        if (!parsedSecondary.ok) continue;

        candidates.push({
            ID: row.ID,
            PromptID: row.PromptID,
            Name: row.Name,
            Role: coerceRole(row.Role),
            Text: row.Text,
            Sort: Number(row.Sort ?? 0),
            Priority: Number(row.Priority ?? 0),
            MergeBehavior: coerceMergeBehavior(row.MergeBehavior),
            Status: status,
            ScopeLevel: scopeLevel,
            ScopeRecordID: recId,
            Band: parsedSecondary.band ?? 'Shared',
            SecondaryScopes: parsedSecondary.scopes,
        });
    }

    return resolveScopedPromptParts(candidates, {
        spaceTypeId,
        rootSpaceId,
        spaceId,
        promptId: params.promptId,
        audience: params.audience ?? 'Shared',
        secondaryScopes: params.secondaryScopes,
        maxTotalChars: params.maxTotalChars,
    });
}

/**
 * ClassFactory-registered extension of MJ's `PromptComponentResolver` that supports
 * `SpaceType -> Root -> Space` specificity scoring when Collaboration scope dimensions
 * (`SpaceTypeID`, `RootSpaceID`, `SpaceID`) are present on `scope.secondaryScopes`.
 * Preserves 100% standard `PromptComponentResolver` behavior for non-Collaboration prompts.
 */
@RegisterClass(PromptComponentResolver, 'CollaborationPromptComponentResolver')
export class CollaborationPromptComponentResolver extends PromptComponentResolver {
    protected override isInScope(p: MJScopedPromptPartEntity, scope: PromptComponentScope): boolean {
        const secondary = scope.secondaryScopes;
        if (secondary && ('SpaceTypeID' in secondary || 'RootSpaceID' in secondary || 'SpaceID' in secondary)) {
            const partRecord = parseUuid(p.PrimaryScopeRecordID);
            if (partRecord) {
                const spaceTypeId = typeof secondary['SpaceTypeID'] === 'string' ? parseUuid(secondary['SpaceTypeID']) : null;
                const rootSpaceId = typeof secondary['RootSpaceID'] === 'string' ? parseUuid(secondary['RootSpaceID']) : null;
                const spaceId = typeof secondary['SpaceID'] === 'string' ? parseUuid(secondary['SpaceID']) : null;
                if (partRecord !== spaceTypeId && partRecord !== rootSpaceId && partRecord !== spaceId) {
                    return false;
                }
            }
            const partScopes = this.parseScopes(p.SecondaryScopes);
            for (const key of Object.keys(partScopes)) {
                if (key === 'CollaborationScopeLevel') {
                    continue;
                }
                const runValue = secondary[key];
                if (runValue === undefined || String(runValue) !== String(partScopes[key])) {
                    return false;
                }
            }
            return true;
        }
        return super.isInScope(p, scope);
    }

    protected override score(p: MJScopedPromptPartEntity): number {
        const baseScore = super.score(p);
        const partScopes = this.parseScopes(p.SecondaryScopes);
        if (typeof partScopes['CollaborationScopeLevel'] === 'string') {
            if (partScopes['CollaborationScopeLevel'] === 'Space') return baseScore + 30;
            if (partScopes['CollaborationScopeLevel'] === 'Root') return baseScore + 20;
            if (partScopes['CollaborationScopeLevel'] === 'SpaceType') return baseScore + 10;
        }
        return baseScore;
    }
}

export function LoadCollaborationPromptComponentResolver(): void {
    void CollaborationPromptComponentResolver;
}
