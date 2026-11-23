import { describe, it, expect, beforeEach } from 'vitest';
import { BaseRemotableOperation } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY,
    type BootEntityGrantInventoryResult,
    CollaborationAdminEngineBase,
    LoadCollaborationSecurityAuditOperations,
    PARTICIPANT_ROLE_ID,
    SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY,
    type SpaceParticipantRoleAuditResult,
    STAFF_ROLE_AUDIT_OPERATION_KEY,
    type StaffRoleAuditResult,
} from '../index.js';
import {
    buildCompliantWorldFixture,
    createWorldAuditProvider,
    FILTER_PERMISSIVE_ONE_EQUALS_ONE_ID,
    makeUserInfo,
    ROLE_DEVELOPER_ID,
    ROLE_INTEGRATION_ID,
    ROLE_UI_ID,
    SPACE_DISCOVERY_ID,
    SPACE_HARBOR_ID,
    SPACE_ROLE_OWNER_ID,
    SPACE_STAFF_ONLY_ID,
    USER_ADA_ID,
    USER_BEA_ID,
    USER_DEV_ID,
} from './audit-test-fixtures.js';

describe('World-Data-Model Security Suite (XS-1, XS-2, XS-7)', () => {
    const devAdmin = makeUserInfo({ ID: USER_DEV_ID, Type: 'Owner', RoleIDs: [ROLE_DEVELOPER_ID] });
    const adaStaff = makeUserInfo({ ID: USER_ADA_ID, Type: 'User', RoleIDs: [ROLE_UI_ID] });
    const beaParticipant = makeUserInfo({ ID: USER_BEA_ID, Type: 'User', RoleIDs: [PARTICIPANT_ROLE_ID] });

    beforeEach(() => {
        LoadCollaborationSecurityAuditOperations();
    });

    it('verifies full compliant world across CollaborationAdminEngineBase and BaseRemotableOperation on both mssql and postgresql', async () => {
        for (const dialect of ['mssql', 'postgresql'] as const) {
            const world = buildCompliantWorldFixture(dialect);
            const provider = createWorldAuditProvider(world);
            const adminEngine = CollaborationAdminEngineBase.Instance;

            const xs1 = await adminEngine.RunSpaceParticipantRoleAudit({}, devAdmin, provider);
            const xs7 = await adminEngine.RunStaffRoleAudit(
                { AllowedAdminRoleIDs: [ROLE_DEVELOPER_ID, ROLE_UI_ID, ROLE_INTEGRATION_ID] },
                devAdmin,
                provider,
            );
            const xs2 = await adminEngine.RunBootEntityGrantInventory(
                { RestrictedStaffRoleIDs: [ROLE_UI_ID] },
                devAdmin,
                provider,
            );

            expect(xs1.Passed).toBe(true);
            expect(xs1.Dialect).toBe(dialect);
            expect(xs7.Passed).toBe(true);
            expect(xs7.Dialect).toBe(dialect);
            expect(xs2.Passed).toBe(true);
            expect(xs2.Dialect).toBe(dialect);
            expect(world.GetEntityObjectCallCount).toBe(0);

            // Also verify dispatch through BaseRemotableOperation ClassFactory registry
            const op1 = MJGlobal.Instance.ClassFactory.CreateInstance<
                BaseRemotableOperation<Record<string, never>, SpaceParticipantRoleAuditResult>
            >(BaseRemotableOperation, SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY);
            const op7 = MJGlobal.Instance.ClassFactory.CreateInstance<
                BaseRemotableOperation<{ AllowedAdminRoleIDs: string[] }, StaffRoleAuditResult>
            >(BaseRemotableOperation, STAFF_ROLE_AUDIT_OPERATION_KEY);
            const op2 = MJGlobal.Instance.ClassFactory.CreateInstance<
                BaseRemotableOperation<{ RestrictedStaffRoleIDs: string[] }, BootEntityGrantInventoryResult>
            >(BaseRemotableOperation, BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY);

            const res1 = await op1!.ExecuteServer({}, { provider, user: adaStaff, emitProgress: () => {} });
            const res7 = await op7!.ExecuteServer(
                { AllowedAdminRoleIDs: [ROLE_DEVELOPER_ID, ROLE_UI_ID, ROLE_INTEGRATION_ID] },
                { provider, user: adaStaff, emitProgress: () => {} },
            );
            const res2 = await op2!.ExecuteServer(
                { RestrictedStaffRoleIDs: [ROLE_UI_ID] },
                { provider, user: adaStaff, emitProgress: () => {} },
            );

            expect(res1.Success && res1.Output?.Passed).toBe(true);
            expect(res7.Success && res7.Output?.Passed).toBe(true);
            expect(res2.Success && res2.Output?.Passed).toBe(true);
        }
    });

    it('detects combined multi-layer violations across XS-1, XS-7, and XS-2 in a compromised world model', async () => {
        const world = buildCompliantWorldFixture('mssql');

        // Violation A (XS-1): External participant promoted to Owner + Team band, plus StaffOnly inheritance leak
        world.SpaceMembers.push({
            ID: 'AA100001-0000-4000-8000-000000000001',
            SpaceID: SPACE_HARBOR_ID,
            UserID: USER_BEA_ID,
            SpaceRoleTypeID: SPACE_ROLE_OWNER_ID,
            Band: 'Team',
            Status: 'Active',
        });
        const staffRoom = world.Spaces.find((s) => s.ID === SPACE_STAFF_ONLY_ID)!;
        staffRoom.InheritsMembership = true;

        // Violation B (XS-1): Polymorphic SpaceAnchor pointing to nonexistent File record
        world.SpaceAnchors.push({
            ID: 'AA200001-0000-4000-8000-000000000001',
            SpaceID: SPACE_DISCOVERY_ID,
            EntityID: world.Entities.find((e) => e.Name === 'MJ: Files')!.ID,
            RecordID: 'ID|FFFFFFFF-0000-4000-8000-000000000999',
        });

        // Violation C (XS-7): Staff user also assigned Space Participant role
        world.UserRoles.push({
            ID: 'AA300001-0000-4000-8000-000000000001',
            UserID: USER_ADA_ID,
            RoleID: PARTICIPANT_ROLE_ID,
        });

        // Violation D (XS-2): Boot entity grant filter weakened to (1 = 1) & EntityIDFieldName cleared
        const itemsEntity = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Items')!;
        itemsEntity.Permissions[0].ReadRLSFilterID = FILTER_PERMISSIVE_ONE_EQUALS_ONE_ID;
        itemsEntity.Fields.find((f) => f.Name === 'RecordID')!.EntityIDFieldName = '';

        const provider = createWorldAuditProvider(world);
        const adminEngine = CollaborationAdminEngineBase.Instance;

        const xs1 = await adminEngine.RunSpaceParticipantRoleAudit({}, devAdmin, provider);
        const xs7 = await adminEngine.RunStaffRoleAudit({}, devAdmin, provider);
        const xs2 = await adminEngine.RunBootEntityGrantInventory({}, devAdmin, provider);

        expect(xs1.Passed).toBe(false);
        expect(xs1.Findings.some((f) => f.Code === 'ELEVATED_EXTERNAL_ROLE')).toBe(true);
        expect(xs1.Findings.some((f) => f.Code === 'CROSS_SPACE_ROLE_LEAK')).toBe(true);
        expect(xs1.Findings.some((f) => f.Code === 'ORPHANED_POLYMORPHIC_LINK')).toBe(true);

        expect(xs7.Passed).toBe(false);
        expect(xs7.Findings.some((f) => f.Code === 'OVERLAPPING_EXTERNAL_STAFF_ROLE')).toBe(true);

        expect(xs2.Passed).toBe(false);
        expect(xs2.Findings.some((f) => f.Code === 'OVERLY_PERMISSIVE_RLS_FILTER')).toBe(true);
        expect(xs2.Findings.some((f) => f.Code === 'MISSING_ENTITY_ID_FIELD_NAME')).toBe(true);
    });

    it('rejects direct engine security audit invocations by external Space Participant accounts', async () => {
        const world = buildCompliantWorldFixture();
        const provider = createWorldAuditProvider(world);
        const adminEngine = CollaborationAdminEngineBase.Instance;

        await expect(adminEngine.RunSpaceParticipantRoleAudit({}, beaParticipant, provider)).rejects.toThrow(
            /External Space Participant accounts cannot invoke/,
        );
        await expect(adminEngine.RunStaffRoleAudit({}, beaParticipant, provider)).rejects.toThrow(
            /External Space Participant accounts cannot invoke/,
        );
        await expect(adminEngine.RunBootEntityGrantInventory({}, beaParticipant, provider)).rejects.toThrow(
            /External Space Participant accounts cannot invoke/,
        );
    });
});
