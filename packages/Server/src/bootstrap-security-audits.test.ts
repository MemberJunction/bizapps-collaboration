import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BaseRemotableOperation } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    BaseHealthProbe,
    BaseLiveCrudVerifier,
    BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY,
    BootEntityGrantInventoryOperation,
    CollaborationPersonaSecurityProbe,
    CollaborationPersonaSecurityVerifier,
    GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
    GetCollaborationCommsV2DirectMessageDispatcher,
    GetCollaborationCommsV2Transport,
    GetUserNotificationPreferencesOperation,
    MJCommsV2NotificationTransport,
    PERSONA_SECURITY_PROBE_KEY,
    PERSONA_SECURITY_PROBE_OPERATION_KEY,
    PERSONA_SECURITY_VERIFIER_KEY,
    PersonaSecurityProbeOperation,
    PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY,
    PreviewScopedSpaceDigestOperation,
    ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY,
    RouteCollaborationNotificationsOperation,
    RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
    RunScopedSpaceDigestsOperation,
    SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY,
    SpaceParticipantRoleAuditOperation,
    STAFF_ROLE_AUDIT_OPERATION_KEY,
    StaffRoleAuditOperation,
    UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
    UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
    UpdateSpaceDigestCheckpointOperation,
    UpdateUserNotificationPreferencesOperation,
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
        const op3 = MJGlobal.Instance.ClassFactory.CreateInstance<PersonaSecurityProbeOperation>(
            BaseRemotableOperation,
            PERSONA_SECURITY_PROBE_OPERATION_KEY,
        );
        const probe3 = MJGlobal.Instance.ClassFactory.CreateInstance<CollaborationPersonaSecurityProbe>(
            BaseHealthProbe,
            PERSONA_SECURITY_PROBE_KEY,
        );
        const verifier3 = MJGlobal.Instance.ClassFactory.CreateInstance<CollaborationPersonaSecurityVerifier>(
            BaseLiveCrudVerifier,
            PERSONA_SECURITY_VERIFIER_KEY,
        );

        assert.ok(op1 instanceof SpaceParticipantRoleAuditOperation);
        assert.ok(op2 instanceof BootEntityGrantInventoryOperation);
        assert.ok(op7 instanceof StaffRoleAuditOperation);
        assert.ok(op3 instanceof PersonaSecurityProbeOperation);
        assert.ok(probe3 instanceof CollaborationPersonaSecurityProbe);
        assert.ok(verifier3 instanceof CollaborationPersonaSecurityVerifier);

        const opRoute = MJGlobal.Instance.ClassFactory.CreateInstance<RouteCollaborationNotificationsOperation>(
            BaseRemotableOperation,
            ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY,
        );
        const opGetPrefs = MJGlobal.Instance.ClassFactory.CreateInstance<GetUserNotificationPreferencesOperation>(
            BaseRemotableOperation,
            GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
        );
        const opUpdatePrefs = MJGlobal.Instance.ClassFactory.CreateInstance<UpdateUserNotificationPreferencesOperation>(
            BaseRemotableOperation,
            UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
        );
        assert.ok(opRoute instanceof RouteCollaborationNotificationsOperation);
        assert.ok(opGetPrefs instanceof GetUserNotificationPreferencesOperation);
        assert.ok(opUpdatePrefs instanceof UpdateUserNotificationPreferencesOperation);

        const opRunDigest = MJGlobal.Instance.ClassFactory.CreateInstance<RunScopedSpaceDigestsOperation>(
            BaseRemotableOperation,
            RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
        );
        const opPreviewDigest = MJGlobal.Instance.ClassFactory.CreateInstance<PreviewScopedSpaceDigestOperation>(
            BaseRemotableOperation,
            PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY,
        );
        const opUpdateCheckpoint = MJGlobal.Instance.ClassFactory.CreateInstance<UpdateSpaceDigestCheckpointOperation>(
            BaseRemotableOperation,
            UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
        );
        assert.ok(opRunDigest instanceof RunScopedSpaceDigestsOperation);
        assert.ok(opPreviewDigest instanceof PreviewScopedSpaceDigestOperation);
        assert.ok(opUpdateCheckpoint instanceof UpdateSpaceDigestCheckpointOperation);
        assert.ok(GetCollaborationCommsV2Transport() instanceof MJCommsV2NotificationTransport);
        assert.ok(typeof GetCollaborationCommsV2DirectMessageDispatcher() === 'function');
    });
});
