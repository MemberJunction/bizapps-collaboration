import { describe, it, expect } from 'vitest';
import { AuthorizationRoleInfo, BaseRemotableOperation } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    COLLABORATION_APPLICATION_ID,
    COLLABORATION_ROOT_AUTHORIZATION_NAME,
    LoadCollaborationSecurityAuditOperations,
    PARTICIPANT_ROLE_ID,
    runStaffRoleAudit,
    STAFF_ROLE_AUDIT_OPERATION_KEY,
    StaffRoleAuditOperation,
} from '../index.js';
import {
    buildCompliantWorldFixture,
    createWorldAuditProvider,
    makeEntityPermission,
    makeUserInfo,
    ROLE_DEVELOPER_ID,
    ROLE_INTEGRATION_ID,
    ROLE_UI_ID,
    SPACE_NORTHWIND_ID,
    USER_ADA_ID,
    USER_BEA_ID,
    USER_DEV_ID,
    USER_NORA_ID,
} from './audit-test-fixtures.js';

describe('XS-7 Staff Role Audit', () => {
    const adminUser = makeUserInfo({ ID: USER_DEV_ID, Type: 'Owner', RoleIDs: [ROLE_DEVELOPER_ID] });
    const participantCaller = makeUserInfo({ ID: USER_BEA_ID, Type: 'User', RoleIDs: [PARTICIPANT_ROLE_ID] });

    it('passes on a compliant world respecting least privilege and external/staff separation', async () => {
        const world = buildCompliantWorldFixture('mssql');
        const provider = createWorldAuditProvider(world);

        const result = await runStaffRoleAudit(provider, adminUser, {
            AllowedAdminRoleIDs: [ROLE_DEVELOPER_ID, ROLE_UI_ID, ROLE_INTEGRATION_ID],
        });

        expect(result.Passed).toBe(true);
        expect(result.Findings).toEqual([]);
        expect(result.Stats.UsersChecked).toBeGreaterThanOrEqual(4);
        expect(world.GetEntityObjectCallCount).toBe(0);
        for (const call of world.CapturedRunViewCalls) {
            expect(call.ResultType).toBe('simple');
        }
    });

    it('detects overlapping external Space Participant + internal staff role bindings', async () => {
        const world = buildCompliantWorldFixture();
        // Give Ada (who holds UI staff role) the Space Participant role as well
        world.UserRoles.push({
            ID: '11111111-1111-4111-8111-000000000001',
            UserID: USER_ADA_ID,
            RoleID: PARTICIPANT_ROLE_ID,
        });
        const provider = createWorldAuditProvider(world);

        const result = await runStaffRoleAudit(provider, adminUser);

        expect(result.Passed).toBe(false);
        const finding = result.Findings.find((f) => f.Code === 'OVERLAPPING_EXTERNAL_STAFF_ROLE');
        expect(finding).toBeDefined();
        expect(finding?.UserID).toBe(USER_ADA_ID);
    });

    it('detects staff authorization granted directly to Space Participant and root Collaboration escalation', async () => {
        const world = buildCompliantWorldFixture();
        const adminAuth = world.Authorizations.find((a) => a.Name === 'Administer Spaces')!;
        const rootAuth = world.Authorizations.find((a) => a.Name === COLLABORATION_ROOT_AUTHORIZATION_NAME)!;

        const partAdminGrant = new AuthorizationRoleInfo({
            ID: '22222222-2222-4222-8222-000000000001',
            AuthorizationID: adminAuth.ID,
            RoleID: PARTICIPANT_ROLE_ID,
            Type: 'Allow',
        });

        const rootGrant = new AuthorizationRoleInfo({
            ID: '22222222-2222-4222-8222-000000000002',
            AuthorizationID: rootAuth.ID,
            RoleID: ROLE_UI_ID,
            Type: 'Allow',
        });

        world.AuthorizationRoles.push(partAdminGrant, rootGrant);
        const provider = createWorldAuditProvider(world);

        const result = await runStaffRoleAudit(provider, adminUser);

        expect(result.Passed).toBe(false);
        const codes = new Set(result.Findings.map((f) => f.Code));
        expect(codes.has('PARTICIPANT_GRANTED_STAFF_AUTHORIZATION')).toBe(true);
        expect(codes.has('ROOT_AUTHORIZATION_GRANTED')).toBe(true);
    });

    it('detects global administrative escalation via Owner+Participant, CanAdmin on Participant app role, and out-of-policy Admin role', async () => {
        const world = buildCompliantWorldFixture();
        // 1. User.Type='Owner' holding PARTICIPANT_ROLE_ID
        const bea = world.Users.find((u) => u.ID === USER_BEA_ID)!;
        bea.Type = 'Owner';
        // 2. ApplicationRole CanAdmin=true for PARTICIPANT_ROLE_ID
        world.ApplicationRoles.push({
            ID: '33333333-3333-4333-8333-000000000001',
            ApplicationID: COLLABORATION_APPLICATION_ID,
            RoleID: PARTICIPANT_ROLE_ID,
            CanAccess: true,
            CanAdmin: true,
        });
        const provider = createWorldAuditProvider(world);

        // 3. Restrict AllowedAdminRoleIDs strictly to Developer only -> UI holding Administer Spaces triggers GLOBAL_ADMIN_ESCALATION
        const result = await runStaffRoleAudit(provider, adminUser, {
            AllowedAdminRoleIDs: [ROLE_DEVELOPER_ID],
        });

        expect(result.Passed).toBe(false);
        const codes = new Set(result.Findings.map((f) => f.Code));
        expect(codes.has('GLOBAL_ADMIN_ESCALATION')).toBe(true);
        expect(codes.has('EXTERNAL_ROLE_ADMIN_APP_ACCESS')).toBe(true);
        expect(codes.has('LEAST_PRIVILEGE_BOUNDARY_VIOLATION')).toBe(true);
    });

    it('detects excessive EntityPermissions on Space Participant, inactive staff accounts, and Shared-only staff seats', async () => {
        const world = buildCompliantWorldFixture();
        const spacesEntity = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Spaces')!;
        spacesEntity.Permissions.push(
            makeEntityPermission({
                EntityID: spacesEntity.ID,
                RoleID: PARTICIPANT_ROLE_ID,
                CanRead: true,
                CanDelete: true,
            }),
        );
        const spaceTypesEntity = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Types')!;
        spaceTypesEntity.Permissions.push(
            makeEntityPermission({
                EntityID: spaceTypesEntity.ID,
                RoleID: PARTICIPANT_ROLE_ID,
                CanRead: true,
                CanUpdate: true,
            }),
        );

        // Deactivate Nora who still holds UI staff role
        const nora = world.Users.find((u) => u.ID === USER_NORA_ID)!;
        nora.IsActive = false;

        // Seat staff user Ada with Band='Shared'
        world.SpaceMembers.push({
            ID: '44444444-4444-4444-8444-000000000001',
            SpaceID: SPACE_NORTHWIND_ID,
            UserID: USER_ADA_ID,
            SpaceRoleTypeID: '03AD14E2-341A-4AC6-BA9D-E7AA5B31647B',
            Band: 'Shared',
            Status: 'Active',
        });

        const provider = createWorldAuditProvider(world);
        const result = await runStaffRoleAudit(provider, adminUser);

        expect(result.Passed).toBe(false);
        const codes = new Set(result.Findings.map((f) => f.Code));
        expect(codes.has('EXTERNAL_ROLE_EXCESSIVE_ENTITY_PERMISSION')).toBe(true);
        expect(codes.has('INACTIVE_STAFF_ROLE_BINDING')).toBe(true);
        expect(codes.has('LEAST_PRIVILEGE_BOUNDARY_VIOLATION')).toBe(true);
    });

    it('registers StaffRoleAuditOperation and enforces ContextUser authorization', async () => {
        LoadCollaborationSecurityAuditOperations();
        const op = MJGlobal.Instance.ClassFactory.CreateInstance<StaffRoleAuditOperation>(
            BaseRemotableOperation,
            STAFF_ROLE_AUDIT_OPERATION_KEY,
        );
        expect(op).toBeInstanceOf(StaffRoleAuditOperation);
        expect(op?.DisallowMagicLinkScope).toBe(true);

        const world = buildCompliantWorldFixture('postgresql');
        const provider = createWorldAuditProvider(world);

        const okRes = await op!.ExecuteServer(
            { AllowedAdminRoleIDs: [ROLE_DEVELOPER_ID, ROLE_UI_ID, ROLE_INTEGRATION_ID] },
            { provider, user: adminUser, emitProgress: () => {} },
        );
        expect(okRes.Success).toBe(true);
        expect(okRes.Output?.Passed).toBe(true);
        expect(okRes.Output?.Dialect).toBe('postgresql');

        const deniedRes = await op!.ExecuteServer({}, { provider, user: participantCaller, emitProgress: () => {} });
        expect(deniedRes.Success).toBe(false);
        expect(deniedRes.ResultCode).toBe('FORBIDDEN');
    });
});
