import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BaseRemotableOperation } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY,
    BootEntityGrantInventoryOperation,
    SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY,
    SpaceParticipantRoleAuditOperation,
    STAFF_ROLE_AUDIT_OPERATION_KEY,
    StaffRoleAuditOperation,
} from '@mj-biz-apps/collaboration-core-entities-server';

// @memberjunction/server evaluates LoadConfig() on module load; provide benign non-secret
// placeholder defaults when running unit tests without a local DB config, then restore.
const heldEnv = {
    DB_DATABASE: process.env.DB_DATABASE,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
};
process.env.DB_DATABASE ??= 'unit_test_db';
process.env.DB_USERNAME ??= 'unit_test_user';
process.env.DB_PASSWORD ??= 'unit_test_placeholder';

const { LoadBizAppsCollaborationServer } = await import('../dist/index.js');

if (heldEnv.DB_DATABASE === undefined) delete process.env.DB_DATABASE;
if (heldEnv.DB_USERNAME === undefined) delete process.env.DB_USERNAME;
if (heldEnv.DB_PASSWORD === undefined) delete process.env.DB_PASSWORD;

describe('Server bootstrap security audit registration', () => {
    it('LoadBizAppsCollaborationServer retains XS-1, XS-2, and XS-7 BaseRemotableOperation classes in ClassFactory', () => {
        LoadBizAppsCollaborationServer();

        const op1 = MJGlobal.Instance.ClassFactory.CreateInstance<SpaceParticipantRoleAuditOperation>(
            BaseRemotableOperation,
            SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY,
        );
        const op2 = MJGlobal.Instance.ClassFactory.CreateInstance<BootEntityGrantInventoryOperation>(
            BaseRemotableOperation,
            BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY,
        );
        const op7 = MJGlobal.Instance.ClassFactory.CreateInstance<StaffRoleAuditOperation>(
            BaseRemotableOperation,
            STAFF_ROLE_AUDIT_OPERATION_KEY,
        );

        assert.ok(op1 instanceof SpaceParticipantRoleAuditOperation);
        assert.ok(op2 instanceof BootEntityGrantInventoryOperation);
        assert.ok(op7 instanceof StaffRoleAuditOperation);
    });
});
