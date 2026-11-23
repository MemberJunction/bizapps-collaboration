import {
    AuthorizationInfo,
    AuthorizationRoleInfo,
    EntityFieldInfo,
    EntityInfo,
    EntityPermissionInfo,
    type IMetadataProvider,
    RowLevelSecurityFilterInfo,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
    UserRoleInfo,
} from '@memberjunction/core';
import {
    COLLABORATION_APPLICATION_ID,
    COLLABORATION_BOOT_ENTITY_REGISTRY,
    COLLABORATION_POLYMORPHIC_FK_SPECS,
    COLLABORATION_ROOT_AUTHORIZATION_NAME,
    COLLABORATION_SCHEMA_NAME,
    LIFECYCLE_COLLABORATION_AUTHORIZATION_NAME,
    PARTICIPANT_ROLE_ID,
    type SqlDialect,
    STAFF_COLLABORATION_AUTHORIZATION_NAMES,
} from '../index.js';

export const ROLE_UI_ID = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E';
export const ROLE_DEVELOPER_ID = 'E1AFCCEC-6A37-EF11-86D4-000D3A4E707E';
export const ROLE_INTEGRATION_ID = 'E2AFCCEC-6A37-EF11-86D4-000D3A4E707E';

export const USER_DEV_ID = 'D2000001-0000-4000-8000-000000000013';
export const USER_ADA_ID = 'D2000001-0000-4000-8000-000000000001';
export const USER_SAM_ID = 'D2000001-0000-4000-8000-000000000002';
export const USER_CASEY_ID = 'D2000001-0000-4000-8000-000000000003';
export const USER_BEA_ID = 'D2000001-0000-4000-8000-000000000004';
export const USER_DANA_ID = 'D2000001-0000-4000-8000-000000000005';
export const USER_HARPER_ID = 'D2000001-0000-4000-8000-000000000010';
export const USER_NORA_ID = 'D2000001-0000-4000-8000-000000000008';

export const SPACE_NORTHWIND_ID = 'C1000001-0000-4000-8000-000000000001';
export const SPACE_DISCOVERY_ID = 'C1000001-0000-4000-8000-000000000002';
export const SPACE_DELIVERY_ID = 'C1000001-0000-4000-8000-000000000003';
export const SPACE_COMMITTEE_ID = 'C1000001-0000-4000-8000-000000000004';
export const SPACE_HARBOR_ID = 'C1000001-0000-4000-8000-000000000006';
export const SPACE_STAFF_ONLY_ID = 'C1000001-0000-4000-8000-000000000099';

export const SPACE_TYPE_RELATIONSHIP_ID = 'B1000001-0000-4000-8000-000000000001';
export const SPACE_TYPE_PROJECT_ID = 'B1000001-0000-4000-8000-000000000002';
export const SPACE_TYPE_STAFF_ONLY_ID = 'B1000001-0000-4000-8000-000000000003';

export const SPACE_ROLE_OWNER_ID = '69090145-C214-4C16-83C5-9D0F1F3B6DE4';
export const SPACE_ROLE_ADMIN_ID = 'A034CE11-387E-4F57-87E4-18FC33F2B9CD';
export const SPACE_ROLE_MEMBER_ID = '03AD14E2-341A-4AC6-BA9D-E7AA5B31647B';
export const SPACE_ROLE_GUEST_ID = '59EF903B-AF53-4479-B459-FCB21410EE4C';
export const SPACE_ROLE_CLIENT_ADMIN_ID = '5CAB9346-3BD4-4898-B8DB-D6D045E1A09A';
export const SPACE_ROLE_CLIENT_MEMBER_ID = '7F565CD3-5E5C-4073-AD3D-55EFE85B0D40';

export type AuditDataRow = Record<string, string | number | boolean | null | undefined>;

export interface AuditTestWorldData {
    Dialect: SqlDialect;
    Entities: EntityInfo[];
    Authorizations: AuthorizationInfo[];
    AuthorizationRoles: AuthorizationRoleInfo[];
    RlsFilters: AuditDataRow[];
    Users: AuditDataRow[];
    UserRoles: AuditDataRow[];
    ApplicationRoles: AuditDataRow[];
    SpaceTypes: AuditDataRow[];
    SpaceRoleTypes: AuditDataRow[];
    Spaces: AuditDataRow[];
    SpaceMembers: AuditDataRow[];
    SpaceAnchors: AuditDataRow[];
    SpaceItems: AuditDataRow[];
    SpaceGrants: AuditDataRow[];
    SpaceMemberPins: AuditDataRow[];
    SpaceAgentSourceReceipts: AuditDataRow[];
    Files: AuditDataRow[];
    AIAgents: AuditDataRow[];
    CustomPolymorphicRows?: Record<string, AuditDataRow[]>;
    CapturedRunViewCalls: RunViewParams[];
    GetEntityObjectCallCount: number;
}

export function makeUserInfo(params: {
    ID: string;
    Name?: string;
    Email?: string;
    Type?: 'User' | 'Owner';
    RoleIDs: readonly string[];
    IsMagicLinkAnonymous?: boolean;
    MagicLinkScope?: { ResourceID?: string; ResourceType?: string };
}): UserInfo {
    const roles: UserRoleInfo[] = params.RoleIDs.map((roleId) => {
        return new UserRoleInfo({ UserID: params.ID, RoleID: roleId });
    });
    const user: Partial<UserInfo> = {
        ID: params.ID,
        Name: params.Name ?? 'Test User',
        Email: params.Email ?? 'test@example.com',
        Type: params.Type ?? 'User',
        IsActive: true,
        UserRoles: roles,
        IsMagicLinkAnonymous: params.IsMagicLinkAnonymous ?? false,
        MagicLinkScope: params.MagicLinkScope,
    };
    return user as UserInfo;
}

function deterministicUuid(seed: string): string {
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    let h3 = 0x85ebca6b;
    let h4 = 0xc2b2ae35;
    for (let i = 0; i < seed.length; i += 1) {
        const ch = seed.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 0x01000193);
        h2 = Math.imul(h2 ^ (ch + i), 0x01000193);
        h3 = Math.imul(h3 ^ (ch * 3), 0x01000193);
        h4 = Math.imul(h4 ^ (ch + 17), 0x01000193);
    }
    const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
    const a = hex(h1);
    const b = hex(h2).slice(0, 4);
    const c = `4${hex(h2).slice(5, 8)}`;
    const d = `8${hex(h3).slice(1, 4)}`;
    const e = `${hex(h3).slice(4, 8)}${hex(h4)}`;
    return `${a}-${b}-${c}-${d}-${e}`.toUpperCase();
}

export function makeEntityField(params: {
    Name: string;
    IsPrimaryKey?: boolean;
    EntityIDFieldName?: string | null;
}): EntityFieldInfo {
    return new EntityFieldInfo({
        Name: params.Name,
        IsPrimaryKey: params.IsPrimaryKey ?? false,
        EntityIDFieldName: params.EntityIDFieldName ?? undefined,
    });
}

export function makeEntityPermission(params: {
    EntityID: string;
    RoleID: string;
    CanRead?: boolean;
    CanCreate?: boolean;
    CanUpdate?: boolean;
    CanDelete?: boolean;
    ReadRLSFilterID?: string | null;
    CreateRLSFilterID?: string | null;
    UpdateRLSFilterID?: string | null;
    DeleteRLSFilterID?: string | null;
    Type?: 'Allow' | 'Deny';
}): EntityPermissionInfo {
    return new EntityPermissionInfo({
        ID: deterministicUuid(`perm:${params.EntityID}:${params.RoleID}:${params.Type ?? 'Allow'}`),
        EntityID: params.EntityID,
        RoleID: params.RoleID,
        Type: params.Type ?? 'Allow',
        CanRead: params.CanRead ?? false,
        CanCreate: params.CanCreate ?? false,
        CanUpdate: params.CanUpdate ?? false,
        CanDelete: params.CanDelete ?? false,
        ReadRLSFilterID: params.ReadRLSFilterID ?? undefined,
        CreateRLSFilterID: params.CreateRLSFilterID ?? undefined,
        UpdateRLSFilterID: params.UpdateRLSFilterID ?? undefined,
        DeleteRLSFilterID: params.DeleteRLSFilterID ?? undefined,
    });
}

export function makeEntityInfo(params: {
    ID: string;
    Name: string;
    SchemaName?: string;
    AllowAllRowsAPI?: boolean;
    Fields: EntityFieldInfo[];
    Permissions: EntityPermissionInfo[];
}): EntityInfo {
    const info = new EntityInfo();
    info.ID = params.ID;
    info.Name = params.Name;
    info.SchemaName = params.SchemaName ?? (params.Name.startsWith('MJ_BizApps_Collaboration:') ? COLLABORATION_SCHEMA_NAME : '__mj');
    info.AllowAllRowsAPI = params.AllowAllRowsAPI ?? false;
    Object.defineProperty(info, 'Fields', { value: params.Fields, writable: true, configurable: true });
    Object.defineProperty(info, 'Permissions', { value: params.Permissions, writable: true, configurable: true });
    return info;
}

function buildAuthorizations(): {
    authorizations: AuthorizationInfo[];
    authRoles: AuthorizationRoleInfo[];
    authIds: Record<string, string>;
} {
    const authIds: Record<string, string> = {
        [COLLABORATION_ROOT_AUTHORIZATION_NAME]: '1AB4325C-EBD6-44D3-BA0D-2916DCD3320E',
        'Configure Space Types': '07405A55-52C0-452E-BBB5-36923CA7B908',
        'Configure Spaces': '1EF73781-9C37-45B7-A56C-22A99CA781F5',
        [LIFECYCLE_COLLABORATION_AUTHORIZATION_NAME]: 'FF64DD87-D2B7-4752-91F8-2FEF205E61D2',
        'Administer Spaces': 'F22C7B81-D6F8-4439-A4EB-F4C88FC1C9F1',
        'Issue Space Invite Links': 'A4D2C7E1-8B3F-4E9A-9C12-5D7F8E3B2A10',
    };

    const authRoles: AuthorizationRoleInfo[] = [];
    const addAuthRole = (authName: string, roleId: string, type: 'Allow' | 'Deny' = 'Allow'): void => {
        const ar = new AuthorizationRoleInfo({
            ID: deterministicUuid(`ar:${authName}:${roleId}`),
            AuthorizationID: authIds[authName],
            RoleID: roleId,
            Type: type,
        });
        authRoles.push(ar);
    };

    addAuthRole('Configure Space Types', ROLE_DEVELOPER_ID);
    addAuthRole('Configure Spaces', ROLE_DEVELOPER_ID);
    addAuthRole(LIFECYCLE_COLLABORATION_AUTHORIZATION_NAME, PARTICIPANT_ROLE_ID);
    addAuthRole(LIFECYCLE_COLLABORATION_AUTHORIZATION_NAME, ROLE_UI_ID);
    addAuthRole(LIFECYCLE_COLLABORATION_AUTHORIZATION_NAME, ROLE_DEVELOPER_ID);
    addAuthRole(LIFECYCLE_COLLABORATION_AUTHORIZATION_NAME, ROLE_INTEGRATION_ID);
    addAuthRole('Administer Spaces', ROLE_UI_ID);
    addAuthRole('Administer Spaces', ROLE_DEVELOPER_ID);
    addAuthRole('Administer Spaces', ROLE_INTEGRATION_ID);
    addAuthRole('Issue Space Invite Links', ROLE_UI_ID);
    addAuthRole('Issue Space Invite Links', ROLE_DEVELOPER_ID);
    addAuthRole('Issue Space Invite Links', ROLE_INTEGRATION_ID);

    const roleMap = new Map<string, Set<string>>();
    for (const ar of authRoles) {
        if ((ar.Type ?? 'Allow') === 'Allow') {
            const set = roleMap.get(ar.AuthorizationID.toLowerCase()) ?? new Set<string>();
            set.add(ar.RoleID.toLowerCase());
            roleMap.set(ar.AuthorizationID.toLowerCase(), set);
        }
    }

    const authorizations: AuthorizationInfo[] = [];
    for (const [name, id] of Object.entries(authIds)) {
        const auth = new AuthorizationInfo();
        auth.ID = id;
        auth.Name = name;
        auth.ParentID = name === COLLABORATION_ROOT_AUTHORIZATION_NAME ? '' : authIds[COLLABORATION_ROOT_AUTHORIZATION_NAME];
        auth.IsActive = true;
        Object.defineProperty(auth, 'UserCanExecute', {
            value: (u: UserInfo): boolean => {
                const allowed = roleMap.get(id.toLowerCase());
                if (!allowed || !u?.UserRoles) {
                    return false;
                }
                return u.UserRoles.some((ur) => ur.RoleID && allowed.has(ur.RoleID.toLowerCase()));
            },
        });
        authorizations.push(auth);
    }

    return { authorizations, authRoles, authIds };
}

export const FILTER_REACH_SCOPED_ID = 'F1000001-0000-4000-8000-000000000001';
export const FILTER_ACTIVE_CATALOG_ID = 'F1000001-0000-4000-8000-000000000002';
export const FILTER_SHELL_EMPTY_ID = 'F1000001-0000-4000-8000-000000000003';
export const FILTER_OWN_WRITE_ID = 'F1000001-0000-4000-8000-000000000004';
export const FILTER_UI_SCOPED_ID = 'F1000001-0000-4000-8000-000000000005';
export const FILTER_PERMISSIVE_ONE_EQUALS_ONE_ID = 'F1000001-0000-4000-8000-000000000099';

export const FILE_ENTITY_ID = deterministicUuid('entity:MJ: Files');
export const AGENT_ENTITY_ID = deterministicUuid('entity:MJ: AI Agents');
export const SPACE_ITEMS_ENTITY_ID = deterministicUuid('entity:MJ_BizApps_Collaboration: Space Items');
export const FILE_ONE_ID = 'FA000001-0000-4000-8000-000000000001';
export const FILE_TWO_ID = 'FA000001-0000-4000-8000-000000000002';
export const AGENT_SAGE_ID = 'AA000001-0000-4000-8000-000000000001';

export function buildCompliantWorldFixture(dialect: SqlDialect = 'mssql'): AuditTestWorldData {
    const { authorizations, authRoles } = buildAuthorizations();

    const rlsFilters: AuditDataRow[] = [
        {
            ID: FILTER_REACH_SCOPED_ID,
            Name: 'Collaboration: Reach Scoped',
            FilterText: "(SpaceID IN (SELECT SpaceID FROM [__mj_BizAppsCollaboration].[fnCollaborationAccess](TRY_CAST('{{UserID}}' AS UNIQUEIDENTIFIER))))",
        },
        {
            ID: FILTER_ACTIVE_CATALOG_ID,
            Name: 'Collaboration: Active Catalog',
            FilterText: '(IsActive = 1)',
        },
        {
            ID: FILTER_SHELL_EMPTY_ID,
            Name: 'Collaboration: Shell Empty',
            FilterText: '(1 = 0)',
        },
        {
            ID: FILTER_OWN_WRITE_ID,
            Name: 'Collaboration: Own Write',
            FilterText: "(UserID = TRY_CAST('{{UserID}}' AS UNIQUEIDENTIFIER))",
        },
        {
            ID: FILTER_UI_SCOPED_ID,
            Name: 'Collaboration: UI Scoped',
            FilterText: "(SpaceID IN (SELECT SpaceID FROM [__mj_BizAppsCollaboration].[fnCollaborationAccess](TRY_CAST('{{UserID}}' AS UNIQUEIDENTIFIER))))",
        },
        {
            ID: FILTER_PERMISSIVE_ONE_EQUALS_ONE_ID,
            Name: 'Collaboration: Overly Permissive',
            FilterText: '(1 = 1)',
        },
    ];

    const rlsFilterInfoById = new Map<string, RowLevelSecurityFilterInfo>();
    for (const f of rlsFilters) {
        const info = new RowLevelSecurityFilterInfo({
            ID: String(f.ID),
            Name: String(f.Name),
            FilterText: String(f.FilterText),
        });
        rlsFilterInfoById.set(info.ID.toLowerCase(), info);
    }

    const polyByEntity = new Map<string, Array<{ payload: string; disc: string }>>();
    for (const spec of COLLABORATION_POLYMORPHIC_FK_SPECS) {
        const list = polyByEntity.get(spec.EntityName.toLowerCase()) ?? [];
        list.push({ payload: spec.PayloadFieldName, disc: spec.EntityIDFieldName });
        polyByEntity.set(spec.EntityName.toLowerCase(), list);
    }

    const entities: EntityInfo[] = [];
    for (const reg of COLLABORATION_BOOT_ENTITY_REGISTRY) {
        const entityId =
            reg.EntityName === 'MJ: Files'
                ? FILE_ENTITY_ID
                : reg.EntityName === 'MJ: AI Agents'
                  ? AGENT_ENTITY_ID
                  : reg.EntityName === 'MJ_BizApps_Collaboration: Space Items'
                    ? SPACE_ITEMS_ENTITY_ID
                    : deterministicUuid(`entity:${reg.EntityName}`);

        const fields: EntityFieldInfo[] = [makeEntityField({ Name: 'ID', IsPrimaryKey: true })];
        const isCollab = reg.EntityName.startsWith('MJ_BizApps_Collaboration:');
        if (isCollab) {
            fields.push(makeEntityField({ Name: 'SpaceID' }));
        }
        for (const pair of polyByEntity.get(reg.EntityName.toLowerCase()) ?? []) {
            fields.push(makeEntityField({ Name: pair.disc }));
            fields.push(makeEntityField({ Name: pair.payload, EntityIDFieldName: pair.disc }));
        }

        const permissions: EntityPermissionInfo[] = [];
        if (reg.PolicyKind === 'reach-scoped') {
            permissions.push(
                makeEntityPermission({
                    EntityID: entityId,
                    RoleID: PARTICIPANT_ROLE_ID,
                    CanRead: true,
                    CanCreate: reg.RequireWriteRlsWhenWritable,
                    CanUpdate: reg.RequireWriteRlsWhenWritable,
                    CanDelete: false,
                    ReadRLSFilterID: FILTER_REACH_SCOPED_ID,
                    CreateRLSFilterID: reg.RequireWriteRlsWhenWritable ? FILTER_OWN_WRITE_ID : null,
                    UpdateRLSFilterID: reg.RequireWriteRlsWhenWritable ? FILTER_OWN_WRITE_ID : null,
                }),
            );
        } else if (reg.PolicyKind === 'active-catalog') {
            permissions.push(
                makeEntityPermission({
                    EntityID: entityId,
                    RoleID: PARTICIPANT_ROLE_ID,
                    CanRead: true,
                    CanCreate: false,
                    CanUpdate: false,
                    CanDelete: false,
                    ReadRLSFilterID: FILTER_ACTIVE_CATALOG_ID,
                }),
            );
        } else if (reg.PolicyKind === 'shell-deny-all') {
            permissions.push(
                makeEntityPermission({
                    EntityID: entityId,
                    RoleID: PARTICIPANT_ROLE_ID,
                    CanRead: true,
                    CanCreate: false,
                    CanUpdate: false,
                    CanDelete: false,
                    ReadRLSFilterID: FILTER_SHELL_EMPTY_ID,
                }),
            );
        } else if (reg.PolicyKind === 'staff-only-denied') {
            permissions.push(
                makeEntityPermission({
                    EntityID: entityId,
                    RoleID: ROLE_DEVELOPER_ID,
                    CanRead: true,
                    CanCreate: true,
                    CanUpdate: true,
                    CanDelete: true,
                }),
            );
        }

        if (reg.RequireUiRoleReadFilter) {
            permissions.push(
                makeEntityPermission({
                    EntityID: entityId,
                    RoleID: ROLE_UI_ID,
                    CanRead: true,
                    ReadRLSFilterID: FILTER_UI_SCOPED_ID,
                }),
            );
        }

        entities.push(
            makeEntityInfo({
                ID: entityId,
                Name: reg.EntityName,
                SchemaName: isCollab ? COLLABORATION_SCHEMA_NAME : '__mj',
                AllowAllRowsAPI: false,
                Fields: fields,
                Permissions: permissions,
            }),
        );
    }

    const users: AuditDataRow[] = [
        { ID: USER_DEV_ID, Name: 'Dev Admin', Email: 'dev.admin@collab-world.example', Type: 'Owner', IsActive: true },
        { ID: USER_ADA_ID, Name: 'Ada Owner', Email: 'ada.owner@collab-world.example', Type: 'User', IsActive: true },
        { ID: USER_SAM_ID, Name: 'Sam Member', Email: 'sam.member@collab-world.example', Type: 'User', IsActive: true },
        { ID: USER_NORA_ID, Name: 'Nora Staff', Email: 'nora.none@collab-world.example', Type: 'User', IsActive: true },
        { ID: USER_CASEY_ID, Name: 'Casey Client', Email: 'casey.admin@collab-world.example', Type: 'User', IsActive: true },
        { ID: USER_BEA_ID, Name: 'Bea Client', Email: 'bea.member@collab-world.example', Type: 'User', IsActive: true },
        { ID: USER_DANA_ID, Name: 'Dana Director', Email: 'dana.director@collab-world.example', Type: 'User', IsActive: true },
        { ID: USER_HARPER_ID, Name: 'Harper Client', Email: 'harper.member@collab-world.example', Type: 'User', IsActive: true },
    ];

    const userRoles: AuditDataRow[] = [
        { ID: deterministicUuid('ur:dev'), UserID: USER_DEV_ID, RoleID: ROLE_DEVELOPER_ID },
        { ID: deterministicUuid('ur:ada'), UserID: USER_ADA_ID, RoleID: ROLE_UI_ID },
        { ID: deterministicUuid('ur:sam'), UserID: USER_SAM_ID, RoleID: ROLE_UI_ID },
        { ID: deterministicUuid('ur:nora'), UserID: USER_NORA_ID, RoleID: ROLE_UI_ID },
        { ID: deterministicUuid('ur:casey'), UserID: USER_CASEY_ID, RoleID: PARTICIPANT_ROLE_ID },
        { ID: deterministicUuid('ur:bea'), UserID: USER_BEA_ID, RoleID: PARTICIPANT_ROLE_ID },
        { ID: deterministicUuid('ur:dana'), UserID: USER_DANA_ID, RoleID: PARTICIPANT_ROLE_ID },
        { ID: deterministicUuid('ur:harper'), UserID: USER_HARPER_ID, RoleID: PARTICIPANT_ROLE_ID },
    ];

    const applicationRoles: AuditDataRow[] = [
        { ID: deterministicUuid('appRole:ui'), ApplicationID: COLLABORATION_APPLICATION_ID, RoleID: ROLE_UI_ID, CanAccess: true, CanAdmin: false },
        { ID: deterministicUuid('appRole:dev'), ApplicationID: COLLABORATION_APPLICATION_ID, RoleID: ROLE_DEVELOPER_ID, CanAccess: true, CanAdmin: true },
        { ID: deterministicUuid('appRole:part'), ApplicationID: COLLABORATION_APPLICATION_ID, RoleID: PARTICIPANT_ROLE_ID, CanAccess: true, CanAdmin: false },
    ];

    const spaceTypes: AuditDataRow[] = [
        {
            ID: SPACE_TYPE_RELATIONSHIP_ID,
            Code: 'relationship',
            Name: 'Relationship',
            Configuration: JSON.stringify({ Seats: { Audience: 'StaffAndParticipants' } }),
            IsActive: true,
        },
        {
            ID: SPACE_TYPE_PROJECT_ID,
            Code: 'project',
            Name: 'Project',
            Configuration: JSON.stringify({ Seats: { Audience: 'StaffAndParticipants' } }),
            IsActive: true,
        },
        {
            ID: SPACE_TYPE_STAFF_ONLY_ID,
            Code: 'staff-room',
            Name: 'Staff Room',
            Configuration: JSON.stringify({ Seats: { Audience: 'StaffOnly' } }),
            IsActive: true,
        },
    ];

    const spaceRoleTypes: AuditDataRow[] = [
        { ID: SPACE_ROLE_OWNER_ID, Code: 'owner', Name: 'Owner', Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true, IsActive: true },
        { ID: SPACE_ROLE_ADMIN_ID, Code: 'admin', Name: 'Admin', Level: 30, MaxGrantableLevel: 20, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true },
        { ID: SPACE_ROLE_MEMBER_ID, Code: 'member', Name: 'Member', Level: 20, MaxGrantableLevel: 10, CanInvite: true, CanPromoteBand: false, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true },
        { ID: SPACE_ROLE_GUEST_ID, Code: 'guest', Name: 'Guest', Level: 10, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: false, IsActive: true },
        { ID: SPACE_ROLE_CLIENT_ADMIN_ID, Code: 'client-admin', Name: 'Outside admin', Level: 20, MaxGrantableLevel: 10, CanInvite: true, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true, IsActive: true },
        { ID: SPACE_ROLE_CLIENT_MEMBER_ID, Code: 'client-member', Name: 'Outside member', Level: 10, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true, IsActive: true },
    ];

    const spaces: AuditDataRow[] = [
        { ID: SPACE_NORTHWIND_ID, Name: 'Northwind relationship', ParentID: null, SpaceTypeID: SPACE_TYPE_RELATIONSHIP_ID, InheritsMembership: true, OwnerID: USER_ADA_ID, StatusID: null, ClosedAt: null },
        { ID: SPACE_DISCOVERY_ID, Name: 'Discovery', ParentID: SPACE_NORTHWIND_ID, SpaceTypeID: SPACE_TYPE_PROJECT_ID, InheritsMembership: true, OwnerID: USER_ADA_ID, StatusID: null, ClosedAt: null },
        { ID: SPACE_DELIVERY_ID, Name: 'Delivery', ParentID: SPACE_NORTHWIND_ID, SpaceTypeID: SPACE_TYPE_PROJECT_ID, InheritsMembership: false, OwnerID: USER_ADA_ID, StatusID: null, ClosedAt: null },
        { ID: SPACE_COMMITTEE_ID, Name: 'Audit committee', ParentID: null, SpaceTypeID: SPACE_TYPE_PROJECT_ID, InheritsMembership: true, OwnerID: USER_ADA_ID, StatusID: null, ClosedAt: null },
        { ID: SPACE_HARBOR_ID, Name: 'Harbor relationship', ParentID: null, SpaceTypeID: SPACE_TYPE_RELATIONSHIP_ID, InheritsMembership: true, OwnerID: USER_SAM_ID, StatusID: null, ClosedAt: null },
        { ID: SPACE_STAFF_ONLY_ID, Name: 'Internal Strategy Room', ParentID: SPACE_NORTHWIND_ID, SpaceTypeID: SPACE_TYPE_STAFF_ONLY_ID, InheritsMembership: false, OwnerID: USER_ADA_ID, StatusID: null, ClosedAt: null },
    ];

    const spaceMembers: AuditDataRow[] = [
        { ID: deterministicUuid('sm:northwind:ada'), SpaceID: SPACE_NORTHWIND_ID, UserID: USER_ADA_ID, SpaceRoleTypeID: SPACE_ROLE_OWNER_ID, Band: 'Team', Status: 'Active' },
        { ID: deterministicUuid('sm:northwind:sam'), SpaceID: SPACE_NORTHWIND_ID, UserID: USER_SAM_ID, SpaceRoleTypeID: SPACE_ROLE_MEMBER_ID, Band: 'Team', Status: 'Active' },
        { ID: deterministicUuid('sm:northwind:casey'), SpaceID: SPACE_NORTHWIND_ID, UserID: USER_CASEY_ID, SpaceRoleTypeID: SPACE_ROLE_CLIENT_ADMIN_ID, Band: 'Shared', Status: 'Active' },
        { ID: deterministicUuid('sm:discovery:bea'), SpaceID: SPACE_DISCOVERY_ID, UserID: USER_BEA_ID, SpaceRoleTypeID: SPACE_ROLE_CLIENT_MEMBER_ID, Band: 'Shared', Status: 'Active' },
        { ID: deterministicUuid('sm:committee:dana'), SpaceID: SPACE_COMMITTEE_ID, UserID: USER_DANA_ID, SpaceRoleTypeID: SPACE_ROLE_GUEST_ID, Band: 'Shared', Status: 'Active' },
        { ID: deterministicUuid('sm:harbor:harper'), SpaceID: SPACE_HARBOR_ID, UserID: USER_HARPER_ID, SpaceRoleTypeID: SPACE_ROLE_CLIENT_MEMBER_ID, Band: 'Shared', Status: 'Active' },
        { ID: deterministicUuid('sm:staff:ada'), SpaceID: SPACE_STAFF_ONLY_ID, UserID: USER_ADA_ID, SpaceRoleTypeID: SPACE_ROLE_OWNER_ID, Band: 'Team', Status: 'Active' },
    ];

    const files: AuditDataRow[] = [
        { ID: FILE_ONE_ID, Name: 'Discovery Brief.pdf' },
        { ID: FILE_TWO_ID, Name: 'Harbor Brief.pdf' },
    ];

    const aiAgents: AuditDataRow[] = [
        { ID: AGENT_SAGE_ID, Name: 'Sage' },
    ];

    const spaceItems: AuditDataRow[] = [
        {
            ID: '1A000001-0000-4000-8000-000000000001',
            SpaceID: SPACE_DISCOVERY_ID,
            EntityID: FILE_ENTITY_ID,
            RecordID: `ID|${FILE_ONE_ID}`,
            Band: 'Shared',
        },
        {
            ID: '1A000001-0000-4000-8000-000000000002',
            SpaceID: SPACE_HARBOR_ID,
            EntityID: FILE_ENTITY_ID,
            RecordID: `ID|${FILE_TWO_ID}`,
            Band: 'Shared',
        },
    ];

    const spaceAnchors: AuditDataRow[] = [
        {
            ID: '2A000001-0000-4000-8000-000000000001',
            SpaceID: SPACE_DISCOVERY_ID,
            EntityID: FILE_ENTITY_ID,
            RecordID: `ID|${FILE_ONE_ID}`,
        },
    ];

    const spaceGrants: AuditDataRow[] = [
        {
            ID: '3A000001-0000-4000-8000-000000000001',
            SpaceID: SPACE_NORTHWIND_ID,
            TargetEntityID: AGENT_ENTITY_ID,
            TargetRecordID: AGENT_SAGE_ID,
        },
    ];

    const spaceMemberPins: AuditDataRow[] = [
        {
            ID: '4A000001-0000-4000-8000-000000000001',
            SpaceID: SPACE_DISCOVERY_ID,
            TargetEntityID: SPACE_ITEMS_ENTITY_ID,
            TargetRecordID: '1A000001-0000-4000-8000-000000000001',
        },
    ];

    const spaceAgentSourceReceipts: AuditDataRow[] = [
        {
            ID: '5A000001-0000-4000-8000-000000000001',
            SpaceID: SPACE_DISCOVERY_ID,
            TargetEntityID: FILE_ENTITY_ID,
            TargetRecordID: FILE_ONE_ID,
        },
    ];

    return {
        Dialect: dialect,
        Entities: entities,
        Authorizations: authorizations,
        AuthorizationRoles: authRoles,
        RlsFilters: rlsFilters,
        Users: users,
        UserRoles: userRoles,
        ApplicationRoles: applicationRoles,
        SpaceTypes: spaceTypes,
        SpaceRoleTypes: spaceRoleTypes,
        Spaces: spaces,
        SpaceMembers: spaceMembers,
        SpaceAnchors: spaceAnchors,
        SpaceItems: spaceItems,
        SpaceGrants: spaceGrants,
        SpaceMemberPins: spaceMemberPins,
        SpaceAgentSourceReceipts: spaceAgentSourceReceipts,
        Files: files,
        AIAgents: aiAgents,
        CapturedRunViewCalls: [],
        GetEntityObjectCallCount: 0,
    };
}

function tableForEntity(world: AuditTestWorldData, entityName: string): AuditDataRow[] {
    if (world.CustomPolymorphicRows && world.CustomPolymorphicRows[entityName]) {
        return world.CustomPolymorphicRows[entityName];
    }
    switch (entityName) {
        case 'MJ_BizApps_Collaboration: Space Members':
            return world.SpaceMembers;
        case 'MJ_BizApps_Collaboration: Spaces':
            return world.Spaces;
        case 'MJ_BizApps_Collaboration: Space Types':
            return world.SpaceTypes;
        case 'MJ_BizApps_Collaboration: Space Role Types':
            return world.SpaceRoleTypes;
        case 'MJ_BizApps_Collaboration: Space Anchors':
            return world.SpaceAnchors;
        case 'MJ_BizApps_Collaboration: Space Items':
            return world.SpaceItems;
        case 'MJ_BizApps_Collaboration: Space Grants':
            return world.SpaceGrants;
        case 'MJ_BizApps_Collaboration: Space Member Pins':
            return world.SpaceMemberPins;
        case 'MJ_BizApps_Collaboration: Space Agent Source Receipts':
            return world.SpaceAgentSourceReceipts;
        case 'MJ: Users':
            return world.Users;
        case 'MJ: User Roles':
            return world.UserRoles;
        case 'MJ: Authorization Roles':
            return world.AuthorizationRoles.map((ar) => ({
                ID: ar.ID,
                AuthorizationID: ar.AuthorizationID,
                RoleID: ar.RoleID,
                Type: ar.Type,
            }));
        case 'MJ: Application Roles':
            return world.ApplicationRoles;
        case 'MJ: Row Level Security Filters':
            return world.RlsFilters;
        case 'MJ: Files':
            return world.Files;
        case 'MJ: AI Agents':
            return world.AIAgents;
        default:
            return [];
    }
}

function applySimpleFilter(rows: readonly AuditDataRow[], extraFilter: string | undefined): AuditDataRow[] {
    if (!extraFilter || !extraFilter.trim()) {
        return [...rows];
    }
    let filtered = [...rows];
    const parts = extraFilter.split(/\s+AND\s+/i);
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed === '1 = 0' || trimmed === '1=0') {
            return [];
        }
        const notRemoved = /^(?:\[Status\]|"Status"|Status)\s*<>\s*'Removed'$/i.exec(trimmed);
        if (notRemoved) {
            filtered = filtered.filter((r) => String(r['Status'] ?? '') !== 'Removed');
            continue;
        }
        const eqActive = /^(?:\[Status\]|"Status"|Status)\s*=\s*'Active'$/i.exec(trimmed);
        if (eqActive) {
            filtered = filtered.filter((r) => String(r['Status'] ?? '') === 'Active');
            continue;
        }
        const inMatch = /^(?:\[(\w+)\]|"(\w+)"|(\w+))\s+IN\s*\(([^)]*)\)$/i.exec(trimmed);
        if (inMatch) {
            const col = inMatch[1] ?? inMatch[2] ?? inMatch[3];
            const values = [...inMatch[4].matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase());
            filtered = filtered.filter((r) => values.includes(String(r[col] ?? '').toLowerCase()));
        }
    }
    return filtered;
}

export function createWorldAuditProvider(world: AuditTestWorldData): IMetadataProvider {
    const provider: Partial<IMetadataProvider> & {
        PlatformKey: SqlDialect;
        RunView: <T>(params: RunViewParams) => Promise<RunViewResult<T>>;
    } = {
        PlatformKey: world.Dialect,
        Entities: world.Entities,
        Authorizations: world.Authorizations,
        AuthorizationRoles: world.AuthorizationRoles,
        EntityByName(name: string): EntityInfo | undefined {
            const target = name.trim().toLowerCase();
            return world.Entities.find((e) => e.Name.trim().toLowerCase() === target);
        },
        EntityByID(id: string): EntityInfo | undefined {
            const target = id.trim().toLowerCase();
            return world.Entities.find((e) => e.ID.trim().toLowerCase() === target);
        },
        async GetEntityObject() {
            world.GetEntityObjectCallCount += 1;
            throw new Error('Unexpected GetEntityObject call in RunView simple-mode audit!');
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            world.CapturedRunViewCalls.push(params);
            const filterStr = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : undefined;
            let rows = applySimpleFilter(tableForEntity(world, params.EntityName ?? ''), filterStr);

            if (typeof params.OrderBy === 'string' && params.OrderBy.toUpperCase().includes('ID ASC')) {
                rows.sort((a, b) => String(a['ID'] ?? '').localeCompare(String(b['ID'] ?? '')));
            }

            if (params.AfterKey?.KeyValuePairs?.[0]?.Value) {
                const cursor = String(params.AfterKey.KeyValuePairs[0].Value);
                rows = rows.filter((r) => String(r['ID'] ?? '').localeCompare(cursor) > 0);
            }

            if (typeof params.MaxRows === 'number' && params.MaxRows > 0) {
                rows = rows.slice(0, params.MaxRows);
            }

            const projected = params.Fields && params.Fields.length > 0
                ? rows.map((row) => {
                      const out: AuditDataRow = {};
                      for (const f of params.Fields!) {
                          out[f] = row[f];
                      }
                      return out;
                  })
                : rows;

            return {
                Success: true,
                Results: projected as T[],
                RowCount: projected.length,
                TotalRowCount: projected.length,
                ExecutionTime: 1,
                ErrorMessage: '',
            };
        },
    };
    return provider as IMetadataProvider;
}
