import { describe, it, expect } from 'vitest';
import { BaseRemotableOperation } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    LoadCollaborationSecurityAuditOperations,
    PARTICIPANT_ROLE_ID,
    runSpaceParticipantRoleAudit,
    SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY,
    SpaceParticipantRoleAuditOperation,
} from '../index.js';
import {
    buildCompliantWorldFixture,
    createWorldAuditProvider,
    FILE_ENTITY_ID,
    FILE_ONE_ID,
    makeEntityField,
    makeEntityInfo,
    makeUserInfo,
    ROLE_DEVELOPER_ID,
    ROLE_UI_ID,
    SPACE_DELIVERY_ID,
    SPACE_DISCOVERY_ID,
    SPACE_HARBOR_ID,
    SPACE_NORTHWIND_ID,
    SPACE_ROLE_ADMIN_ID,
    SPACE_ROLE_CLIENT_MEMBER_ID,
    SPACE_ROLE_MEMBER_ID,
    SPACE_ROLE_OWNER_ID,
    SPACE_STAFF_ONLY_ID,
    SPACE_TYPE_STAFF_ONLY_ID,
    USER_ADA_ID,
    USER_BEA_ID,
    USER_DEV_ID,
    USER_NORA_ID,
} from './audit-test-fixtures.js';

describe('XS-1 Space Participant Role Audit', () => {
    const adminUser = makeUserInfo({ ID: USER_DEV_ID, Type: 'Owner', RoleIDs: [ROLE_DEVELOPER_ID] });
    const staffAdminUser = makeUserInfo({ ID: USER_ADA_ID, Type: 'User', RoleIDs: [ROLE_UI_ID] });
    const participantCaller = makeUserInfo({ ID: USER_BEA_ID, Type: 'User', RoleIDs: [PARTICIPANT_ROLE_ID] });

    it('passes cleanly on a compliant multi-space world with zero findings and zero GetEntityObject N+1 hydration', async () => {
        const world = buildCompliantWorldFixture('mssql');
        const provider = createWorldAuditProvider(world);

        const result = await runSpaceParticipantRoleAudit(provider, adminUser);

        expect(result.Passed).toBe(true);
        expect(result.Findings).toEqual([]);
        expect(result.Dialect).toBe('mssql');
        expect(result.Stats.MembersChecked).toBe(world.SpaceMembers.length);
        expect(result.Stats.PolymorphicEntitiesChecked).toBe(5);
        expect(result.Stats.PolymorphicLinksChecked).toBeGreaterThanOrEqual(5);
        expect(world.GetEntityObjectCallCount).toBe(0);
        expect(world.CapturedRunViewCalls.length).toBeGreaterThan(0);
        for (const call of world.CapturedRunViewCalls) {
            expect(call.ResultType).toBe('simple');
        }
    });

    it('uses dialect-aware batched ExtraFilter IN (...) clauses for both mssql and postgresql', async () => {
        const mssqlWorld = buildCompliantWorldFixture('mssql');
        const mssqlProvider = createWorldAuditProvider(mssqlWorld);
        await runSpaceParticipantRoleAudit(mssqlProvider, adminUser, { SpaceIDs: [SPACE_DISCOVERY_ID, SPACE_HARBOR_ID] });

        const mssqlFilters = mssqlWorld.CapturedRunViewCalls.map((c) => c.ExtraFilter ?? '').join('\n');
        expect(mssqlFilters).toContain('[SpaceID] IN (');
        expect(mssqlFilters).toContain('[ID] IN (');

        const pgWorld = buildCompliantWorldFixture('postgresql');
        const pgProvider = createWorldAuditProvider(pgWorld);
        const pgRes = await runSpaceParticipantRoleAudit(pgProvider, adminUser, { SpaceIDs: [SPACE_DISCOVERY_ID, SPACE_HARBOR_ID] });

        expect(pgRes.Dialect).toBe('postgresql');
        expect(pgRes.Passed).toBe(true);
        const pgFilters = pgWorld.CapturedRunViewCalls.map((c) => c.ExtraFilter ?? '').join('\n');
        expect(pgFilters).toContain('"SpaceID" IN (');
        expect(pgFilters).toContain('"ID" IN (');
    });

    it('detects elevated external roles, Team band exposure, and external seats on StaffOnly spaces', async () => {
        const world = buildCompliantWorldFixture();
        world.SpaceMembers.push(
            {
                ID: '99000001-0000-4000-8000-000000000001',
                SpaceID: SPACE_DISCOVERY_ID,
                UserID: USER_BEA_ID,
                SpaceRoleTypeID: SPACE_ROLE_OWNER_ID,
                Band: 'Team',
                Status: 'Active',
            },
            {
                ID: '99000001-0000-4000-8000-000000000002',
                SpaceID: SPACE_STAFF_ONLY_ID,
                UserID: USER_BEA_ID,
                SpaceRoleTypeID: SPACE_ROLE_CLIENT_MEMBER_ID,
                Band: 'Shared',
                Status: 'Active',
            },
        );
        const provider = createWorldAuditProvider(world);

        const result = await runSpaceParticipantRoleAudit(provider, adminUser);

        expect(result.Passed).toBe(false);
        const codes = new Set(result.Findings.map((f) => f.Code));
        expect(codes.has('ELEVATED_EXTERNAL_ROLE')).toBe(true);
        expect(codes.has('EXTERNAL_TEAM_BAND_EXPOSURE')).toBe(true);
        expect(codes.has('EXTERNAL_ON_STAFF_ONLY_SPACE')).toBe(true);
    });

    it('detects cross-space role leaks when an unsealed StaffOnly child space inherits from a parent with external seats', async () => {
        const world = buildCompliantWorldFixture();
        const staffChild = world.Spaces.find((s) => s.ID === SPACE_STAFF_ONLY_ID)!;
        staffChild.InheritsMembership = true; // Leak from Northwind (where Casey is seated) into StaffOnly child!
        const provider = createWorldAuditProvider(world);

        const result = await runSpaceParticipantRoleAudit(provider, adminUser);

        expect(result.Passed).toBe(false);
        const leak = result.Findings.find((f) => f.Code === 'CROSS_SPACE_ROLE_LEAK');
        expect(leak).toBeDefined();
        expect(leak?.SpaceID).toBe(SPACE_STAFF_ONLY_ID);
    });

    it('detects orphaned space/user/role bindings, external space owners, inactive users, and band/role mismatches', async () => {
        const world = buildCompliantWorldFixture();
        world.Spaces.push({
            ID: 'C1000001-0000-4000-8000-000000000077',
            Name: 'External Owned Space',
            ParentID: null,
            SpaceTypeID: SPACE_TYPE_STAFF_ONLY_ID,
            InheritsMembership: false,
            OwnerID: USER_BEA_ID,
            StatusID: null,
            ClosedAt: null,
        });
        const inactiveUserId = 'D2000001-0000-4000-8000-000000000077';
        world.Users.push({ ID: inactiveUserId, Name: 'Inactive', Email: 'inactive@example.com', Type: 'User', IsActive: false });
        world.SpaceMembers.push(
            {
                ID: '99000001-0000-4000-8000-000000000011',
                SpaceID: 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC',
                UserID: USER_ADA_ID,
                SpaceRoleTypeID: SPACE_ROLE_MEMBER_ID,
                Band: 'Team',
                Status: 'Active',
            },
            {
                ID: '99000001-0000-4000-8000-000000000012',
                SpaceID: SPACE_DELIVERY_ID,
                UserID: 'DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD',
                SpaceRoleTypeID: SPACE_ROLE_MEMBER_ID,
                Band: 'Team',
                Status: 'Active',
            },
            {
                ID: '99000001-0000-4000-8000-000000000013',
                SpaceID: SPACE_DELIVERY_ID,
                UserID: inactiveUserId,
                SpaceRoleTypeID: 'EEEEEEEE-EEEE-4EEE-8EEE-EEEEEEEEEEEE',
                Band: 'Team',
                Status: 'Active',
            },
            {
                ID: '99000001-0000-4000-8000-000000000014',
                SpaceID: SPACE_NORTHWIND_ID,
                UserID: USER_NORA_ID,
                SpaceRoleTypeID: SPACE_ROLE_CLIENT_MEMBER_ID,
                Band: 'Team',
                Status: 'Active',
            },
        );
        const provider = createWorldAuditProvider(world);

        const result = await runSpaceParticipantRoleAudit(provider, adminUser);

        expect(result.Passed).toBe(false);
        const codes = new Set(result.Findings.map((f) => f.Code));
        expect(codes.has('EXTERNAL_SPACE_OWNER')).toBe(true);
        expect(codes.has('ORPHANED_SPACE_BINDING')).toBe(true);
        expect(codes.has('INACTIVE_MEMBER_ACCOUNT')).toBe(true);
        expect(codes.has('INVALID_SPACE_BINDING')).toBe(true);
        expect(codes.has('BAND_ROLE_MISMATCH')).toBe(true);
    });

    it('resolves polymorphic links strictly via EntityField.EntityIDFieldName (never guessing column names) and detects orphaned/cross-space links', async () => {
        const world = buildCompliantWorldFixture();
        // Add a custom Collaboration entity using non-standard column names wired ONLY via EntityIDFieldName
        const customEntityId = 'CE000001-0000-4000-8000-000000000001';
        world.Entities.push(
            makeEntityInfo({
                ID: customEntityId,
                Name: 'MJ_BizApps_Collaboration: Custom Links',
                Fields: [
                    makeEntityField({ Name: 'ID', IsPrimaryKey: true }),
                    makeEntityField({ Name: 'SpaceID' }),
                    makeEntityField({ Name: 'CustomDiscriminatorCol' }),
                    makeEntityField({ Name: 'CustomPayloadCol', EntityIDFieldName: 'CustomDiscriminatorCol' }),
                ],
                Permissions: [],
            }),
        );
        world.CustomPolymorphicRows = {
            'MJ_BizApps_Collaboration: Custom Links': [
                // Valid link
                {
                    ID: 'CF000001-0000-4000-8000-000000000001',
                    SpaceID: SPACE_DISCOVERY_ID,
                    CustomDiscriminatorCol: FILE_ENTITY_ID,
                    CustomPayloadCol: FILE_ONE_ID,
                },
                // Orphaned target link
                {
                    ID: 'CF000001-0000-4000-8000-000000000002',
                    SpaceID: SPACE_DISCOVERY_ID,
                    CustomDiscriminatorCol: FILE_ENTITY_ID,
                    CustomPayloadCol: 'FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF',
                },
            ],
        };
        // Also inject a cross-space pin from Discovery -> Harbor's SpaceItem
        world.SpaceMemberPins.push({
            ID: '4A000001-0000-4000-8000-000000000099',
            SpaceID: SPACE_DISCOVERY_ID,
            TargetEntityID: world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Items')!.ID,
            TargetRecordID: '1A000001-0000-4000-8000-000000000002', // belongs to Harbor!
        });
        const provider = createWorldAuditProvider(world);

        const result = await runSpaceParticipantRoleAudit(provider, adminUser);

        expect(result.Passed).toBe(false);
        expect(result.Findings.some((f) => f.Code === 'ORPHANED_POLYMORPHIC_LINK' && f.FieldName === 'CustomPayloadCol' && f.EntityIDFieldName === 'CustomDiscriminatorCol')).toBe(true);
        expect(result.Findings.some((f) => f.Code === 'CROSS_SPACE_POLYMORPHIC_LINK' && f.EntityName === 'MJ_BizApps_Collaboration: Space Member Pins')).toBe(true);
    });

    it('registers BaseRemotableOperation in ClassFactory and enforces ContextUser authorization (rejecting external & unprivileged callers)', async () => {
        LoadCollaborationSecurityAuditOperations();
        const op = MJGlobal.Instance.ClassFactory.CreateInstance<SpaceParticipantRoleAuditOperation>(
            BaseRemotableOperation,
            SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY,
        );
        expect(op).toBeInstanceOf(SpaceParticipantRoleAuditOperation);
        expect(op?.DisallowMagicLinkScope).toBe(true);
        expect(op?.GrantsServerWriteAuthority).toBe(false);

        const world = buildCompliantWorldFixture();
        const provider = createWorldAuditProvider(world);

        // Positive: authorized admin/staff caller
        const okRes = await op!.ExecuteServer({}, { provider, user: staffAdminUser, emitProgress: () => {} });
        expect(okRes.Success).toBe(true);
        expect(okRes.Output?.Passed).toBe(true);

        // Negative 1: external participant
        const partRes = await op!.ExecuteServer({}, { provider, user: participantCaller, emitProgress: () => {} });
        expect(partRes.Success).toBe(false);
        expect(partRes.ResultCode).toBe('FORBIDDEN');

        // Negative 2: magic link session even with staff role
        const magicUser = makeUserInfo({
            ID: USER_ADA_ID,
            RoleIDs: [ROLE_UI_ID],
            IsMagicLinkAnonymous: true,
            MagicLinkScope: { ResourceID: SPACE_DISCOVERY_ID, ResourceType: 'Space' },
        });
        const magicRes = await op!.ExecuteServer({}, { provider, user: magicUser, emitProgress: () => {} });
        expect(magicRes.Success).toBe(false);
        expect(magicRes.ResultCode).toBe('FORBIDDEN');

        // Negative 3: unprivileged staff role without Administer Spaces / Configure Space Types
        const unprivilegedRole = '99999999-9999-4999-8999-999999999999';
        const unprivileged = makeUserInfo({ ID: USER_NORA_ID, RoleIDs: [unprivilegedRole] });
        const unprivRes = await op!.ExecuteServer({}, { provider, user: unprivileged, emitProgress: () => {} });
        expect(unprivRes.Success).toBe(false);
        expect(unprivRes.ResultCode).toBe('FORBIDDEN');

        // Negative 4: overlapping Space Participant + Developer role is also rejected
        const overlap = makeUserInfo({ ID: USER_DEV_ID, RoleIDs: [ROLE_DEVELOPER_ID, PARTICIPANT_ROLE_ID] });
        const overlapRes = await op!.ExecuteServer({}, { provider, user: overlap, emitProgress: () => {} });
        expect(overlapRes.Success).toBe(false);
        expect(overlapRes.ResultCode).toBe('FORBIDDEN');
    });

    it('detects external member assigned to Admin space role type (CanPromoteBand / CanSeeTeamBand)', async () => {
        const world = buildCompliantWorldFixture();
        world.SpaceMembers.push({
            ID: '99000001-0000-4000-8000-000000000088',
            SpaceID: SPACE_DISCOVERY_ID,
            UserID: USER_BEA_ID,
            SpaceRoleTypeID: SPACE_ROLE_ADMIN_ID,
            Band: 'Shared',
            Status: 'Active',
        });
        const provider = createWorldAuditProvider(world);
        const result = await runSpaceParticipantRoleAudit(provider, adminUser);
        expect(result.Passed).toBe(false);
        expect(result.Findings.some((f) => f.Code === 'ELEVATED_EXTERNAL_ROLE')).toBe(true);
    });
});
