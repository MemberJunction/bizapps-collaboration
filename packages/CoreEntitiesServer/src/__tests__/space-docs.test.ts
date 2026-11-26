import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
    type BaseEntity,
    CompositeKey,
    type EntityInfo,
    type IEntityDataProvider,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { type ArtifactDelegateContext } from '@memberjunction/core-entities';
import {
    DEFAULT_NOTE_DOCUMENT_FOLDER,
    DEFAULT_NOTE_DOCUMENT_TITLE,
    MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME,
    NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE,
    type Band,
    type NoteVisibility,
} from '@mj-biz-apps/collaboration-core';
import {
    CollaborationEngine,
    CollaborationSpaceItemArtifactPermissionDelegate,
    createSpaceDoc,
    getSpaceDoc,
    listSpaceDocs,
    LoadCollaborationSpaceItemArtifactPermissionDelegate,
    promoteSpaceNoteToDoc,
    SpaceDocMetadataCache,
    turnSpaceNoteIntoDocument,
} from '../../dist/index.js';
import { seedAppSettings } from '../app-settings.test-support.ts';

const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';
const OWNER_ID = '11111111-1111-4111-8111-111111111501';
const TEAM_MEMBER_ID = '11111111-1111-4111-8111-111111111502';
const SHARED_CONTRIBUTOR_ID = '11111111-1111-4111-8111-111111111503';
const SHARED_VIEWER_ID = '11111111-1111-4111-8111-111111111504';
const OUTSIDER_ID = '11111111-1111-4111-8111-111111111505';
const ADMIN_ID = '11111111-1111-4111-8111-111111111506';

const SPACE_ID = '22222222-2222-4222-8222-222222222501';
const OTHER_SPACE_ID = '22222222-2222-4222-8222-222222222599';
const SPACE_TYPE_ID = '33333333-3333-4333-8333-333333333501';
const ROLE_TEAM_ID = '44444444-4444-4444-8444-444444444501';
const ROLE_SHARED_CONTRIBUTOR_ID = '44444444-4444-4444-8444-444444444502';
const ROLE_SHARED_VIEWER_ID = '44444444-4444-4444-8444-444444444503';
const MARKDOWN_TYPE_ID = '55555555-5555-4555-8555-555555555501';

const TEAM_NOTE_ID = '66666666-6666-4666-8666-666666666501';
const SHARED_NOTE_ID = '66666666-6666-4666-8666-666666666502';
const PRIVATE_NOTE_ID = '66666666-6666-4666-8666-666666666503';
const UNTITLED_NOTE_ID = '66666666-6666-4666-8666-666666666504';

const ENTITY_IDS: Record<string, string> = {
    'MJ_BizApps_Collaboration: Spaces': 'E5000000-0000-4000-8000-000000000001',
    'MJ_BizApps_Collaboration: Space Items': 'E5000000-0000-4000-8000-000000000002',
    'MJ: Artifacts': 'E5000000-0000-4000-8000-000000000003',
    'MJ: Artifact Versions': 'E5000000-0000-4000-8000-000000000004',
    'MJ_BizApps_Collaboration: Space Notes': 'E5000000-0000-4000-8000-000000000005',
};

function makeUser(id: string, name: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: name,
        Email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        Type: type,
        IsActive: true,
        UserRoles: [],
    };
    return partial as UserInfo;
}

interface StoredArtifact {
    ID: string;
    Name: string;
    Description: string | null;
    TypeID: string;
    UserID: string;
    Visibility: 'Always' | 'System Only';
    DelegateEntityID: string | null;
    DelegateRecordID: string | null;
}

interface StoredVersion {
    ID: string;
    ArtifactID: string;
    VersionNumber: number;
    Name: string;
    ContentMode: string;
    Content: string | null;
    UserID: string;
}

interface StoredItem {
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Band: Band;
    Folder: string | null;
    ArtifactVersionID: string | null;
    PromotedAt: Date | null;
    PromotedByUserID: string | null;
}

interface StoredNote {
    ID: string;
    SpaceID: string;
    Title: string | null;
    Body: string | null;
    Band: Band;
    Visibility: NoteVisibility;
    AuthorUserID: string;
}

interface MockOptions {
    readOnlySpace?: boolean;
    failVersionSave?: boolean;
    failItemSave?: boolean;
    throwOnItemSave?: boolean;
    failDelegationSave?: boolean;
    notes?: StoredNote[];
}

function createSpaceNoteDocMockProvider(options: MockOptions = {}) {
    const artifacts: StoredArtifact[] = [];
    const versions: StoredVersion[] = [];
    const items: StoredItem[] = [];
    const filesAccessed: string[] = [];
    const runViewsBatches: number[] = [];
    let artifactTypeQueries = 0;
    const notes: StoredNote[] = options.notes ?? [
        {
            ID: TEAM_NOTE_ID,
            SpaceID: SPACE_ID,
            Title: 'Pricing thoughts (internal)',
            Body: 'Hold the 8% uplift until the roadmap lands.\r\n\r\nReview with finance.',
            Band: 'Team',
            Visibility: 'Space',
            AuthorUserID: TEAM_MEMBER_ID,
        },
        {
            ID: SHARED_NOTE_ID,
            SpaceID: SPACE_ID,
            Title: 'Kickoff recap',
            Body: 'Scope agreed with partner team.\nNext check-in Thursday.',
            Band: 'Shared',
            Visibility: 'Space',
            AuthorUserID: OWNER_ID,
        },
        {
            ID: PRIVATE_NOTE_ID,
            SpaceID: SPACE_ID,
            Title: 'Owner private prep',
            Body: 'Call partner lead before Friday review.',
            Band: 'Team',
            Visibility: 'Private',
            AuthorUserID: OWNER_ID,
        },
        {
            ID: UNTITLED_NOTE_ID,
            SpaceID: SPACE_ID,
            Title: '   \t  ',
            Body: '   \r\n  ',
            Band: 'Team',
            Visibility: 'Space',
            AuthorUserID: TEAM_MEMBER_ID,
        },
    ];

    let seq = 0;
    const nextUuid = (prefix: string): string => {
        seq += 1;
        return `${prefix}000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
    };

    const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
        Entities: [],
        EntityByName(name: string): EntityInfo | undefined {
            const id = ENTITY_IDS[name];
            if (!id) return undefined;
            const info: Partial<EntityInfo> = {
                ID: id,
                Name: name,
                PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' } as EntityInfo['PrimaryKeys'][number]],
                Fields: [],
            };
            return info as EntityInfo;
        },
        EntityByID(): EntityInfo | undefined {
            return undefined;
        },
        GetEntityObject: (async <T extends BaseEntity>(
            entityName: string,
            contextUserOrKey?: UserInfo | CompositeKey,
            contextUserArg?: UserInfo,
        ): Promise<T> => {
            const contextUser = contextUserOrKey instanceof CompositeKey ? contextUserArg : contextUserOrKey;
            if (entityName === 'MJ: Files') {
                filesAccessed.push('MJ: Files');
            }
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                const spaceObj = {
                    ID: SPACE_ID,
                    SpaceTypeID: SPACE_TYPE_ID,
                    OwnerID: OWNER_ID,
                    ParentID: null as string | null,
                    Name: 'Notes-to-Doc Test Space',
                    ProviderToUse: providerImpl as object as IEntityDataProvider,
                    RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                    async Load() {
                        return true;
                    },
                };
                return spaceObj as object as T;
            }
            if (entityName === 'MJ: Artifacts') {
                const obj = {
                    ID: '',
                    Name: '',
                    Description: null as string | null,
                    TypeID: '',
                    UserID: '',
                    Visibility: 'Always' as 'Always' | 'System Only',
                    DelegateEntityID: null as string | null,
                    DelegateRecordID: null as string | null,
                    LatestResult: { CompleteMessage: '' },
                    NewRecord() {
                        obj.ID = nextUuid('A5');
                    },
                    async Load(id: string) {
                        const found = artifacts.find((a) => a.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        Object.assign(obj, found);
                        return true;
                    },
                    async Save() {
                        const existing = artifacts.find((a) => a.ID === obj.ID);
                        if (existing && options.failDelegationSave && obj.DelegateEntityID !== null) {
                            obj.LatestResult.CompleteMessage = 'Simulated delegation bind save failure.';
                            return false;
                        }
                        const copy: StoredArtifact = {
                            ID: obj.ID,
                            Name: obj.Name,
                            Description: obj.Description,
                            TypeID: obj.TypeID,
                            UserID: obj.UserID,
                            Visibility: obj.Visibility,
                            DelegateEntityID: obj.DelegateEntityID,
                            DelegateRecordID: obj.DelegateRecordID,
                        };
                        if (existing) Object.assign(existing, copy);
                        else artifacts.push(copy);
                        return true;
                    },
                    async Delete() {
                        const idx = artifacts.findIndex((a) => a.ID === obj.ID);
                        if (idx >= 0) artifacts.splice(idx, 1);
                        return true;
                    },
                };
                return obj as object as T;
            }
            if (entityName === 'MJ: Artifact Versions') {
                const obj = {
                    ID: '',
                    ArtifactID: '',
                    VersionNumber: 1,
                    Name: '',
                    ContentMode: 'Text',
                    Content: null as string | null,
                    UserID: '',
                    LatestResult: { CompleteMessage: '' },
                    NewRecord() {
                        obj.ID = nextUuid('B5');
                    },
                    async Save() {
                        if (options.failVersionSave) {
                            obj.LatestResult.CompleteMessage = 'Simulated version save failure.';
                            return false;
                        }
                        versions.push({
                            ID: obj.ID,
                            ArtifactID: obj.ArtifactID,
                            VersionNumber: obj.VersionNumber,
                            Name: obj.Name,
                            ContentMode: obj.ContentMode,
                            Content: obj.Content,
                            UserID: obj.UserID,
                        });
                        return true;
                    },
                    async Delete() {
                        const idx = versions.findIndex((v) => v.ID === obj.ID);
                        if (idx >= 0) versions.splice(idx, 1);
                        return true;
                    },
                };
                return obj as object as T;
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Items') {
                const obj = {
                    ID: '',
                    SpaceID: '',
                    EntityID: '',
                    RecordID: '',
                    Band: 'Team' as Band,
                    Folder: null as string | null,
                    ArtifactVersionID: null as string | null,
                    PromotedAt: null as Date | null,
                    PromotedByUserID: null as string | null,
                    ProviderToUse: providerImpl as object as IEntityDataProvider,
                    RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                    LatestResult: { CompleteMessage: '' },
                    NewRecord() {
                        obj.ID = nextUuid('C5');
                    },
                    async Load(id: string) {
                        const found = items.find((i) => i.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        Object.assign(obj, found);
                        return true;
                    },
                    async Save() {
                        if (options.throwOnItemSave) {
                            throw new Error('Simulated SpaceItem throw.');
                        }
                        if (options.failItemSave) {
                            obj.LatestResult.CompleteMessage = 'Simulated SpaceItem save failure.';
                            return false;
                        }
                        const existing = items.find((i) => i.ID === obj.ID);
                        if (obj.Band === 'Shared' && (!existing || existing.Band !== 'Shared')) {
                            obj.PromotedAt = new Date();
                            obj.PromotedByUserID = contextUser?.ID ?? null;
                        }
                        const copy: StoredItem = {
                            ID: obj.ID,
                            SpaceID: obj.SpaceID,
                            EntityID: obj.EntityID,
                            RecordID: obj.RecordID,
                            Band: obj.Band,
                            Folder: obj.Folder,
                            ArtifactVersionID: obj.ArtifactVersionID,
                            PromotedAt: obj.PromotedAt,
                            PromotedByUserID: obj.PromotedByUserID,
                        };
                        if (existing) Object.assign(existing, copy);
                        else items.push(copy);
                        return true;
                    },
                    async Delete() {
                        const idx = items.findIndex((i) => i.ID === obj.ID);
                        if (idx >= 0) items.splice(idx, 1);
                        return true;
                    },
                };
                return obj as object as T;
            }
            const base: Partial<BaseEntity> = {
                ProviderToUse: providerImpl as object as IEntityDataProvider,
                RunViewProviderToUse: providerImpl as object as IRunViewProvider,
            };
            return base as T;
        }) as object as IMetadataProvider['GetEntityObject'],
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            runViewsBatches.push(paramsList.length);
            return Promise.all(paramsList.map((p) => providerImpl.RunView!<T>(p)));
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            if (
                params.EntityName === 'MJ_BizApps_Collaboration: Space Notes' ||
                params.EntityName === 'MJ_BizApps_Collaboration: Space Items' ||
                params.EntityName === 'MJ: Artifacts' ||
                params.EntityName === 'MJ: Artifact Versions' ||
                params.EntityName === 'MJ: Artifact Types'
            ) {
                assert.equal(params.ResultType, 'simple', `Expected ResultType: 'simple' for ${params.EntityName}`);
            } else {
                assert.notEqual(params.ResultType, 'entity_object', `Expected simple/default ResultType for ${params.EntityName}`);
            }
            const ok = (rows: object[]): RunViewResult<T> => ({
                Success: true,
                Results: rows as object as T[],
                RowCount: rows.length,
                TotalRowCount: rows.length,
                ExecutionTime: 1,
                ErrorMessage: '',
            });
            const filter = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : '';
            if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                return ok([
                    {
                        ID: SPACE_ID,
                        ParentID: null,
                        SpaceTypeID: SPACE_TYPE_ID,
                        OwnerID: OWNER_ID,
                        InheritsMembership: true,
                        AgentRetrieval: 'Included',
                        ClosedAt: options.readOnlySpace ? new Date().toISOString() : null,
                        StatusID: null,
                        Configuration: null,
                    },
                ]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                return ok([
                    { ID: 'M1', SpaceID: SPACE_ID, UserID: OWNER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                    { ID: 'M2', SpaceID: SPACE_ID, UserID: TEAM_MEMBER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                    { ID: 'M3', SpaceID: SPACE_ID, UserID: SHARED_CONTRIBUTOR_ID, SpaceRoleTypeID: ROLE_SHARED_CONTRIBUTOR_ID, Band: 'Shared', Status: 'Active' },
                    { ID: 'M4', SpaceID: SPACE_ID, UserID: SHARED_VIEWER_ID, SpaceRoleTypeID: ROLE_SHARED_VIEWER_ID, Band: 'Shared', Status: 'Active' },
                ]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                return ok([
                    { ID: ROLE_TEAM_ID, CanSeeTeamBand: true, CanContribute: true, CanCreateChildSpace: true, CanPromoteBand: true, CanInvite: true },
                    { ID: ROLE_SHARED_CONTRIBUTOR_ID, CanSeeTeamBand: false, CanContribute: true, CanCreateChildSpace: false, CanPromoteBand: false, CanInvite: false },
                    { ID: ROLE_SHARED_VIEWER_ID, CanSeeTeamBand: false, CanContribute: false, CanCreateChildSpace: false, CanPromoteBand: false, CanInvite: false },
                ]);
            }
            if (params.EntityName === 'MJ: Artifact Types') {
                artifactTypeQueries += 1;
                return ok([{ ID: MARKDOWN_TYPE_ID, Name: MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME }]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Notes') {
                const idMatch = filter.match(/\bID\s*=\s*'([^']+)'/i);
                const found = idMatch ? notes.filter((n) => n.ID.toLowerCase() === idMatch[1].toLowerCase()) : notes;
                return ok(found);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                const bandMatch = filter.match(/\bBand\s*=\s*'([^']+)'/i);
                const idMatch = filter.match(/\bID\s*=\s*'([^']+)'/i);
                const filtered = items.filter((item) => {
                    if (idMatch && item.ID.toLowerCase() !== idMatch[1].toLowerCase()) return false;
                    if (bandMatch && item.Band !== bandMatch[1]) return false;
                    return true;
                });
                return ok(filtered);
            }
            if (params.EntityName === 'MJ: Artifacts') {
                const filtered = artifacts.filter((a) => filter.toLowerCase().includes(a.ID.toLowerCase()));
                return ok(filtered);
            }
            if (params.EntityName === 'MJ: Artifact Versions') {
                const filtered = versions.filter((v) => filter.toLowerCase().includes(v.ID.toLowerCase()));
                return ok(filtered);
            }
            return ok([]);
        },
    };

    return {
        provider: providerImpl as IMetadataProvider,
        artifacts,
        versions,
        items,
        filesAccessed,
        runViewsBatches,
        getArtifactTypeQueries: () => artifactTypeQueries,
    };
}

describe('promoteSpaceNoteToDoc — native MJ: Artifacts Markdown Document promotion', () => {
    const origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
    const origSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);
    const origUserMayAdministerSpaces = CollaborationEngine.Instance.UserMayAdministerSpaces.bind(CollaborationEngine.Instance);
    const origEnsureLoaded = CollaborationEngine.Instance.EnsureLoaded.bind(CollaborationEngine.Instance);
    const origEffectiveStatusForSpace = CollaborationEngine.Instance.EffectiveStatusForSpace.bind(CollaborationEngine.Instance);
    const origSpaceRoleTypeById = CollaborationEngine.Instance.SpaceRoleTypeById.bind(CollaborationEngine.Instance);

    before(() => {
        seedAppSettings();
        LoadCollaborationSpaceItemArtifactPermissionDelegate();
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_ID, 'System', 'Owner');
        CollaborationEngine.Instance.EnsureLoaded = async () => undefined;
        CollaborationEngine.Instance.EffectiveStatusForSpace = () => undefined;
        CollaborationEngine.Instance.SpaceTypeById = () => undefined;
        CollaborationEngine.Instance.SpaceRoleTypeById = (id: string | null | undefined) => {
            if (!id) return undefined;
            if (id.toLowerCase() === ROLE_TEAM_ID.toLowerCase()) {
                return { ID: ROLE_TEAM_ID, Level: 80, MaxGrantableLevel: 80, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (id.toLowerCase() === ROLE_SHARED_CONTRIBUTOR_ID.toLowerCase()) {
                return { ID: ROLE_SHARED_CONTRIBUTOR_ID, Level: 20, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (id.toLowerCase() === ROLE_SHARED_VIEWER_ID.toLowerCase()) {
                return { ID: ROLE_SHARED_VIEWER_ID, Level: 10, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: false } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            return undefined;
        };
        CollaborationEngine.Instance.UserMayAdministerSpaces = (user: UserInfo) => user.ID.toLowerCase() === ADMIN_ID.toLowerCase();
    });

    beforeEach(() => {
        SpaceDocMetadataCache.Instance.Clear();
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        CollaborationEngine.Instance.EnsureLoaded = origEnsureLoaded;
        CollaborationEngine.Instance.EffectiveStatusForSpace = origEffectiveStatusForSpace;
        CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
        CollaborationEngine.Instance.SpaceRoleTypeById = origSpaceRoleTypeById;
        CollaborationEngine.Instance.UserMayAdministerSpaces = origUserMayAdministerSpaces;
        SpaceDocMetadataCache.Instance.Clear();
    });

    it('promotes a Team SpaceNote to native MJ: Artifacts Markdown Document + v1 version + SpaceItem with DelegateEntityID/DelegateRecordID', async () => {
        const { provider, artifacts, versions, items, filesAccessed } = createSpaceNoteDocMockProvider();
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');
        const sharedUser = makeUser(SHARED_CONTRIBUTOR_ID, 'Shared Contributor');
        const outsiderUser = makeUser(OUTSIDER_ID, 'Outsider');

        const outcome = await promoteSpaceNoteToDoc({
            provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            noteId: TEAM_NOTE_ID,
        });

        assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.message);
        if (!outcome.ok) return;

        assert.equal(filesAccessed.length, 0, 'Must NEVER touch MJ: Files / upload-space-file.ts');
        assert.equal(outcome.data.spaceId, SPACE_ID);
        assert.equal(outcome.data.sourceNoteId, TEAM_NOTE_ID);
        assert.equal(outcome.data.title, 'Pricing thoughts (internal)');
        assert.equal(
            outcome.data.content,
            '# Pricing thoughts (internal)\n\nHold the 8% uplift until the roadmap lands.\n\nReview with finance.\n',
        );
        assert.equal(outcome.data.band, 'Team');
        assert.equal(outcome.data.visibility, 'Space');
        assert.equal(outcome.data.folder, DEFAULT_NOTE_DOCUMENT_FOLDER);
        assert.equal(outcome.data.versionNumber, 1);
        assert.equal(outcome.data.artifactTypeName, MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME);
        assert.equal(outcome.data.contentMode, NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE);
        assert.equal(outcome.data.delegateEntityId, ENTITY_IDS['MJ_BizApps_Collaboration: Space Items']);
        assert.equal(outcome.data.delegateRecordId, outcome.data.spaceItemId);

        assert.equal(artifacts.length, 1);
        assert.equal(artifacts[0].TypeID, MARKDOWN_TYPE_ID);
        assert.equal(artifacts[0].Visibility, 'Always');
        assert.equal(artifacts[0].DelegateEntityID, ENTITY_IDS['MJ_BizApps_Collaboration: Space Items']);
        assert.equal(artifacts[0].DelegateRecordID, items[0].ID);

        assert.equal(versions.length, 1);
        assert.equal(versions[0].VersionNumber, 1);
        assert.equal(versions[0].ContentMode, 'Text');
        assert.equal(versions[0].ArtifactID, artifacts[0].ID);

        assert.equal(items.length, 1);
        assert.equal(items[0].EntityID, ENTITY_IDS['MJ: Artifacts']);
        assert.equal(items[0].RecordID, `ID|${artifacts[0].ID}`);
        assert.equal(items[0].ArtifactVersionID, versions[0].ID);
        assert.equal(items[0].Band, 'Team');

        // Permission delegation enforces Team vs Shared vs Outsider isolation
        const delegate = new CollaborationSpaceItemArtifactPermissionDelegate();
        const delegateCtx: ArtifactDelegateContext = {
            Provider: provider,
            DelegateEntityID: outcome.data.delegateEntityId,
            DelegateRecordID: outcome.data.delegateRecordId,
            ArtifactID: outcome.data.artifactId,
            ArtifactOwnerUserID: outcome.data.authorUserId,
            DelegateEntityName: 'MJ_BizApps_Collaboration: Space Items',
        };
        assert.equal(await delegate.CanRead(delegateCtx, teamUser), 'Allow');
        assert.equal(await delegate.CanEdit(delegateCtx, teamUser), 'Allow');
        assert.equal(await delegate.CanRead(delegateCtx, sharedUser), 'Deny');
        assert.equal(await delegate.CanEdit(delegateCtx, sharedUser), 'Deny');
        assert.equal(await delegate.CanRead(delegateCtx, outsiderUser), 'Deny');
    });

    it('promotes a Shared SpaceNote inheriting Shared band and grants Shared-band delegate access while denying outsiders', async () => {
        const { provider, artifacts, items } = createSpaceNoteDocMockProvider();
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');
        const sharedUser = makeUser(SHARED_CONTRIBUTOR_ID, 'Shared Contributor');
        const outsiderUser = makeUser(OUTSIDER_ID, 'Outsider');

        const outcome = await turnSpaceNoteIntoDocument({
            provider,
            callerUser: sharedUser,
            noteId: SHARED_NOTE_ID,
            folder: 'Deliverables',
        });

        assert.equal(outcome.ok, true, outcome.ok ? '' : outcome.message);
        if (!outcome.ok) return;

        assert.equal(outcome.data.band, 'Shared');
        assert.equal(outcome.data.visibility, 'Space');
        assert.equal(outcome.data.folder, 'Deliverables');
        assert.equal(items[0].Band, 'Shared');
        assert.equal(artifacts[0].DelegateEntityID, ENTITY_IDS['MJ_BizApps_Collaboration: Space Items']);
        assert.equal(artifacts[0].DelegateRecordID, items[0].ID);

        const delegate = new CollaborationSpaceItemArtifactPermissionDelegate();
        const delegateCtx: ArtifactDelegateContext = {
            Provider: provider,
            DelegateEntityID: outcome.data.delegateEntityId,
            DelegateRecordID: outcome.data.delegateRecordId,
            ArtifactID: outcome.data.artifactId,
            ArtifactOwnerUserID: outcome.data.authorUserId,
            DelegateEntityName: 'MJ_BizApps_Collaboration: Space Items',
        };
        assert.equal(await delegate.CanRead(delegateCtx, sharedUser), 'Allow');
        assert.equal(await delegate.CanEdit(delegateCtx, sharedUser), 'Allow');
        assert.equal(await delegate.CanRead(delegateCtx, teamUser), 'Allow');
        assert.equal(await delegate.CanRead(delegateCtx, outsiderUser), 'Deny');
    });

    it('restricts Private SpaceNotes to their author (locked to Team band) and denies peers', async () => {
        const { provider, artifacts, versions, items } = createSpaceNoteDocMockProvider();
        const ownerUser = makeUser(OWNER_ID, 'Space Owner');
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');
        const sharedUser = makeUser(SHARED_CONTRIBUTOR_ID, 'Shared Contributor');

        // Peer team member cannot turn owner's private note into a document
        const peerDenied = await promoteSpaceNoteToDoc({
            provider,
            callerUser: teamUser,
            noteId: PRIVATE_NOTE_ID,
        });
        assert.equal(peerDenied.ok, false);
        if (!peerDenied.ok) assert.equal(peerDenied.code, 'UNAUTHORIZED');
        assert.equal(artifacts.length, 0);
        assert.equal(versions.length, 0);
        assert.equal(items.length, 0);

        // Author promotes private note -> locked strictly to Team band with Visibility='Private'
        const authorOk = await promoteSpaceNoteToDoc({
            provider,
            callerUser: ownerUser,
            noteId: PRIVATE_NOTE_ID,
        });
        assert.equal(authorOk.ok, true, authorOk.ok ? '' : authorOk.message);
        if (!authorOk.ok) return;
        assert.equal(authorOk.data.band, 'Team');
        assert.equal(authorOk.data.visibility, 'Private');

        // Shared participant cannot read the promoted artifact
        const delegate = new CollaborationSpaceItemArtifactPermissionDelegate();
        const ctx: ArtifactDelegateContext = {
            Provider: provider,
            DelegateEntityID: authorOk.data.delegateEntityId,
            DelegateRecordID: authorOk.data.delegateRecordId,
            ArtifactID: authorOk.data.artifactId,
            ArtifactOwnerUserID: authorOk.data.authorUserId,
            DelegateEntityName: 'MJ_BizApps_Collaboration: Space Items',
        };
        assert.equal(await delegate.CanRead(ctx, sharedUser), 'Deny');
    });

    it('gracefully handles empty, untitled, and whitespace-only SpaceNotes with deterministic fallback title and Markdown body', async () => {
        const { provider } = createSpaceNoteDocMockProvider();
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');

        const fromPersisted = await promoteSpaceNoteToDoc({
            provider,
            callerUser: teamUser,
            noteId: UNTITLED_NOTE_ID,
            folder: null,
        });
        assert.equal(fromPersisted.ok, true, fromPersisted.ok ? '' : fromPersisted.message);
        if (!fromPersisted.ok) return;
        assert.equal(fromPersisted.data.title, DEFAULT_NOTE_DOCUMENT_TITLE);
        assert.equal(fromPersisted.data.content, `# ${DEFAULT_NOTE_DOCUMENT_TITLE}\n\n`);
        assert.equal(fromPersisted.data.folder, null);

        const fromInline = await promoteSpaceNoteToDoc({
            provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            note: {
                Title: '',
                Body: null,
                Band: 'Shared',
                Visibility: 'Space',
            },
        });
        assert.equal(fromInline.ok, true, fromInline.ok ? '' : fromInline.message);
        if (!fromInline.ok) return;
        assert.equal(fromInline.data.title, DEFAULT_NOTE_DOCUMENT_TITLE);
        assert.equal(fromInline.data.content, `# ${DEFAULT_NOTE_DOCUMENT_TITLE}\n\n`);
        assert.equal(fromInline.data.band, 'Shared');
        assert.equal(fromInline.data.sourceNoteId, null);
    });

    it('rejects unauthorized callers, cross-space mismatches, read-only spaces, and invalid inputs without creating orphan artifacts', async () => {
        const { provider, artifacts, versions, items } = createSpaceNoteDocMockProvider();
        const sharedUser = makeUser(SHARED_CONTRIBUTOR_ID, 'Shared Contributor');
        const viewerUser = makeUser(SHARED_VIEWER_ID, 'Shared Viewer');
        const outsiderUser = makeUser(OUTSIDER_ID, 'Outsider');
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');

        const sharedOnTeam = await promoteSpaceNoteToDoc({ provider, callerUser: sharedUser, noteId: TEAM_NOTE_ID });
        assert.equal(sharedOnTeam.ok, false);
        if (!sharedOnTeam.ok) assert.equal(sharedOnTeam.code, 'UNAUTHORIZED');

        const viewerOnShared = await promoteSpaceNoteToDoc({ provider, callerUser: viewerUser, noteId: SHARED_NOTE_ID });
        assert.equal(viewerOnShared.ok, false);
        if (!viewerOnShared.ok) assert.equal(viewerOnShared.code, 'UNAUTHORIZED');

        const outsiderOnShared = await promoteSpaceNoteToDoc({ provider, callerUser: outsiderUser, noteId: SHARED_NOTE_ID });
        assert.equal(outsiderOnShared.ok, false);
        if (!outsiderOnShared.ok) assert.equal(outsiderOnShared.code, 'UNAUTHORIZED');

        const spaceMismatch = await promoteSpaceNoteToDoc({
            provider,
            callerUser: teamUser,
            spaceId: OTHER_SPACE_ID,
            noteId: TEAM_NOTE_ID,
        });
        assert.equal(spaceMismatch.ok, false);
        if (!spaceMismatch.ok) assert.equal(spaceMismatch.code, 'NOT_FOUND');

        const missingPayload = await promoteSpaceNoteToDoc({ provider, callerUser: teamUser });
        assert.equal(missingPayload.ok, false);
        if (!missingPayload.ok) assert.equal(missingPayload.code, 'INVALID_INPUT');

        assert.equal(artifacts.length, 0);
        assert.equal(versions.length, 0);
        assert.equal(items.length, 0);

        // Read-only closed space
        const ro = createSpaceNoteDocMockProvider({ readOnlySpace: true });
        const roRes = await promoteSpaceNoteToDoc({ provider: ro.provider, callerUser: teamUser, noteId: TEAM_NOTE_ID });
        assert.equal(roRes.ok, false);
        if (!roRes.ok) assert.equal(roRes.code, 'READ_ONLY');
        assert.equal(ro.artifacts.length, 0);
    });

    it('executes compensating cleanup leaving zero orphaned Artifact, Version, or SpaceItem rows on partial failures', async () => {
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');

        // 1. Version save fails -> Artifact deleted
        const failVer = createSpaceNoteDocMockProvider({ failVersionSave: true });
        const r1 = await promoteSpaceNoteToDoc({ provider: failVer.provider, callerUser: teamUser, noteId: TEAM_NOTE_ID });
        assert.equal(r1.ok, false);
        if (!r1.ok) assert.equal(r1.code, 'FAILED');
        assert.equal(failVer.artifacts.length, 0);
        assert.equal(failVer.versions.length, 0);
        assert.equal(failVer.items.length, 0);

        // 2. SpaceItem save returns false -> Version & Artifact deleted
        const failItem = createSpaceNoteDocMockProvider({ failItemSave: true });
        const r2 = await promoteSpaceNoteToDoc({ provider: failItem.provider, callerUser: teamUser, noteId: TEAM_NOTE_ID });
        assert.equal(r2.ok, false);
        if (!r2.ok) assert.equal(r2.code, 'FAILED');
        assert.equal(failItem.artifacts.length, 0);
        assert.equal(failItem.versions.length, 0);
        assert.equal(failItem.items.length, 0);

        // 3. SpaceItem save throws -> Version & Artifact deleted
        const throwItem = createSpaceNoteDocMockProvider({ throwOnItemSave: true });
        const r3 = await promoteSpaceNoteToDoc({ provider: throwItem.provider, callerUser: teamUser, noteId: TEAM_NOTE_ID });
        assert.equal(r3.ok, false);
        if (!r3.ok) assert.equal(r3.code, 'FAILED');
        assert.equal(throwItem.artifacts.length, 0);
        assert.equal(throwItem.versions.length, 0);
        assert.equal(throwItem.items.length, 0);

        // 4. Delegation bind artifact.Save() fails -> SpaceItem, Version, and Artifact ALL deleted (fail-closed)
        const failDel = createSpaceNoteDocMockProvider({ failDelegationSave: true });
        const r4 = await promoteSpaceNoteToDoc({ provider: failDel.provider, callerUser: teamUser, noteId: TEAM_NOTE_ID });
        assert.equal(r4.ok, false);
        if (!r4.ok) {
            assert.equal(r4.code, 'FAILED');
            assert.match(r4.message, /delegation/i);
        }
        assert.equal(failDel.artifacts.length, 0);
        assert.equal(failDel.versions.length, 0);
        assert.equal(failDel.items.length, 0);
    });

    it('caches Markdown Document ArtifactTypeID via SpaceDocMetadataCache BaseSingleton and batches listSpaceDocs/getSpaceDoc via RunViews', async () => {
        const harness = createSpaceNoteDocMockProvider();
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');

        const first = await createSpaceDoc({
            provider: harness.provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            title: 'Doc One',
            content: '# Doc One\n',
            band: 'Team',
        });
        assert.equal(first.ok, true);

        const second = await promoteSpaceNoteToDoc({
            provider: harness.provider,
            callerUser: teamUser,
            noteId: SHARED_NOTE_ID,
        });
        assert.equal(second.ok, true);
        if (!second.ok) return;

        // ArtifactType lookup ran once and was cached per-provider in SpaceDocMetadataCache
        assert.equal(harness.getArtifactTypeQueries(), 1);

        // Clearing provider cache forces fresh lookup on next call
        SpaceDocMetadataCache.Instance.ClearProvider(harness.provider);
        const third = await promoteSpaceNoteToDoc({
            provider: harness.provider,
            callerUser: teamUser,
            noteId: TEAM_NOTE_ID,
        });
        assert.equal(third.ok, true);
        assert.equal(harness.getArtifactTypeQueries(), 2);

        // listSpaceDocs and getSpaceDoc use batched RunViews([artifacts, versions])
        harness.runViewsBatches.length = 0;
        const listed = await listSpaceDocs({ provider: harness.provider, callerUser: teamUser, spaceId: SPACE_ID });
        assert.equal(listed.ok, true);
        if (listed.ok) {
            assert.equal(listed.data.length, 3);
            assert.equal(listed.data[0].delegateEntityId, ENTITY_IDS['MJ_BizApps_Collaboration: Space Items']);
        }
        const fetched = await getSpaceDoc({
            provider: harness.provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            spaceItemId: second.data.spaceItemId,
        });
        assert.equal(fetched.ok, true);
        if (fetched.ok) {
            assert.equal(fetched.data.delegateRecordId, second.data.spaceItemId);
        }
        assert.ok(harness.runViewsBatches.includes(2), `Expected batched RunViews of size 2, observed: ${harness.runViewsBatches.join(', ')}`);
    });
});
