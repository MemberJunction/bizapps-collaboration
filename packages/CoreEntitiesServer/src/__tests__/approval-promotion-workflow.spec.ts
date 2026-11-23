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
    CollaborationEngine,
    createSpaceDraftApprovalTask,
    decideAndPromoteSpaceDraft,
    getSpaceApprovalTask,
    listSpaceApprovalTasks,
} from '../../dist/index.js';
import { seedAppSettings } from '../app-settings.test-support.ts';

const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';
const TEAM_AUTHOR_ID = '11111111-1111-4111-8111-111111111301';
const TEAM_APPROVER_ID = '11111111-1111-4111-8111-111111111302';
const SHARED_PARTICIPANT_ID = '11111111-1111-4111-8111-111111111303';
const DELIVERY_PRINCIPAL_ID = '11111111-1111-4111-8111-111111111399';
const SPACE_ID = '22222222-2222-4222-8222-222222222301';
const SPACE_TYPE_ID = '33333333-3333-4333-8333-333333333301';
const ROLE_TEAM_PROMOTE_ID = '44444444-4444-4444-8444-444444444301';
const ROLE_SHARED_ID = '44444444-4444-4444-8444-444444444302';
const APPROVAL_TYPE_ID = '55555555-5555-4555-8555-555555555301';
const OUTCOME_APPROVED_ID = '66666666-6666-4666-8666-666666666301';
const OUTCOME_REJECTED_ID = '66666666-6666-4666-8666-666666666302';
const ROOT_ENTITY_ID = '77777777-7777-4777-8777-777777777301';
const ROOT_RECORD_ID = '77777777-7777-4777-8777-777777777302';

const ENTITY_IDS: Record<string, string> = {
    'MJ_BizApps_Collaboration: Spaces': 'E2000000-0000-4000-8000-000000000001',
    'MJ_BizApps_Collaboration: Space Items': 'E2000000-0000-4000-8000-000000000002',
    'MJ_BizApps_Tasks: Tasks': 'E2000000-0000-4000-8000-000000000003',
    'MJ_BizApps_Tasks: Task Links': 'E2000000-0000-4000-8000-000000000004',
    'MJ: Artifacts': 'E2000000-0000-4000-8000-000000000005',
};

function makeUser(id: string, name: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const u: Partial<UserInfo> = { ID: id, Name: name, Email: `${name.toLowerCase()}@example.com`, Type: type, IsActive: true, UserRoles: [] };
    return u as UserInfo;
}

interface StoredTask { ID: string; Name: string; Description: string | null; TypeID: string; Status: string; Priority: string; ParentID: string | null; CreatedByPersonID: string | null; CompletedAt: Date | null; CompletionNotes: string | null }
interface StoredLink { ID: string; TaskID: string; EntityID: string; RecordID: string; Description: string | null }
interface StoredDecision { ID: string; TaskID: string; OutcomeID: string; DecidedByPersonID: string | null; DecisionNotes: string | null }
interface StoredItem { ID: string; SpaceID: string; EntityID: string; RecordID: string; Band: 'Team' | 'Shared'; Folder: string | null; ArtifactVersionID: string | null; PromotedAt: Date | null; PromotedByUserID: string | null }
interface StoredArtifact { ID: string; Name: string; TypeID: string; UserID: string; DelegateEntityID: string | null; DelegateRecordID: string | null }
interface StoredVersion { ID: string; ArtifactID: string; VersionNumber: number; Name: string; ContentMode: string; Content: string | null; UserID: string }

function createApprovalMockProvider() {
    const tasks: StoredTask[] = [];
    const links: StoredLink[] = [];
    const decisions: StoredDecision[] = [];
    const activities: Array<{ ID: string; TaskID: string; NewValue: string | null; Description: string | null }> = [];
    const items: StoredItem[] = [];
    const artifacts: StoredArtifact[] = [];
    const versions: StoredVersion[] = [];
    const auditLogs: Array<{ userId: string; details: string | null }> = [];
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

    const providerImpl: Partial<IMetadataProvider & IRunViewProvider> & {
        CreateAuditLogRecord: (u: UserInfo, a: string | null, t: string, s: string, details: string | null) => Promise<BaseEntity | null>;
    } = {
        Entities: [],
        EntityByName(name: string): EntityInfo | undefined {
            const id = ENTITY_IDS[name];
            if (!id) return undefined;
            const info: Partial<EntityInfo> = { ID: id, Name: name, PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' } as EntityInfo['PrimaryKeys'][number]], Fields: [] };
            return info as EntityInfo;
        },
        EntityByID(): EntityInfo | undefined {
            return undefined;
        },
        async CreateAuditLogRecord(user, _a, _t, _s, details) {
            auditLogs.push({ userId: user.ID, details });
            const r: Partial<BaseEntity> = {};
            return r as BaseEntity;
        },
        GetEntityObject: (async <T extends BaseEntity>(
            entityName: string,
            contextUserOrKey?: UserInfo | CompositeKey,
            contextUserArg?: UserInfo,
        ): Promise<T> => {
            const contextUser = contextUserOrKey instanceof CompositeKey ? contextUserArg : contextUserOrKey;
            if (entityName === 'MJ: Artifacts') {
                const row: StoredArtifact = { ID: '', Name: '', TypeID: '', UserID: '', DelegateEntityID: null, DelegateRecordID: null };
                const obj = {
                    ...row,
                    NewRecord() { obj.ID = nextUuid('A0'); },
                    async Load(id: string) {
                        const found = artifacts.find((a) => a.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        Object.assign(obj, found);
                        return true;
                    },
                    async Save() {
                        const existing = artifacts.find((a) => a.ID === obj.ID);
                        const copy: StoredArtifact = { ID: obj.ID, Name: obj.Name, TypeID: obj.TypeID, UserID: obj.UserID, DelegateEntityID: obj.DelegateEntityID, DelegateRecordID: obj.DelegateRecordID };
                        if (existing) Object.assign(existing, copy);
                        else artifacts.push(copy);
                        return true;
                    },
                    async Delete() { return true; },
                };
                return obj as object as T;
            }
            if (entityName === 'MJ: Artifact Versions') {
                const row: StoredVersion = { ID: '', ArtifactID: '', VersionNumber: 1, Name: '', ContentMode: 'Text', Content: null, UserID: '' };
                const obj = {
                    ...row,
                    NewRecord() { obj.ID = nextUuid('B0'); },
                    async Save() {
                        versions.push({ ID: obj.ID, ArtifactID: obj.ArtifactID, VersionNumber: obj.VersionNumber, Name: obj.Name, ContentMode: obj.ContentMode, Content: obj.Content, UserID: obj.UserID });
                        return true;
                    },
                    async Delete() { return true; },
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
                    NewRecord() { obj.ID = nextUuid('C0'); },
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
                    async Delete() { return true; },
                };
                return obj as object as T;
            }
            if (entityName === 'MJ_BizApps_Tasks: Tasks') {
                const obj = {
                    ID: '',
                    Name: '',
                    Description: null as string | null,
                    TypeID: '',
                    Status: 'Open',
                    Priority: 'High',
                    ParentID: null as string | null,
                    CreatedByPersonID: null as string | null,
                    CompletedAt: null as Date | null,
                    CompletionNotes: null as string | null,
                    NewRecord() { obj.ID = nextUuid('D0'); },
                    async Load(id: string) {
                        const found = tasks.find((t) => t.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        Object.assign(obj, found);
                        return true;
                    },
                    async Save() {
                        const existing = tasks.find((t) => t.ID === obj.ID);
                        const copy: StoredTask = {
                            ID: obj.ID, Name: obj.Name, Description: obj.Description, TypeID: obj.TypeID, Status: obj.Status, Priority: obj.Priority, ParentID: obj.ParentID, CreatedByPersonID: obj.CreatedByPersonID, CompletedAt: obj.CompletedAt, CompletionNotes: obj.CompletionNotes,
                        };
                        if (existing) Object.assign(existing, copy);
                        else tasks.push(copy);
                        return true;
                    },
                    async Delete() { return true; },
                };
                return obj as object as T;
            }
            if (entityName === 'MJ_BizApps_Tasks: Task Links') {
                const obj = {
                    ID: '',
                    TaskID: '',
                    EntityID: '',
                    RecordID: '',
                    Description: null as string | null,
                    NewRecord() { obj.ID = nextUuid('E0'); },
                    async Save() {
                        links.push({ ID: obj.ID, TaskID: obj.TaskID, EntityID: obj.EntityID, RecordID: obj.RecordID, Description: obj.Description });
                        return true;
                    },
                };
                return obj as object as T;
            }
            if (entityName === 'MJ_BizApps_Tasks: Task Decisions') {
                const obj = {
                    ID: '',
                    TaskID: '',
                    OutcomeID: '',
                    DecidedByPersonID: null as string | null,
                    DecisionNotes: null as string | null,
                    NewRecord() { obj.ID = nextUuid('F0'); },
                    async Save() {
                        decisions.push({ ID: obj.ID, TaskID: obj.TaskID, OutcomeID: obj.OutcomeID, DecidedByPersonID: obj.DecidedByPersonID, DecisionNotes: obj.DecisionNotes });
                        return true;
                    },
                    async Delete() { return true; },
                };
                return obj as object as T;
            }
            if (entityName === 'MJ_BizApps_Tasks: Task Activities') {
                const obj = {
                    ID: '',
                    TaskID: '',
                    ActivityType: '',
                    NewValue: null as string | null,
                    Description: null as string | null,
                    NewRecord() { obj.ID = nextUuid('F1'); },
                    async Save() {
                        activities.push({ ID: obj.ID, TaskID: obj.TaskID, NewValue: obj.NewValue, Description: obj.Description });
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
                ExecutionTime: 0,
                ErrorMessage: '',
            });
            switch (params.EntityName) {
                case 'MJ_BizApps_Collaboration: Spaces':
                    return ok([{ ID: SPACE_ID, ParentID: null, SpaceTypeID: SPACE_TYPE_ID, OwnerID: TEAM_APPROVER_ID, InheritsMembership: false, AgentRetrieval: 'Included', ClosedAt: null, StatusID: null, Configuration: null }]);
                case 'MJ_BizApps_Collaboration: Space Types':
                    return ok([{ ID: SPACE_TYPE_ID, Code: 'subtyped', Name: 'Subtyped', Configuration: typeConfig }]);
                case 'MJ_BizApps_Collaboration: Space Members':
                    return ok([
                        { ID: 'M1', SpaceID: SPACE_ID, UserID: TEAM_AUTHOR_ID, SpaceRoleTypeID: ROLE_TEAM_PROMOTE_ID, Band: 'Team', Status: 'Active' },
                        { ID: 'M2', SpaceID: SPACE_ID, UserID: TEAM_APPROVER_ID, SpaceRoleTypeID: ROLE_TEAM_PROMOTE_ID, Band: 'Team', Status: 'Active' },
                        { ID: 'M3', SpaceID: SPACE_ID, UserID: SHARED_PARTICIPANT_ID, SpaceRoleTypeID: ROLE_SHARED_ID, Band: 'Shared', Status: 'Active' },
                    ]);
                case 'MJ_BizApps_Collaboration: Space Role Types':
                    return ok([
                        { ID: ROLE_TEAM_PROMOTE_ID, Level: 80, MaxGrantableLevel: 80, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
                        { ID: ROLE_SHARED_ID, Level: 20, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true },
                    ]);
                case 'MJ: Artifact Types':
                    return ok([{ ID: 'ART-TYPE-MD', Name: 'Markdown Document' }]);
                case 'MJ_BizApps_Tasks: Task Types':
                    return ok([{ ID: APPROVAL_TYPE_ID, Code: 'APPROVAL_REQUEST' }]);
                case 'MJ_BizApps_Tasks: Task Decision Outcomes':
                    return ok([
                        { ID: OUTCOME_APPROVED_ID, Code: 'Approved', IsApproval: true },
                        { ID: OUTCOME_REJECTED_ID, Code: 'Rejected', IsApproval: false },
                    ]);
                case 'MJ_BizApps_Collaboration: Space Items': {
                    const f = String(params.ExtraFilter ?? '');
                    if (f.includes(`EntityID = '${ENTITY_IDS['MJ_BizApps_Tasks: Tasks']}'`)) {
                        return ok(items.filter((i) => i.EntityID === ENTITY_IDS['MJ_BizApps_Tasks: Tasks'] && i.Band === 'Team'));
                    }
                    return ok(items);
                }
                case 'MJ_BizApps_Tasks: Tasks':
                    return ok(tasks);
                case 'MJ_BizApps_Tasks: Task Links':
                    return ok(links);
                case 'MJ_BizApps_Collaboration: Space Anchors':
                    return ok([{ EntityID: ROOT_ENTITY_ID, RecordID: `ID|${ROOT_RECORD_ID}` }]);
                case 'MJ: Users':
                    return ok([{ ID: DELIVERY_PRINCIPAL_ID, Name: 'Delivery Principal', Email: 'principal@example.com', Type: 'User', IsActive: true }]);
                case 'MJ: User Roles':
                    return ok([{ ID: 'UR1', UserID: DELIVERY_PRINCIPAL_ID, RoleID: ROLE_TEAM_PROMOTE_ID, Role: 'Member' }]);
                default:
                    return ok([]);
            }
        },
    };

    return { provider: providerImpl as IMetadataProvider, tasks, links, decisions, activities, items, auditLogs };
}

describe('CA-2 & CA-3: approval-promotion-workflow.spec.ts', () => {
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let origEngineSpaceTypeById: typeof CollaborationEngine.Instance.SpaceTypeById;
    let origEngineRoleById: typeof CollaborationEngine.Instance.SpaceRoleTypeById;
    let origEngineStatusForSpace: typeof CollaborationEngine.Instance.EffectiveStatusForSpace;
    let origEngineEnsureLoaded: typeof CollaborationEngine.Instance.EnsureLoaded;
    let origMayAdminister: typeof CollaborationEngine.Instance.UserMayAdministerSpaces;
    let restoreAppSettings: () => void;

    before(() => {
        restoreAppSettings = seedAppSettings();
        origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_ID, 'System', 'Owner');
        origEngineSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);
        origEngineRoleById = CollaborationEngine.Instance.SpaceRoleTypeById.bind(CollaborationEngine.Instance);
        origEngineStatusForSpace = CollaborationEngine.Instance.EffectiveStatusForSpace.bind(CollaborationEngine.Instance);
        origEngineEnsureLoaded = CollaborationEngine.Instance.EnsureLoaded.bind(CollaborationEngine.Instance);
        origMayAdminister = CollaborationEngine.Instance.UserMayAdministerSpaces.bind(CollaborationEngine.Instance);

        CollaborationEngine.Instance.EnsureLoaded = async () => undefined;
        CollaborationEngine.Instance.UserMayAdministerSpaces = () => false;
        CollaborationEngine.Instance.SpaceTypeById = () => undefined;
        CollaborationEngine.Instance.EffectiveStatusForSpace = () => undefined;
        CollaborationEngine.Instance.SpaceRoleTypeById = (id: string | null | undefined) => {
            if (id === ROLE_TEAM_PROMOTE_ID) {
                return { ID: ROLE_TEAM_PROMOTE_ID, Level: 80, MaxGrantableLevel: 80, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true } as ReturnType<typeof CollaborationEngine.Instance.SpaceRoleTypeById>;
            }
            if (id === ROLE_SHARED_ID) {
                return { ID: ROLE_SHARED_ID, Level: 20, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true } as ReturnType<typeof CollaborationEngine.Instance.SpaceRoleTypeById>;
            }
            return undefined;
        };
    });

    after(() => {
        restoreAppSettings();
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        CollaborationEngine.Instance.SpaceTypeById = origEngineSpaceTypeById;
        CollaborationEngine.Instance.SpaceRoleTypeById = origEngineRoleById;
        CollaborationEngine.Instance.EffectiveStatusForSpace = origEngineStatusForSpace;
        CollaborationEngine.Instance.EnsureLoaded = origEngineEnsureLoaded;
        CollaborationEngine.Instance.UserMayAdministerSpaces = origMayAdminister;
    });

    it('creates Task + TaskLinks for Team draft, blocks Shared-band queries, and promotes atomically upon approval under per-root principal', async () => {
        const harness = createApprovalMockProvider();
        const author = makeUser(TEAM_AUTHOR_ID, 'TeamAuthor');
        const approver = makeUser(TEAM_APPROVER_ID, 'TeamApprover');
        const sharedUser = makeUser(SHARED_PARTICIPANT_ID, 'SharedUser');

        // 1. Create Team-band draft + linked APPROVAL_REQUEST Task
        const created = await createSpaceDraftApprovalTask({
            provider: harness.provider,
            callerUser: author,
            spaceId: SPACE_ID,
            title: 'Q4 Partner Announcement',
            content: '# Summary\nDraft content pending approval.',
            rootEntityId: ROOT_ENTITY_ID,
            rootRecordId: ROOT_RECORD_ID,
        });
        assert.equal(created.ok, true);
        if (!created.ok) return;

        assert.equal(created.data.band, 'Team');
        assert.equal(created.data.taskLinkIds.length, 3);
        assert.equal(harness.links.some((l) => l.TaskID === created.data.taskId && l.Description === 'TeamDraftSpaceItem'), true);

        // 2. Shared-band participant MUST NOT be able to enumerate or read draft approval tasks
        const sharedList = await listSpaceApprovalTasks({
            provider: harness.provider,
            callerUser: sharedUser,
            spaceId: SPACE_ID,
        });
        assert.equal(sharedList.ok, false);
        if (!sharedList.ok) assert.equal(sharedList.code, 'PRIVACY_DENIED');

        const sharedGet = await getSpaceApprovalTask({
            provider: harness.provider,
            callerUser: sharedUser,
            spaceId: SPACE_ID,
            taskId: created.data.taskId,
        });
        assert.equal(sharedGet.ok, false);

        // Shared-band participant MUST NOT be able to approve/promote
        const sharedApprove = await decideAndPromoteSpaceDraft({
            provider: harness.provider,
            approverUser: sharedUser,
            spaceId: SPACE_ID,
            taskId: created.data.taskId,
            decision: 'Approved',
        });
        assert.equal(sharedApprove.ok, false);
        if (!sharedApprove.ok) assert.equal(sharedApprove.code, 'PRIVACY_DENIED');

        // Team member CAN enumerate draft approval task before approval
        const teamList = await listSpaceApprovalTasks({
            provider: harness.provider,
            callerUser: approver,
            spaceId: SPACE_ID,
        });
        assert.equal(teamList.ok, true);
        if (teamList.ok) assert.equal(teamList.data.length, 1);

        // 3. Approve -> atomically promotes draft SpaceItem to Shared attributed to DELIVERY_PRINCIPAL_ID
        const promoted = await decideAndPromoteSpaceDraft({
            provider: harness.provider,
            approverUser: approver,
            spaceId: SPACE_ID,
            taskId: created.data.taskId,
            decision: 'Approved',
            decisionNotes: 'Verified and approved.',
        });
        assert.equal(promoted.ok, true);
        if (!promoted.ok) return;

        assert.equal(promoted.data.band, 'Shared');
        assert.equal(promoted.data.taskStatus, 'Completed');
        assert.equal(promoted.data.promotedByPrincipalUserId, DELIVERY_PRINCIPAL_ID);
        assert.notEqual(promoted.data.promotedByPrincipalUserId, TEAM_APPROVER_ID);
        assert.equal(harness.decisions.length, 1);
        assert.equal(harness.auditLogs.some((a) => a.userId === DELIVERY_PRINCIPAL_ID && (a.details ?? '').includes('DraftPromotedToShared')), true);
    });

    it('keeps draft strictly on Team band when approval task is rejected', async () => {
        const harness = createApprovalMockProvider();
        const author = makeUser(TEAM_AUTHOR_ID, 'TeamAuthor');
        const approver = makeUser(TEAM_APPROVER_ID, 'TeamApprover');

        const created = await createSpaceDraftApprovalTask({
            provider: harness.provider,
            callerUser: author,
            spaceId: SPACE_ID,
            title: 'Unapproved Draft',
            content: 'Should remain Team-private on rejection.',
        });
        assert.equal(created.ok, true);
        if (!created.ok) return;

        const rejected = await decideAndPromoteSpaceDraft({
            provider: harness.provider,
            approverUser: approver,
            spaceId: SPACE_ID,
            taskId: created.data.taskId,
            decision: 'Rejected',
            decisionNotes: 'Needs revision.',
        });
        assert.equal(rejected.ok, true);
        if (!rejected.ok) return;

        assert.equal(rejected.data.band, 'Team');
        assert.equal(rejected.data.taskStatus, 'Cancelled');
        assert.equal(rejected.data.promotedByPrincipalUserId, null);
        const draftRow = harness.items.find((i) => i.ID === created.data.draftSpaceItemId);
        assert.equal(draftRow?.Band, 'Team');
    });
});
