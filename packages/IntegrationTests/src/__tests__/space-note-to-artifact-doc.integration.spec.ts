/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Multi-Organization Cross-Stack World Integration Suite for SpaceNote -> Native MJ: Artifacts
 * (Markdown Document) Promotion & Permission Delegation.
 *
 * Seeds a realistic enterprise world spanning:
 *   - 3 Organizations (Meridian Advisory Group, Northstar Manufacturing Corp, Solstice Logistics Ltd)
 *   - 5 People & Users across internal staff, external client contributors/viewers, and cross-org outsiders
 *   - 3 Spaces across root + inherited child hierarchy (Northstar ERP Hub -> Phase 1 Cutover, Solstice Hub)
 *   - SpaceNotes spanning Team, Shared, Private, and empty/untitled edge cases
 *
 * Verifies end-to-end promotion via `promoteSpaceNoteToDoc`, native v1 -> v2 editing via `updateSpaceDoc`,
 * Team -> Shared doc promotion via `promoteSpaceDocToShared`, `DelegateEntityID` / `DelegateRecordID`
 * enforcement via `CollaborationSpaceItemArtifactPermissionDelegate`, zero `MJ: Files` / `uploadSpaceFile`
 * invocation, `ResultType: 'simple'` + batched `RunViews`, and adversarial cross-tenant isolation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    DEFAULT_COLLABORATION_SETTINGS,
    DEFAULT_NOTE_DOCUMENT_FOLDER,
    DEFAULT_NOTE_DOCUMENT_TITLE,
    MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME,
    NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE,
    type Band,
    type CollaborationSettings,
    type NoteVisibility,
} from '@mj-biz-apps/collaboration-core';
import {
    CollaborationEngine,
    CollaborationSpaceItemArtifactPermissionDelegate,
    getSpaceDoc,
    listSpaceDocs,
    LoadCollaborationSpaceItemArtifactPermissionDelegate,
    promoteSpaceDocToShared,
    promoteSpaceNoteToDoc,
    SpaceDocMetadataCache,
    updateSpaceDoc,
} from '@mj-biz-apps/collaboration-core-entities-server';
import {
    ENTERPRISE_ORG_NAMES,
    ENTERPRISE_SPACE_NAMES,
    MERIDIAN_ORG_ID,
    NORTHSTAR_ORG_ID,
    SOLSTICE_ORG_ID,
} from '../world/enterprise-ids.js';

const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';
const ADA_OWNER_ID = 'D9000001-0000-4000-8000-000000000001';
const SAM_TEAM_ID = 'D9000001-0000-4000-8000-000000000002';
const CASEY_NORTHSTAR_SHARED_ID = 'D9000001-0000-4000-8000-000000000003';
const BEA_NORTHSTAR_VIEWER_ID = 'D9000001-0000-4000-8000-000000000004';
const HARBOR_SOLSTICE_EXT_ID = 'D9000001-0000-4000-8000-000000000005';
const DELIVERY_PRINCIPAL_ID = 'D9000001-0000-4000-8000-000000000099';

const NORTHSTAR_HUB_SPACE_ID = 'C9000001-0000-4000-8000-000000000001';
const NORTHSTAR_PHASE1_SPACE_ID = 'C9000001-0000-4000-8000-000000000002';
const SOLSTICE_HUB_SPACE_ID = 'C9000001-0000-4000-8000-000000000003';

const SPACE_TYPE_ID = 'B9000001-0000-4000-8000-000000000001';
const ROLE_OWNER_ID = 'A9000001-0000-4000-8000-000000000001';
const ROLE_TEAM_ID = 'A9000001-0000-4000-8000-000000000002';
const ROLE_SHARED_CONTRIBUTOR_ID = 'A9000001-0000-4000-8000-000000000003';
const ROLE_SHARED_VIEWER_ID = 'A9000001-0000-4000-8000-000000000004';
const MARKDOWN_TYPE_ID = 'F9000001-0000-4000-8000-000000000001';

const TEAM_NOTE_ID = '79000001-0000-4000-8000-000000000001';
const SHARED_CHILD_NOTE_ID = '79000001-0000-4000-8000-000000000002';
const PRIVATE_NOTE_ID = '79000001-0000-4000-8000-000000000003';
const UNTITLED_NOTE_ID = '79000001-0000-4000-8000-000000000004';
const SOLSTICE_SHARED_NOTE_ID = '79000001-0000-4000-8000-000000000005';

const ENTITY_IDS: Record<string, string> = {
    'MJ_BizApps_Collaboration: Spaces': 'E9100000-0000-4000-8000-000000000001',
    'MJ_BizApps_Collaboration: Space Items': 'E9100000-0000-4000-8000-000000000002',
    'MJ_BizApps_Collaboration: Space Notes': 'E9100000-0000-4000-8000-000000000003',
    'MJ: Artifacts': 'E9100000-0000-4000-8000-000000000004',
    'MJ: Artifact Versions': 'E9100000-0000-4000-8000-000000000005',
};

interface EnterpriseOrgFixture {
    id: string;
    name: string;
}

interface EnterprisePersonFixture {
    userId: string;
    name: string;
    organizationId: string;
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

interface StoredSpaceNote {
    ID: string;
    SpaceID: string;
    Title: string | null;
    Body: string | null;
    Band: Band;
    Visibility: NoteVisibility;
    AuthorUserID: string;
}

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

function createCrossStackEnterpriseWorld() {
    const organizations: EnterpriseOrgFixture[] = [
        { id: MERIDIAN_ORG_ID, name: ENTERPRISE_ORG_NAMES.meridian },
        { id: NORTHSTAR_ORG_ID, name: ENTERPRISE_ORG_NAMES.northstar },
        { id: SOLSTICE_ORG_ID, name: ENTERPRISE_ORG_NAMES.solstice },
    ];

    const people: EnterprisePersonFixture[] = [
        { userId: ADA_OWNER_ID, name: 'Ada Meridian', organizationId: MERIDIAN_ORG_ID },
        { userId: SAM_TEAM_ID, name: 'Sam Meridian', organizationId: MERIDIAN_ORG_ID },
        { userId: CASEY_NORTHSTAR_SHARED_ID, name: 'Casey Northstar', organizationId: NORTHSTAR_ORG_ID },
        { userId: BEA_NORTHSTAR_VIEWER_ID, name: 'Bea Northstar', organizationId: NORTHSTAR_ORG_ID },
        { userId: HARBOR_SOLSTICE_EXT_ID, name: 'Harbor Solstice', organizationId: SOLSTICE_ORG_ID },
    ];

    const spaces = [
        {
            ID: NORTHSTAR_HUB_SPACE_ID,
            Name: ENTERPRISE_SPACE_NAMES.northstarHub,
            ParentID: null as string | null,
            SpaceTypeID: SPACE_TYPE_ID,
            OwnerID: ADA_OWNER_ID,
            InheritsMembership: false,
            AgentRetrieval: 'Included',
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            Configuration: null as string | null,
        },
        {
            ID: NORTHSTAR_PHASE1_SPACE_ID,
            Name: ENTERPRISE_SPACE_NAMES.northstarPhase1,
            ParentID: NORTHSTAR_HUB_SPACE_ID,
            SpaceTypeID: SPACE_TYPE_ID,
            OwnerID: ADA_OWNER_ID,
            InheritsMembership: true,
            AgentRetrieval: 'Included',
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            Configuration: null as string | null,
        },
        {
            ID: SOLSTICE_HUB_SPACE_ID,
            Name: ENTERPRISE_SPACE_NAMES.solsticeHub,
            ParentID: null as string | null,
            SpaceTypeID: SPACE_TYPE_ID,
            OwnerID: ADA_OWNER_ID,
            InheritsMembership: false,
            AgentRetrieval: 'Included',
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            Configuration: null as string | null,
        },
    ];

    const memberships = [
        { ID: 'M1', SpaceID: NORTHSTAR_HUB_SPACE_ID, UserID: ADA_OWNER_ID, SpaceRoleTypeID: ROLE_OWNER_ID, Band: 'Team' as Band, Status: 'Active' },
        { ID: 'M2', SpaceID: NORTHSTAR_HUB_SPACE_ID, UserID: SAM_TEAM_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team' as Band, Status: 'Active' },
        { ID: 'M3', SpaceID: NORTHSTAR_HUB_SPACE_ID, UserID: DELIVERY_PRINCIPAL_ID, SpaceRoleTypeID: ROLE_OWNER_ID, Band: 'Team' as Band, Status: 'Active' },
        { ID: 'M4', SpaceID: NORTHSTAR_HUB_SPACE_ID, UserID: CASEY_NORTHSTAR_SHARED_ID, SpaceRoleTypeID: ROLE_SHARED_CONTRIBUTOR_ID, Band: 'Shared' as Band, Status: 'Active' },
        { ID: 'M5', SpaceID: NORTHSTAR_HUB_SPACE_ID, UserID: BEA_NORTHSTAR_VIEWER_ID, SpaceRoleTypeID: ROLE_SHARED_VIEWER_ID, Band: 'Shared' as Band, Status: 'Active' },
        { ID: 'M6', SpaceID: SOLSTICE_HUB_SPACE_ID, UserID: ADA_OWNER_ID, SpaceRoleTypeID: ROLE_OWNER_ID, Band: 'Team' as Band, Status: 'Active' },
        { ID: 'M7', SpaceID: SOLSTICE_HUB_SPACE_ID, UserID: HARBOR_SOLSTICE_EXT_ID, SpaceRoleTypeID: ROLE_SHARED_CONTRIBUTOR_ID, Band: 'Shared' as Band, Status: 'Active' },
    ];

    const notes: StoredSpaceNote[] = [
        {
            ID: TEAM_NOTE_ID,
            SpaceID: NORTHSTAR_HUB_SPACE_ID,
            Title: 'Northstar Margin & Cutover Risk Notes',
            Body: 'Keep consulting buffer at 15%.\r\n\r\nDo not share pricing table externally before sign-off.',
            Band: 'Team',
            Visibility: 'Space',
            AuthorUserID: SAM_TEAM_ID,
        },
        {
            ID: SHARED_CHILD_NOTE_ID,
            SpaceID: NORTHSTAR_PHASE1_SPACE_ID,
            Title: 'Phase 1 Cutover Runbook Notes',
            Body: '1. Freeze ERP master data.\n2. Run reconciliation batch.\n3. Sign off jointly with Northstar IT.',
            Band: 'Shared',
            Visibility: 'Space',
            AuthorUserID: ADA_OWNER_ID,
        },
        {
            ID: PRIVATE_NOTE_ID,
            SpaceID: NORTHSTAR_HUB_SPACE_ID,
            Title: 'Ada Private Executive Prep',
            Body: 'Align with CFO on renewal timing.',
            Band: 'Team',
            Visibility: 'Private',
            AuthorUserID: ADA_OWNER_ID,
        },
        {
            ID: UNTITLED_NOTE_ID,
            SpaceID: NORTHSTAR_HUB_SPACE_ID,
            Title: '   ',
            Body: null,
            Band: 'Team',
            Visibility: 'Space',
            AuthorUserID: SAM_TEAM_ID,
        },
        {
            ID: SOLSTICE_SHARED_NOTE_ID,
            SpaceID: SOLSTICE_HUB_SPACE_ID,
            Title: 'Solstice Telemetry Calibration Notes',
            Body: 'Sensor drift must remain under 0.2C during cold-chain handoff.',
            Band: 'Shared',
            Visibility: 'Space',
            AuthorUserID: HARBOR_SOLSTICE_EXT_ID,
        },
    ];

    const artifacts: StoredArtifact[] = [];
    const versions: StoredVersion[] = [];
    const items: StoredItem[] = [];
    const observedRunViews: RunViewParams[] = [];
    const observedBatchSizes: number[] = [];
    let fileEntityTouches = 0;
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
            if (entityName === 'MJ: Files') {
                fileEntityTouches += 1;
            }
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                return {
                    ID: NORTHSTAR_HUB_SPACE_ID,
                    SpaceTypeID: SPACE_TYPE_ID,
                    OwnerID: ADA_OWNER_ID,
                    ProviderToUse: providerImpl as object as IEntityDataProvider,
                    RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                } as object as T;
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
                        obj.ID = nextUuid('A9');
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
                        obj.ID = nextUuid('B9');
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
                        obj.ID = nextUuid('C9');
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
                        const idx = items.findIndex((i) => i.ID === obj.ID);
                        if (idx >= 0) items.splice(idx, 1);
                        return true;
                    },
                };
                return obj as object as T;
            }
            return {
                ProviderToUse: providerImpl as object as IEntityDataProvider,
                RunViewProviderToUse: providerImpl as object as IRunViewProvider,
            } as object as T;
        }) as object as IMetadataProvider['GetEntityObject'],
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            observedBatchSizes.push(paramsList.length);
            return Promise.all(paramsList.map((p) => providerImpl.RunView!<T>(p)));
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            observedRunViews.push(params);
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
                const idMatch = filter.match(/\bID\s*=\s*'([^']+)'/i);
                if (idMatch) {
                    return ok(spaces.filter((s) => s.ID.toLowerCase() === idMatch[1].toLowerCase()));
                }
                if (/\bID\s+IN\s*\(/i.test(filter)) {
                    return ok(spaces.filter((s) => filter.toLowerCase().includes(s.ID.toLowerCase())));
                }
                return ok(spaces);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                return ok([{ ID: SPACE_TYPE_ID, Configuration: typeConfig }]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                return ok(memberships);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                return ok([
                    { ID: ROLE_OWNER_ID, CanSeeTeamBand: true, CanContribute: true, CanCreateChildSpace: true, CanPromoteBand: true, CanInvite: true },
                    { ID: ROLE_TEAM_ID, CanSeeTeamBand: true, CanContribute: true, CanCreateChildSpace: true, CanPromoteBand: false, CanInvite: false },
                    { ID: ROLE_SHARED_CONTRIBUTOR_ID, CanSeeTeamBand: false, CanContribute: true, CanCreateChildSpace: false, CanPromoteBand: false, CanInvite: false },
                    { ID: ROLE_SHARED_VIEWER_ID, CanSeeTeamBand: false, CanContribute: false, CanCreateChildSpace: false, CanPromoteBand: false, CanInvite: false },
                ]);
            }
            if (params.EntityName === 'MJ: Artifact Types') {
                return ok([{ ID: MARKDOWN_TYPE_ID, Name: MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME }]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Notes') {
                const idMatch = filter.match(/\bID\s*=\s*'([^']+)'/i);
                const found = idMatch ? notes.filter((n) => n.ID.toLowerCase() === idMatch[1].toLowerCase()) : notes;
                return ok(found);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                const spaceMatch = filter.match(/\bSpaceID\s*=\s*'([^']+)'/i);
                const bandMatch = filter.match(/\bBand\s*=\s*'([^']+)'/i);
                const idMatch = filter.match(/\bID\s*=\s*'([^']+)'/i);
                const filtered = items.filter((item) => {
                    if (idMatch && item.ID.toLowerCase() !== idMatch[1].toLowerCase()) return false;
                    if (spaceMatch && item.SpaceID.toLowerCase() !== spaceMatch[1].toLowerCase()) return false;
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
                let filtered = [...versions];
                const idMatch = filter.match(/^ID\s*=\s*'([^']+)'$/i);
                if (idMatch) {
                    filtered = filtered.filter((v) => v.ID.toLowerCase() === idMatch[1].toLowerCase());
                } else if (/^ID\s+IN\s*\(/i.test(filter)) {
                    filtered = filtered.filter((v) => filter.toLowerCase().includes(v.ID.toLowerCase()));
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
                        ? [{ ID: DELIVERY_PRINCIPAL_ID, Name: 'Delivery Principal', Email: 'delivery@example.com', Type: 'User', IsActive: true }]
                        : [],
                );
            }
            return ok([]);
        },
    };

    return {
        organizations,
        people,
        spaces,
        memberships,
        notes,
        artifacts,
        versions,
        items,
        observedRunViews,
        observedBatchSizes,
        getFileEntityTouches: () => fileEntityTouches,
        provider: providerImpl as IMetadataProvider,
    };
}

describe('Cross-Stack World Integration: SpaceNote -> Native MJ: Artifacts Markdown Document', () => {
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let origEnsureLoaded: typeof CollaborationEngine.Instance.EnsureLoaded;
    let origEffectiveStatusForSpace: typeof CollaborationEngine.Instance.EffectiveStatusForSpace;
    let origSpaceTypeById: typeof CollaborationEngine.Instance.SpaceTypeById;
    let origSpaceRoleTypeById: typeof CollaborationEngine.Instance.SpaceRoleTypeById;
    let origUserMayAdministerSpaces: typeof CollaborationEngine.Instance.UserMayAdministerSpaces;

    beforeEach(() => {
        LoadCollaborationSpaceItemArtifactPermissionDelegate();
        SpaceDocMetadataCache.Instance.Clear();
        Object.defineProperty(CollaborationEngine.Instance, 'CollaborationSettings', {
            get: (): CollaborationSettings => DEFAULT_COLLABORATION_SETTINGS,
            configurable: true,
        });
        origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        origEnsureLoaded = CollaborationEngine.Instance.EnsureLoaded.bind(CollaborationEngine.Instance);
        origEffectiveStatusForSpace = CollaborationEngine.Instance.EffectiveStatusForSpace.bind(CollaborationEngine.Instance);
        origSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);
        origSpaceRoleTypeById = CollaborationEngine.Instance.SpaceRoleTypeById.bind(CollaborationEngine.Instance);
        origUserMayAdministerSpaces = CollaborationEngine.Instance.UserMayAdministerSpaces.bind(CollaborationEngine.Instance);

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
            const norm = id.toLowerCase();
            if (norm === ROLE_OWNER_ID.toLowerCase()) {
                return { ID: ROLE_OWNER_ID, Level: 100, MaxGrantableLevel: 100, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (norm === ROLE_TEAM_ID.toLowerCase()) {
                return { ID: ROLE_TEAM_ID, Level: 60, MaxGrantableLevel: 40, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (norm === ROLE_SHARED_CONTRIBUTOR_ID.toLowerCase()) {
                return { ID: ROLE_SHARED_CONTRIBUTOR_ID, Level: 20, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (norm === ROLE_SHARED_VIEWER_ID.toLowerCase()) {
                return { ID: ROLE_SHARED_VIEWER_ID, Level: 10, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: false } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            return undefined;
        };
        CollaborationEngine.Instance.UserMayAdministerSpaces = () => false;
    });

    afterEach(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        CollaborationEngine.Instance.EnsureLoaded = origEnsureLoaded;
        CollaborationEngine.Instance.EffectiveStatusForSpace = origEffectiveStatusForSpace;
        CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
        CollaborationEngine.Instance.SpaceRoleTypeById = origSpaceRoleTypeById;
        CollaborationEngine.Instance.UserMayAdministerSpaces = origUserMayAdministerSpaces;
        delete (CollaborationEngine.Instance as { CollaborationSettings?: CollaborationSettings }).CollaborationSettings;
        SpaceDocMetadataCache.Instance.Clear();
    });

    it('promotes Team, Shared (inherited child space), Private, and Untitled SpaceNotes into native MJ: Artifacts Markdown Documents with strict cross-org & band delegation', async () => {
        const world = createCrossStackEnterpriseWorld();
        expect(world.organizations).toHaveLength(3);
        expect(world.people).toHaveLength(5);
        expect(world.spaces).toHaveLength(3);
        expect(world.notes).toHaveLength(5);

        const ada = makeUser(ADA_OWNER_ID, 'Ada Meridian');
        const sam = makeUser(SAM_TEAM_ID, 'Sam Meridian');
        const casey = makeUser(CASEY_NORTHSTAR_SHARED_ID, 'Casey Northstar');
        const bea = makeUser(BEA_NORTHSTAR_VIEWER_ID, 'Bea Northstar');
        const harbor = makeUser(HARBOR_SOLSTICE_EXT_ID, 'Harbor Solstice');

        // 1. Sam promotes Team SpaceNote in Northstar Hub -> native Markdown Document on Team band
        const teamDoc = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: sam,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
            noteId: TEAM_NOTE_ID,
        });
        expect(teamDoc.ok).toBe(true);
        if (!teamDoc.ok) return;
        expect(teamDoc.data.band).toBe('Team');
        expect(teamDoc.data.visibility).toBe('Space');
        expect(teamDoc.data.folder).toBe(DEFAULT_NOTE_DOCUMENT_FOLDER);
        expect(teamDoc.data.artifactTypeName).toBe(MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME);
        expect(teamDoc.data.contentMode).toBe(NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE);
        expect(teamDoc.data.delegateEntityId).toBe(ENTITY_IDS['MJ_BizApps_Collaboration: Space Items']);
        expect(teamDoc.data.delegateRecordId).toBe(teamDoc.data.spaceItemId);

        // 2. Casey (Northstar Shared Contributor) promotes Shared note on inherited child space (Phase 1 Cutover)
        const childSharedDoc = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: casey,
            spaceId: NORTHSTAR_PHASE1_SPACE_ID,
            noteId: SHARED_CHILD_NOTE_ID,
        });
        expect(childSharedDoc.ok).toBe(true);
        if (!childSharedDoc.ok) return;
        expect(childSharedDoc.data.spaceId.toLowerCase()).toBe(NORTHSTAR_PHASE1_SPACE_ID.toLowerCase());
        expect(childSharedDoc.data.band).toBe('Shared');
        expect(childSharedDoc.data.visibility).toBe('Space');

        // 3. Ada promotes her own Private note -> locked to Team band; Sam (peer) is denied!
        const samPrivateAttempt = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: sam,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
            noteId: PRIVATE_NOTE_ID,
        });
        expect(samPrivateAttempt.ok).toBe(false);
        if (!samPrivateAttempt.ok) expect(samPrivateAttempt.code).toBe('UNAUTHORIZED');

        const adaPrivateDoc = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: ada,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
            noteId: PRIVATE_NOTE_ID,
        });
        expect(adaPrivateDoc.ok).toBe(true);
        if (!adaPrivateDoc.ok) return;
        expect(adaPrivateDoc.data.band).toBe('Team');
        expect(adaPrivateDoc.data.visibility).toBe('Private');

        // 4. Sam promotes an untitled/empty SpaceNote -> deterministic 'Untitled Note' Markdown Document
        const untitledDoc = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: sam,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
            noteId: UNTITLED_NOTE_ID,
        });
        expect(untitledDoc.ok).toBe(true);
        if (!untitledDoc.ok) return;
        expect(untitledDoc.data.title).toBe(DEFAULT_NOTE_DOCUMENT_TITLE);
        expect(untitledDoc.data.content).toBe(`# ${DEFAULT_NOTE_DOCUMENT_TITLE}\n\n`);

        // 5. Harbor (Solstice) promotes Solstice Shared note -> isolated to Solstice Hub
        const solsticeDoc = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: harbor,
            spaceId: SOLSTICE_HUB_SPACE_ID,
            noteId: SOLSTICE_SHARED_NOTE_ID,
        });
        expect(solsticeDoc.ok).toBe(true);
        if (!solsticeDoc.ok) return;
        expect(solsticeDoc.data.spaceId.toLowerCase()).toBe(SOLSTICE_HUB_SPACE_ID.toLowerCase());
        expect(solsticeDoc.data.band).toBe('Shared');

        // 6. Adversarial cross-tenant & role boundary checks (zero additional artifacts created)
        const artifactCountBeforeAdversarial = world.artifacts.length;

        const caseyOnTeamNote = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: casey,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
            noteId: TEAM_NOTE_ID,
        });
        expect(caseyOnTeamNote.ok).toBe(false);
        if (!caseyOnTeamNote.ok) expect(caseyOnTeamNote.code).toBe('UNAUTHORIZED');

        const beaViewerOnSharedNote = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: bea,
            spaceId: NORTHSTAR_PHASE1_SPACE_ID,
            noteId: SHARED_CHILD_NOTE_ID,
        });
        expect(beaViewerOnSharedNote.ok).toBe(false);
        if (!beaViewerOnSharedNote.ok) expect(beaViewerOnSharedNote.code).toBe('UNAUTHORIZED');

        const harborOnNorthstarNote = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: harbor,
            spaceId: NORTHSTAR_PHASE1_SPACE_ID,
            noteId: SHARED_CHILD_NOTE_ID,
        });
        expect(harborOnNorthstarNote.ok).toBe(false);
        if (!harborOnNorthstarNote.ok) expect(harborOnNorthstarNote.code).toBe('UNAUTHORIZED');

        const caseyOnSolsticeNote = await promoteSpaceNoteToDoc({
            provider: world.provider,
            callerUser: casey,
            spaceId: SOLSTICE_HUB_SPACE_ID,
            noteId: SOLSTICE_SHARED_NOTE_ID,
        });
        expect(caseyOnSolsticeNote.ok).toBe(false);
        if (!caseyOnSolsticeNote.ok) expect(caseyOnSolsticeNote.code).toBe('UNAUTHORIZED');

        expect(world.artifacts.length).toBe(artifactCountBeforeAdversarial);

        // 7. Verify BaseArtifactPermissionDelegate enforcement across bands & organizations
        const delegate = MJGlobal.Instance.ClassFactory.CreateInstance<BaseArtifactPermissionDelegate>(
            BaseArtifactPermissionDelegate,
            'MJ_BizApps_Collaboration: Space Items',
        );
        expect(delegate).toBeInstanceOf(CollaborationSpaceItemArtifactPermissionDelegate);
        if (!delegate) return;

        const teamCtx: ArtifactDelegateContext = {
            Provider: world.provider,
            DelegateEntityID: teamDoc.data.delegateEntityId,
            DelegateRecordID: teamDoc.data.delegateRecordId,
            ArtifactID: teamDoc.data.artifactId,
            ArtifactOwnerUserID: teamDoc.data.authorUserId,
            DelegateEntityName: 'MJ_BizApps_Collaboration: Space Items',
        };
        expect(await delegate.CanRead(teamCtx, ada)).toBe('Allow');
        expect(await delegate.CanRead(teamCtx, sam)).toBe('Allow');
        expect(await delegate.CanRead(teamCtx, casey)).toBe('Deny');
        expect(await delegate.CanRead(teamCtx, bea)).toBe('Deny');
        expect(await delegate.CanRead(teamCtx, harbor)).toBe('Deny');

        const childSharedCtx: ArtifactDelegateContext = {
            Provider: world.provider,
            DelegateEntityID: childSharedDoc.data.delegateEntityId,
            DelegateRecordID: childSharedDoc.data.delegateRecordId,
            ArtifactID: childSharedDoc.data.artifactId,
            ArtifactOwnerUserID: childSharedDoc.data.authorUserId,
            DelegateEntityName: 'MJ_BizApps_Collaboration: Space Items',
        };
        expect(await delegate.CanRead(childSharedCtx, casey)).toBe('Allow');
        expect(await delegate.CanEdit(childSharedCtx, casey)).toBe('Allow');
        expect(await delegate.CanRead(childSharedCtx, bea)).toBe('Allow');
        expect(await delegate.CanEdit(childSharedCtx, bea)).toBe('Deny');
        expect(await delegate.CanRead(childSharedCtx, harbor)).toBe('Deny');

        // 8. Native editability (v1 -> v2) and Team -> Shared promotion under Delivery Principal
        const v2 = await updateSpaceDoc({
            provider: world.provider,
            callerUser: ada,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
            spaceItemId: teamDoc.data.spaceItemId,
            content: '# Northstar Margin & Cutover Risk Notes\n\nApproved executive summary for customer review.\n',
        });
        expect(v2.ok).toBe(true);
        if (v2.ok) expect(v2.data.versionNumber).toBe(2);

        const promotedToShared = await promoteSpaceDocToShared({
            provider: world.provider,
            callerUser: ada,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
            spaceItemId: teamDoc.data.spaceItemId,
        });
        expect(promotedToShared.ok).toBe(true);
        if (promotedToShared.ok) {
            expect(promotedToShared.data.band).toBe('Shared');
            expect(promotedToShared.data.promotedByUserId).toBe(DELIVERY_PRINCIPAL_ID);
        }

        // Casey now reads ONLY the promoted Shared doc on Northstar Hub (still denied Ada's Private & Untitled Team docs)
        const caseyHubDocs = await listSpaceDocs({
            provider: world.provider,
            callerUser: casey,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
        });
        expect(caseyHubDocs.ok).toBe(true);
        if (caseyHubDocs.ok) {
            expect(caseyHubDocs.data).toHaveLength(1);
            expect(caseyHubDocs.data[0].spaceItemId).toBe(teamDoc.data.spaceItemId);
        }

        const caseyPrivateFetch = await getSpaceDoc({
            provider: world.provider,
            callerUser: casey,
            spaceId: NORTHSTAR_HUB_SPACE_ID,
            spaceItemId: adaPrivateDoc.data.spaceItemId,
        });
        expect(caseyPrivateFetch.ok).toBe(false);

        // 9. Verify zero MJ: Files touches, all space-docs RunView queries use ResultType:'simple' (never entity_object), and RunViews batching was used
        expect(world.getFileEntityTouches()).toBe(0);
        expect(world.observedRunViews.length).toBeGreaterThan(0);
        const spaceDocEntities = new Set([
            'MJ_BizApps_Collaboration: Space Notes',
            'MJ_BizApps_Collaboration: Space Items',
            'MJ: Artifacts',
            'MJ: Artifact Versions',
            'MJ: Artifact Types',
        ]);
        const spaceDocQueries = world.observedRunViews.filter((rv) => !!rv.EntityName && spaceDocEntities.has(rv.EntityName));
        expect(spaceDocQueries.length).toBeGreaterThan(0);
        expect(spaceDocQueries.every((rv) => rv.ResultType === 'simple')).toBe(true);
        expect(world.observedRunViews.every((rv) => rv.ResultType !== 'entity_object')).toBe(true);
        expect(world.observedBatchSizes).toContain(2);
    });
});
