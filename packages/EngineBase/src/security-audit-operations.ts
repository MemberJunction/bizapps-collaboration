import { BootEntityGrantInventoryOperation } from './boot-entity-grant-inventory.js';
import {
    CollaborationPersonaSecurityProbe,
    CollaborationPersonaSecurityVerifier,
    PersonaSecurityProbeOperation,
} from './persona-security-probe.js';
import { SpaceParticipantRoleAuditOperation } from './space-participant-role-audit.js';
import { StaffRoleAuditOperation } from './staff-role-audit.js';

/**
 * Retains all Collaboration security audit & persona probe `@RegisterClass` subclasses
 * against bundler tree-shaking on server and client startup.
 */
export function LoadCollaborationSecurityAuditOperations(): void {
    void SpaceParticipantRoleAuditOperation;
    void StaffRoleAuditOperation;
    void BootEntityGrantInventoryOperation;
    void CollaborationPersonaSecurityProbe;
    void CollaborationPersonaSecurityVerifier;
    void PersonaSecurityProbeOperation;
}
