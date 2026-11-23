import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
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
import {
    type ArtifactDelegateContext,
    BaseArtifactPermissionDelegate,
} from '@memberjunction/core-entities';
import { MJGlobal } from '@memberjunction/global';
import {
    CollaborationEngine,
    CollaborationSpaceItemArtifactPermissionDelegate,
    createSpaceDoc,
    getSpaceDoc,
    listSpaceDocs,
    LoadCollaborationSpaceItemArtifactPermissionDelegate,
    promoteSpaceDocToShared,
    updateSpaceDoc,
} from '../../dist/index.js';
import { seedAppSettings } from '../app-settings.test-support.ts';

const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';
const OWNER_ID = '11111111-1111-4111-8111-111111111401';
const TEAM_MEMBER_ID = '11111111-1111-4111-8111-111111111402';
const SHARED_PARTICIPANT_ID = '11111111-1111-4111-8111-111111111403';
const OUTSIDER_ID = '11111111-1111-4111-8111-111111111404';
const DELIVERY_PRINCIPAL_ID = '11111111-1111-4111-8111-111111111499';
const SPACE_ID = '22222222-2222-4222-8222-222222222401';
const SPACE_TYPE_ID = '33333333-3333-4333-8333-333333333401';
const ROLE_TEAM_ID = '44444444-4444-4444-8444-444444444401';
const ROLE_SHARED_CONTRIBUTOR_ID = '44444444-4444-4444-8444-444444444402';
const ROLE_SHARED_VIEWER_ID = '44444444-4444-4444-8444-444444444403';
const MARKDOWN_TYPE_ID = '55555555-5555-4555-8555-555555555401';

const ENTITY_IDS: Record<string, string> = {
    'MJ_BizApps_Collaboration: Spaces': 'E3000000-0000-4000-8000-000000000001',
    'MJ_BizApps_Collaboration: Space Items': 'E3000000-0000-4000-8000-000000000002',
    'MJ: Artifacts': 'E3000000-0000-4000-8000-000000000003',
    'MJ: Artifact Versions': 'E3000000-0000-4000-8000-000000000004',
};

function makeUser(id: string, name: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: name,
        Email: `${name.toLowerCase()}@example.com`,
        Type: type,
        IsActive: true,
        UserRoles: [],
    };
    return partial as UserInfo;
}

interface StoredArtifact {
    ID: string;
    Name: string;
    TypeID: string;
    UserID: string;
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
    Band: 'Team' | 'Shared';
    Folder: string | null;
    ArtifactVersionID: string | null;
    PromotedAt: Date | null;
    PromotedByUserID: string | null;
}

function createDocsBandMockProvider(options: { readOnlySpace?: boolean } = {}) {
    const artifacts: StoredArtifact[] = [];
    const versions: StoredVersion[] = [];
    const items: StoredItem[] = [];
    let seq = 0;

    const nextUuid = (prefix: string): string => {
        seq += 1;
        return `${prefix}000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
    };

    const typeConfig = JSON.stringify({
        Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'Always', HistoryOnAdd: 'All' },
        Agents: { ListMode: 'Extend' },
        DeliveryPrincipal: { UserID: DELIVERY_PRINCIPAL_ID, AllowFallbackToCaller: false },
    });

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
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                const spaceObj = {
                    ID: SPACE_ID,
                    SpaceTypeID: SPACE_TYPE_ID,
                    OwnerID: OWNER_ID,
                    ParentID: null as string | null,
                    Name: 'Docs Test Space',
                    ProviderToUse: providerImpl as object as IEntityDataProvider,
                    RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                    async Load() {
                        return true;
                    },
                };
                return spaceObj as object as T;
            }
            if (entityName === 'MJ: Artifacts') {
                const state: StoredArtifact = {
                    ID: '',
                    Name: '',
                    TypeID: '',
                    UserID: '',
                    DelegateEntityID: null,
                    DelegateRecordID: null,
                };
                const obj = {
                    ...state,
                    LatestResult: { CompleteMessage: '' },
                    NewRecord() {
                        obj.ID = nextUuid('A1');
                    },
                    async Load(id: string) {
                        const found = artifacts.find((a) => a.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        Object.assign(obj, found);
                        return true;
                    },
                    async Save() {
                        const existing = artifacts.find((a) => a.ID === obj.ID);
                        const copy: StoredArtifact = {
                            ID: obj.ID,
                            Name: obj.Name,
                            TypeID: obj.TypeID,
                            UserID: obj.UserID,
                            DelegateEntityID: obj.DelegateEntityID,
                            DelegateRecordID: obj.DelegateRecordID,
                        };
                        if (existing) Object.assign(existing, copy);
                        else artifacts.push(copy);
                        return true;
                    },
                    async Delete() {
                        return true;
                    },
                };
                return obj as object as T;
            }
            if (entityName === 'MJ: Artifact Versions') {
                const state: StoredVersion = {
                    ID: '',
                    ArtifactID: '',
                    VersionNumber: 1,
                    Name: '',
                    ContentMode: 'Text',
                    Content: null,
                    UserID: '',
                };
                const obj = {
                    ...state,
                    LatestResult: { CompleteMessage: '' },
                    NewRecord() {
                        obj.ID = nextUuid('B1');
                    },
                    async Save() {
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
                    Band: 'Team' as 'Team' | 'Shared',
                    Folder: null as string | null,
                    ArtifactVersionID: null as string | null,
                    PromotedAt: null as Date | null,
                    PromotedByUserID: null as string | null,
                    ProviderToUse: providerImpl as object as IEntityDataProvider,
                    RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                    LatestResult: { CompleteMessage: '' },
                    NewRecord() {
                        obj.ID = nextUuid('C1');
                    },
                    async Load(id: string) {
                        const found = items.find((i) => i.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        Object.assign(obj, found);
                        return true;
                    },
                    async Save() {
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
            return Promise.all(paramsList.map((p) => providerImpl.RunView!<T>(p)));
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
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
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                return ok([{ ID: SPACE_TYPE_ID, Configuration: typeConfig }]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                return ok([
                    { ID: 'M1', SpaceID: SPACE_ID, UserID: OWNER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                    { ID: 'M2', SpaceID: SPACE_ID, UserID: TEAM_MEMBER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                    { ID: 'M4', SpaceID: SPACE_ID, UserID: DELIVERY_PRINCIPAL_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                    {
                        ID: 'M3',
                        SpaceID: SPACE_ID,
                        UserID: SHARED_PARTICIPANT_ID,
                        SpaceRoleTypeID: ROLE_SHARED_CONTRIBUTOR_ID,
                        Band: 'Shared',
                        Status: 'Active',
                    },
                ]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                return ok([
                    {
                        ID: ROLE_TEAM_ID,
                        CanSeeTeamBand: true,
                        CanContribute: true,
                        CanCreateChildSpace: true,
                        CanPromoteBand: true,
                        CanInvite: true,
                    },
                    {
                        ID: ROLE_SHARED_CONTRIBUTOR_ID,
                        CanSeeTeamBand: false,
                        CanContribute: true,
                        CanCreateChildSpace: false,
                        CanPromoteBand: false,
                        CanInvite: false,
                    },
                    {
                        ID: ROLE_SHARED_VIEWER_ID,
                        CanSeeTeamBand: false,
                        CanContribute: false,
                        CanCreateChildSpace: false,
                        CanPromoteBand: false,
                        CanInvite: false,
                    },
                ]);
            }
            if (params.EntityName === 'MJ: Artifact Types') {
                return ok([{ ID: MARKDOWN_TYPE_ID, Name: 'Markdown Document' }]);
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
                return ok(filtered.length > 0 ? filtered : artifacts);
            }
            if (params.EntityName === 'MJ: Artifact Versions') {
                let filtered = [...versions];
                const idMatch = filter.match(/^ID\s*=\s*'([^']+)'$/i);
                if (idMatch) {
                    filtered = filtered.filter((v) => v.ID.toLowerCase() === idMatch[1].toLowerCase());
                } else {
                    const artMatch = filter.match(/ArtifactID\s*=\s*'([^']+)'/i);
                    if (artMatch) {
                        filtered = filtered
                            .filter((v) => v.ArtifactID.toLowerCase() === artMatch[1].toLowerCase())
                            .sort((a, b) => b.VersionNumber - a.VersionNumber);
                    }
                }
                return ok(filtered);
            }
            if (params.EntityName === 'MJ: Users') {
                const isPrincipal = filter.toLowerCase().includes(DELIVERY_PRINCIPAL_ID.toLowerCase());
                return ok(
                    isPrincipal
                        ? [
                              {
                                  ID: DELIVERY_PRINCIPAL_ID,
                                  Name: 'Account Delivery Principal',
                                  Email: 'delivery@example.com',
                                  Type: 'User',
                                  IsActive: true,
                              },
                          ]
                        : [],
                );
            }
            return ok([]);
        },
    };

    return {
        provider: providerImpl as IMetadataProvider,
        artifacts,
        versions,
        items,
    };
}

describe('CX-13: MJ Docs Integration Across Team & Shared Bands', () => {
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
        CollaborationEngine.Instance.SpaceTypeById = (id: string | null | undefined) => {
            if (!id || id.toLowerCase() !== SPACE_TYPE_ID.toLowerCase()) return undefined;
            return {
                ID: SPACE_TYPE_ID,
                Configuration: JSON.stringify({
                    Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'Always', HistoryOnAdd: 'All' },
                    Agents: { ListMode: 'Extend' },
                    DeliveryPrincipal: { UserID: DELIVERY_PRINCIPAL_ID, AllowFallbackToCaller: false },
                }),
            } as ReturnType<typeof origSpaceTypeById>;
        };
        CollaborationEngine.Instance.SpaceRoleTypeById = (id: string | null | undefined) => {
            if (!id) return undefined;
            if (id.toLowerCase() === ROLE_TEAM_ID.toLowerCase()) {
                return { ID: ROLE_TEAM_ID, Level: 80, MaxGrantableLevel: 80, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (id.toLowerCase() === ROLE_SHARED_CONTRIBUTOR_ID.toLowerCase()) {
                return { ID: ROLE_SHARED_CONTRIBUTOR_ID, Level: 20, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            return undefined;
        };
        CollaborationEngine.Instance.UserMayAdministerSpaces = () => false;
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        CollaborationEngine.Instance.EnsureLoaded = origEnsureLoaded;
        CollaborationEngine.Instance.EffectiveStatusForSpace = origEffectiveStatusForSpace;
        CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
        CollaborationEngine.Instance.SpaceRoleTypeById = origSpaceRoleTypeById;
        CollaborationEngine.Instance.UserMayAdministerSpaces = origUserMayAdministerSpaces;
    });

    it('registers CollaborationSpaceItemArtifactPermissionDelegate for Space Items in MJGlobal ClassFactory', () => {
        const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseArtifactPermissionDelegate>(
            BaseArtifactPermissionDelegate,
            'MJ_BizApps_Collaboration: Space Items',
        );
        assert.ok(instance instanceof CollaborationSpaceItemArtifactPermissionDelegate);
    });

    it('creates Team and Shared MJ Docs with Artifact + ArtifactVersion + SpaceItem delegation and enforces strict band visibility isolation', async () => {
        const { provider, artifacts, items } = createDocsBandMockProvider();
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');
        const sharedUser = makeUser(SHARED_PARTICIPANT_ID, 'Shared Participant');
        const outsiderUser = makeUser(OUTSIDER_ID, 'Outsider');

        const teamDoc = await createSpaceDoc({
            provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            title: 'Internal Deal Strategy',
            content: '# Confidential Team Strategy',
            band: 'Team',
            folder: '/internal',
        });
        assert.equal(teamDoc.ok, true);
        if (!teamDoc.ok) return;
        assert.equal(teamDoc.data.band, 'Team');
        assert.equal(teamDoc.data.versionNumber, 1);

        const sharedDoc = await createSpaceDoc({
            provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            title: 'Customer Mutual Plan',
            content: '# Shared Kickoff Plan',
            band: 'Shared',
        });
        assert.equal(sharedDoc.ok, true);
        if (!sharedDoc.ok) return;
        assert.equal(sharedDoc.data.band, 'Shared');

        // Verify MJ: Artifacts records have DelegateEntityID / DelegateRecordID bound to Space Items
        assert.equal(artifacts.length, 2);
        assert.equal(artifacts[0].DelegateEntityID, ENTITY_IDS['MJ_BizApps_Collaboration: Space Items']);
        assert.equal(artifacts[0].DelegateRecordID, teamDoc.data.spaceItemId);
        assert.equal(items.length, 2);

        // Team member sees Team + Shared
        const teamList = await listSpaceDocs({ provider, callerUser: teamUser, spaceId: SPACE_ID });
        assert.equal(teamList.ok, true);
        if (teamList.ok) {
            assert.equal(teamList.data.length, 2);
        }

        // Shared participant sees ONLY Shared (zero Team leakage)
        const sharedList = await listSpaceDocs({ provider, callerUser: sharedUser, spaceId: SPACE_ID });
        assert.equal(sharedList.ok, true);
        if (sharedList.ok) {
            assert.equal(sharedList.data.length, 1);
            assert.equal(sharedList.data[0].spaceItemId, sharedDoc.data.spaceItemId);
            assert.equal(sharedList.data[0].band, 'Shared');
        }

        // Shared participant explicitly requesting Team band is denied fail-closed
        const sharedTeamReq = await listSpaceDocs({
            provider,
            callerUser: sharedUser,
            spaceId: SPACE_ID,
            requestedBand: 'Team',
        });
        assert.equal(sharedTeamReq.ok, false);
        if (!sharedTeamReq.ok) assert.equal(sharedTeamReq.code, 'UNAUTHORIZED');

        // Direct getSpaceDoc / createSpaceDoc(Team) fail-closed for Shared & outsider
        const leakGet = await getSpaceDoc({ provider, callerUser: sharedUser, spaceId: SPACE_ID, spaceItemId: teamDoc.data.spaceItemId });
        assert.equal(leakGet.ok, false);
        if (!leakGet.ok) assert.equal(leakGet.code, 'UNAUTHORIZED');

        const sharedCreateTeam = await createSpaceDoc({
            provider,
            callerUser: sharedUser,
            spaceId: SPACE_ID,
            title: 'Attempted Team Doc',
            content: 'Should fail',
            band: 'Team',
        });
        assert.equal(sharedCreateTeam.ok, false);

        const outsiderList = await listSpaceDocs({ provider, callerUser: outsiderUser, spaceId: SPACE_ID });
        assert.equal(outsiderList.ok, false);
        if (!outsiderList.ok) assert.equal(outsiderList.code, 'UNAUTHORIZED');
    });

    it('enforces BaseArtifactPermissionDelegate CanRead/CanEdit/CanDelete/CanShare across bands and promotes Team docs under per-root delivery principal', async () => {
        const { provider } = createDocsBandMockProvider();
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');
        const sharedUser = makeUser(SHARED_PARTICIPANT_ID, 'Shared Participant');
        const outsiderUser = makeUser(OUTSIDER_ID, 'Outsider');

        const teamDoc = await createSpaceDoc({
            provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            title: 'Draft Proposal',
            content: 'v1',
            band: 'Team',
        });
        assert.equal(teamDoc.ok, true);
        if (!teamDoc.ok) return;

        // Update Team doc creates v2; Shared user cannot edit Team doc
        const blockedEdit = await updateSpaceDoc({
            provider,
            callerUser: sharedUser,
            spaceId: SPACE_ID,
            spaceItemId: teamDoc.data.spaceItemId,
            content: 'tampered',
        });
        assert.equal(blockedEdit.ok, false);

        const validEdit = await updateSpaceDoc({
            provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            spaceItemId: teamDoc.data.spaceItemId,
            content: 'v2 polished',
            title: 'Polished Proposal',
        });
        assert.equal(validEdit.ok, true);
        if (validEdit.ok) {
            assert.equal(validEdit.data.versionNumber, 2);
            assert.equal(validEdit.data.title, 'Polished Proposal');
        }

        const delegate = new CollaborationSpaceItemArtifactPermissionDelegate();
        const ctx: ArtifactDelegateContext = {
            Provider: provider,
            DelegateEntityID: ENTITY_IDS['MJ_BizApps_Collaboration: Space Items'],
            DelegateRecordID: teamDoc.data.spaceItemId,
            ArtifactID: teamDoc.data.artifactId,
            ArtifactOwnerUserID: teamDoc.data.authorUserId,
            DelegateEntityName: 'MJ_BizApps_Collaboration: Space Items',
        };

        assert.equal(await delegate.CanRead(ctx, teamUser), 'Allow');
        assert.equal(await delegate.CanEdit(ctx, teamUser), 'Allow');
        assert.equal(await delegate.CanShare(ctx, teamUser), 'Allow');

        // Prior to promotion, Shared user & outsider are denied on Team artifact
        assert.equal(await delegate.CanRead(ctx, sharedUser), 'Deny');
        assert.equal(await delegate.CanEdit(ctx, sharedUser), 'Deny');
        assert.equal(await delegate.CanDelete(ctx, sharedUser), 'Deny');
        assert.equal(await delegate.CanShare(ctx, sharedUser), 'Deny');
        assert.equal(await delegate.CanRead(ctx, outsiderUser), 'Deny');

        // Shared user cannot promote Team doc
        const badPromote = await promoteSpaceDocToShared({
            provider,
            callerUser: sharedUser,
            spaceId: SPACE_ID,
            spaceItemId: teamDoc.data.spaceItemId,
        });
        assert.equal(badPromote.ok, false);

        // Authorized Team user promotes to Shared -> attributed to DELIVERY_PRINCIPAL_ID
        const promoted = await promoteSpaceDocToShared({
            provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            spaceItemId: teamDoc.data.spaceItemId,
        });
        assert.equal(promoted.ok, true, promoted.ok ? '' : promoted.message);
        if (promoted.ok) {
            assert.equal(promoted.data.band, 'Shared');
            assert.equal(promoted.data.promotedByUserId, DELIVERY_PRINCIPAL_ID);
            assert.ok(promoted.data.promotedAt instanceof Date);
        }

        // After promotion, Shared user can read the doc and delegate grants CanRead + CanEdit (Shared contributor)
        assert.equal(await delegate.CanRead(ctx, sharedUser), 'Allow');
        assert.equal(await delegate.CanEdit(ctx, sharedUser), 'Allow');
        assert.equal(await delegate.CanRead(ctx, outsiderUser), 'Deny');
    });

    it('rejects doc mutations on read-only Closed spaces fail-closed', async () => {
        const { provider } = createDocsBandMockProvider({ readOnlySpace: true });
        const teamUser = makeUser(TEAM_MEMBER_ID, 'Team Member');

        const blocked = await createSpaceDoc({
            provider,
            callerUser: teamUser,
            spaceId: SPACE_ID,
            title: 'Archived Addition',
            content: 'nope',
            band: 'Shared',
        });
        assert.equal(blocked.ok, false);
        if (!blocked.ok) assert.equal(blocked.code, 'READ_ONLY');
    });
});
