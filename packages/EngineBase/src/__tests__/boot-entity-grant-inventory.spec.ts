import { describe, it, expect } from 'vitest';
import { BaseRemotableOperation } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY,
    BootEntityGrantInventoryOperation,
    COLLABORATION_BOOT_ENTITY_REGISTRY,
    COLLABORATION_POLYMORPHIC_FK_SPECS,
    LoadCollaborationSecurityAuditOperations,
    PARTICIPANT_ROLE_ID,
    runBootEntityGrantInventory,
} from '../index.js';
import {
    buildCompliantWorldFixture,
    createWorldAuditProvider,
    FILTER_PERMISSIVE_ONE_EQUALS_ONE_ID,
    makeEntityField,
    makeEntityInfo,
    makeEntityPermission,
    makeUserInfo,
    ROLE_DEVELOPER_ID,
    ROLE_UI_ID,
    USER_BEA_ID,
    USER_DEV_ID,
} from './audit-test-fixtures.js';

describe('XS-2 Boot Entity Grant Filter Inventory', () => {
    const adminUser = makeUserInfo({ ID: USER_DEV_ID, Type: 'Owner', RoleIDs: [ROLE_DEVELOPER_ID] });
    const participantCaller = makeUserInfo({ ID: USER_BEA_ID, Type: 'User', RoleIDs: [PARTICIPANT_ROLE_ID] });

    it('enumerates 100% of boot-loaded Collaboration entities and passes when all have scoped filters and valid EntityIDFieldName metadata', async () => {
        const world = buildCompliantWorldFixture('mssql');
        const provider = createWorldAuditProvider(world);

        const result = await runBootEntityGrantInventory(provider, adminUser, {
            RestrictedStaffRoleIDs: [ROLE_UI_ID],
        });

        expect(result.Passed).toBe(true);
        expect(result.Findings).toEqual([]);
        expect(result.TotalEntitiesChecked).toBe(COLLABORATION_BOOT_ENTITY_REGISTRY.length);
        expect(result.Entities.every((e) => e.Passed)).toBe(true);
        expect(world.GetEntityObjectCallCount).toBe(0);
    });

    it('fails deterministically when any boot-loaded entity lacks a ReadRLSFilterID or uses an overly permissive filter', async () => {
        const world = buildCompliantWorldFixture();
        // 1. Strip ReadRLSFilterID from Space Notes
        const spaceNotes = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Notes')!;
        spaceNotes.Permissions[0].ReadRLSFilterID = '';

        // 2. Replace Space Items ReadRLSFilterID with (1 = 1)
        const spaceItems = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Items')!;
        spaceItems.Permissions[0].ReadRLSFilterID = FILTER_PERMISSIVE_ONE_EQUALS_ONE_ID;

        // 3. Replace shell boot entity MJ: Dashboards filter with (1 = 1) instead of (1 = 0)
        const dashboards = world.Entities.find((e) => e.Name === 'MJ: Dashboards')!;
        dashboards.Permissions[0].ReadRLSFilterID = FILTER_PERMISSIVE_ONE_EQUALS_ONE_ID;

        const provider = createWorldAuditProvider(world);
        const result = await runBootEntityGrantInventory(provider, adminUser);

        expect(result.Passed).toBe(false);
        const codes = new Set(result.Findings.map((f) => f.Code));
        expect(codes.has('MISSING_READ_RLS_FILTER')).toBe(true);
        expect(codes.has('OVERLY_PERMISSIVE_RLS_FILTER')).toBe(true);
        expect(codes.has('OVERLY_PERMISSIVE_SHELL_FILTER')).toBe(true);
    });

    it('detects AllowAllRowsAPI=true, participant read on staff-only Space Grants, missing write/UI filters, and unregistered entities', async () => {
        const world = buildCompliantWorldFixture();
        const spaceChats = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Chats')!;
        spaceChats.AllowAllRowsAPI = true;

        const spaceGrants = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Grants')!;
        spaceGrants.Permissions.push(
            makeEntityPermission({
                EntityID: spaceGrants.ID,
                RoleID: PARTICIPANT_ROLE_ID,
                CanRead: true,
            }),
        );
        // Strip UI ReadRLSFilterID from Space Grants
        const uiPerm = spaceGrants.Permissions.find((p) => p.RoleID.toLowerCase() === ROLE_UI_ID.toLowerCase())!;
        uiPerm.ReadRLSFilterID = '';

        // Enable CanDelete without DeleteRLSFilterID on Space Notes
        const spaceNotes = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Notes')!;
        spaceNotes.Permissions[0].CanDelete = true;
        spaceNotes.Permissions[0].DeleteRLSFilterID = '';

        // Add an unregistered Collaboration entity
        world.Entities.push(
            makeEntityInfo({
                ID: '99999999-0000-4000-8000-000000000001',
                Name: 'MJ_BizApps_Collaboration: Unregistered Entity',
                Fields: [makeEntityField({ Name: 'ID', IsPrimaryKey: true })],
                Permissions: [],
            }),
        );

        const provider = createWorldAuditProvider(world);
        const result = await runBootEntityGrantInventory(provider, adminUser, {
            RestrictedStaffRoleIDs: [ROLE_UI_ID],
        });

        expect(result.Passed).toBe(false);
        const codes = new Set(result.Findings.map((f) => f.Code));
        expect(codes.has('ALLOW_ALL_ROWS_ENABLED')).toBe(true);
        expect(codes.has('PARTICIPANT_HAS_ADMIN_READ')).toBe(true);
        expect(codes.has('MISSING_UI_ROLE_READ_FILTER')).toBe(true);
        expect(codes.has('MISSING_DELETE_RLS_FILTER')).toBe(true);
        expect(codes.has('UNREGISTERED_COLLABORATION_ENTITY')).toBe(true);
    });

    it('detects missing or invalid EntityIDFieldName metadata on polymorphic FKs', async () => {
        const world = buildCompliantWorldFixture();
        const spaceAnchors = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Anchors')!;
        const recordField = spaceAnchors.Fields.find((f) => f.Name === 'RecordID')!;
        recordField.EntityIDFieldName = '';

        const spaceGrants = world.Entities.find((e) => e.Name === 'MJ_BizApps_Collaboration: Space Grants')!;
        spaceGrants.Fields.push(makeEntityField({ Name: 'ExtraPolyID', EntityIDFieldName: 'NonExistentEntityIDCol' }));

        const provider = createWorldAuditProvider(world);
        const result = await runBootEntityGrantInventory(provider, adminUser);

        expect(result.Passed).toBe(false);
        const codes = new Set(result.Findings.map((f) => f.Code));
        expect(codes.has('MISSING_ENTITY_ID_FIELD_NAME')).toBe(true);
        expect(codes.has('INVALID_ENTITY_ID_FIELD_NAME')).toBe(true);
    });

    it('declares all 6 polymorphic FK specs and Artifact RLS policies matching Collaboration metadata', () => {
        expect(COLLABORATION_POLYMORPHIC_FK_SPECS.length).toBe(6);
        expect(COLLABORATION_BOOT_ENTITY_REGISTRY.length).toBeGreaterThanOrEqual(81);

        const byName = new Map(COLLABORATION_BOOT_ENTITY_REGISTRY.map((e) => [e.EntityName, e]));
        expect(byName.get('MJ: Artifact Types')?.PolicyKind).toBe('active-catalog');
        expect(byName.get('MJ: Artifacts')?.PolicyKind).toBe('reach-scoped');
        expect(byName.get('MJ: Artifacts')?.RequireUiRoleReadFilter).toBe(true);
        expect(byName.get('MJ: Artifact Versions')?.PolicyKind).toBe('reach-scoped');
        expect(byName.get('MJ: Artifact Versions')?.RequireUiRoleReadFilter).toBe(true);
        expect(byName.get('MJ: Artifact Version Attributes')?.PolicyKind).toBe('reach-scoped');
        expect(byName.get('MJ: Artifact Permissions')?.PolicyKind).toBe('reach-scoped');
        expect(byName.get('MJ: Artifact Uses')?.PolicyKind).toBe('reach-scoped');
        expect(byName.get('MJ: Conversation Detail Artifacts')?.PolicyKind).toBe('reach-scoped');
        expect(byName.get('MJ: Collection Artifacts')?.PolicyKind).toBe('shell-deny-all');
        expect(byName.get('MJ: Conversation Artifacts')?.PolicyKind).toBe('shell-deny-all');
    });

    it('registers BootEntityGrantInventoryOperation and enforces ContextUser authorization', async () => {
        LoadCollaborationSecurityAuditOperations();
        const op = MJGlobal.Instance.ClassFactory.CreateInstance<BootEntityGrantInventoryOperation>(
            BaseRemotableOperation,
            BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY,
        );
        expect(op).toBeInstanceOf(BootEntityGrantInventoryOperation);
        expect(op?.DisallowMagicLinkScope).toBe(true);

        const world = buildCompliantWorldFixture('postgresql');
        const provider = createWorldAuditProvider(world);

        const okRes = await op!.ExecuteServer({}, { provider, user: adminUser, emitProgress: () => {} });
        expect(okRes.Success).toBe(true);
        expect(okRes.Output?.Passed).toBe(true);
        expect(okRes.Output?.Dialect).toBe('postgresql');

        const deniedRes = await op!.ExecuteServer({}, { provider, user: participantCaller, emitProgress: () => {} });
        expect(deniedRes.Success).toBe(false);
        expect(deniedRes.ResultCode).toBe('FORBIDDEN');
    });
});
