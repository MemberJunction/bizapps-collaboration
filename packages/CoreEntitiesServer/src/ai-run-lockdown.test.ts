import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
    BaseEntity,
    EntityFieldInfo,
    EntityFieldPermissionInfo,
    EntityInfo,
    FieldPermissionAccess,
    ServerOperationScopeManager,
    UserInfo,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    COLLABORATION_AGENT_TURN_OPERATION,
    COLLABORATION_AI_RUN_LOCKDOWN_ENTITIES,
    CollaborationAIAgentRunEntityServer,
    CollaborationAIAgentRunStepEntityServer,
    CollaborationAIPromptRunEntityServer,
    LoadCollaborationAIRunLockdown,
    evaluateParticipantAIRunWriteAccess,
    runWithCollaborationAgentTurnAuthority,
    syncPromptRunBasePrototype,
} from '../dist/ai-run-lockdown.js';
import { PARTICIPANT_ROLE_ID } from '../dist/task-attribution.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const UI_ROLE_ID = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E';
const CUSTOM_NON_STAFF_ROLE_ID = '99999999-8888-4777-8666-555555555555';

interface CorePermissionEntry {
    primaryKey?: { ID?: string };
    fields?: {
        EntityID?: string;
        RoleID?: string;
        Type?: string;
        CanCreate?: number;
        CanRead?: number;
        CanUpdate?: number;
        CanDelete?: number;
        ReadRLSFilterID?: string;
        CreateRLSFilterID?: string;
        UpdateRLSFilterID?: string;
    };
}

interface FieldPermissionEntry {
    primaryKey?: { ID?: string };
    fields?: {
        EntityFieldID?: string;
        RoleID?: string;
        ReadAccess?: string;
        UpdateAccess?: string;
        CreateAccess?: string;
    };
}

interface EntityFlSEntry {
    primaryKey?: { ID?: string };
    fields?: {
        EnableFieldLevelSecurity?: number | boolean;
    };
}

function makeUser(id: string, name: string, roleIds: readonly string[]): UserInfo {
    return new UserInfo(undefined, {
        ID: id,
        Name: name,
        Email: `${name.toLowerCase()}@example.com`,
        UserRoles: roleIds.map((roleId, idx) => ({
            ID: `ur-${idx + 1}-${id}`,
            UserID: id,
            RoleID: roleId,
            Role: roleId === PARTICIPANT_ROLE_ID ? 'Space Participant' : 'Custom Role',
        })),
    });
}

function toFieldAccess(raw: string | undefined): FieldPermissionAccess {
    switch (raw) {
        case 'Allow':
            return FieldPermissionAccess.Allow;
        case 'Deny':
            return FieldPermissionAccess.Deny;
        default:
            return FieldPermissionAccess.NoAccess;
    }
}

describe('CT-7 AI Run Lockdown & CT-8 Agent Owner Name Projection', () => {
    const participantUser = makeUser('11111111-1111-4111-8111-111111111111', 'Bea', [PARTICIPANT_ROLE_ID]);
    const otherParticipant = makeUser('22222222-2222-4222-8222-222222222222', 'Cal', [PARTICIPANT_ROLE_ID]);
    const multiRoleParticipant = makeUser('33333333-3333-4333-8333-333333333333', 'Dax', [
        PARTICIPANT_ROLE_ID,
        CUSTOM_NON_STAFF_ROLE_ID,
    ]);
    const staffUser = makeUser('44444444-4444-4444-8444-444444444444', 'Ada', [UI_ROLE_ID]);

    describe('CT-7 Metadata & RLS configuration', () => {
        it('enforces CanDelete = 0 and RLS filters on Space Participant AI run permissions', () => {
            const raw = fs.readFileSync(
                path.join(REPO_ROOT, 'metadata/entity-permissions/.core-entity-permissions.json'),
                'utf8'
            );
            const entries = JSON.parse(raw) as CorePermissionEntry[];
            const byEntity = new Map<string, CorePermissionEntry['fields']>();
            for (const entry of entries) {
                const fields = entry.fields;
                if (
                    fields?.RoleID === '@lookup:MJ: Roles.Name=Space Participant' &&
                    typeof fields.EntityID === 'string'
                ) {
                    byEntity.set(fields.EntityID, fields);
                }
            }

            const agentRunGrant = byEntity.get('@lookup:MJ: Entities.Name=MJ: AI Agent Runs');
            assert.ok(agentRunGrant, 'Space Participant grant for MJ: AI Agent Runs must exist');
            assert.equal(agentRunGrant.CanDelete, 0);
            assert.equal(
                agentRunGrant.ReadRLSFilterID,
                '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Own Agent Runs'
            );
            assert.equal(
                agentRunGrant.CreateRLSFilterID,
                '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Own Agent Runs'
            );
            assert.equal(
                agentRunGrant.UpdateRLSFilterID,
                '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Own Agent Runs'
            );

            const stepGrant = byEntity.get('@lookup:MJ: Entities.Name=MJ: AI Agent Run Steps');
            assert.ok(stepGrant, 'Space Participant grant for MJ: AI Agent Run Steps must exist');
            assert.equal(stepGrant.CanDelete, 0);
            assert.equal(
                stepGrant.ReadRLSFilterID,
                '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Own Agent Run Steps'
            );
            assert.equal(
                stepGrant.CreateRLSFilterID,
                '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Own Agent Run Steps'
            );
            assert.equal(
                stepGrant.UpdateRLSFilterID,
                '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Own Agent Run Steps'
            );

            const promptRunGrant = byEntity.get('@lookup:MJ: Entities.Name=MJ: AI Prompt Runs');
            assert.ok(promptRunGrant, 'Space Participant grant for MJ: AI Prompt Runs must exist');
            assert.equal(promptRunGrant.CanDelete, 0);
            assert.equal(
                promptRunGrant.ReadRLSFilterID,
                '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Own Prompt Runs'
            );
            assert.equal(
                promptRunGrant.UpdateRLSFilterID,
                '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Own Prompt Runs'
            );
        });

        it('removes broad AI Agent Run / Step RLS exemptions from persona-check.sql', () => {
            const sql = fs.readFileSync(path.join(REPO_ROOT, 'scripts/persona-check.sql'), 'utf8');
            const exclusionBlock = sql.slice(
                sql.indexOf('p.RoleID = @Participant AND e.Name NOT IN ('),
                sql.indexOf('THROW 50000, \'A participant or UI write operation')
            );
            assert.equal(
                exclusionBlock.includes("N'MJ: AI Agent Runs'"),
                false,
                'MJ: AI Agent Runs must no longer be exempted from participant RLS filter checks'
            );
            assert.equal(
                exclusionBlock.includes("N'MJ: AI Agent Run Steps'"),
                false,
                'MJ: AI Agent Run Steps must no longer be exempted from participant RLS filter checks'
            );
            assert.equal(
                exclusionBlock.includes("p.CanUpdate = 1 AND p.UpdateRLSFilterID IS NULL"),
                true,
                'MJ: AI Prompt Runs must still enforce UpdateRLSFilterID IS NOT NULL'
            );
        });
    });

    describe('CT-7 Server gate on direct CRUD and off-turn writes', () => {
        it('blocks off-turn save/delete for Space Participant and multi-role non-staff, and allows only caller-scoped active turns', async () => {
            for (const entityName of COLLABORATION_AI_RUN_LOCKDOWN_ENTITIES) {
                assert.ok(
                    evaluateParticipantAIRunWriteAccess(entityName, 'save', participantUser),
                    `Off-turn save on ${entityName} must be refused for single-role participant`
                );
                assert.ok(
                    evaluateParticipantAIRunWriteAccess(entityName, 'save', multiRoleParticipant),
                    `Off-turn save on ${entityName} must be refused for multi-role non-staff participant`
                );
                assert.ok(
                    evaluateParticipantAIRunWriteAccess(entityName, 'delete', participantUser),
                    `Delete on ${entityName} must always be refused for participant`
                );
                assert.equal(
                    evaluateParticipantAIRunWriteAccess(entityName, 'save', staffUser),
                    null,
                    `Staff without Space Participant role is not blocked on ${entityName}`
                );

                // Foreign operation must still be blocked
                ServerOperationScopeManager.Instance.RunWithAuthority(
                    {
                        operationKey: 'Unrelated.Operation',
                        source: 'ServerEngine',
                        allowedEntities: [entityName],
                        userId: participantUser.ID,
                    },
                    () => {
                        assert.ok(
                            evaluateParticipantAIRunWriteAccess(entityName, 'save', participantUser),
                            `Unrelated operation must not unlock ${entityName} for participant`
                        );
                    }
                );

                // Authorized turn scope unlocks only for the matching participant user and never for deletes or direct client CRUD
                await runWithCollaborationAgentTurnAuthority(participantUser.ID, async () => {
                    assert.equal(
                        evaluateParticipantAIRunWriteAccess(entityName, 'save', participantUser),
                        null,
                        `Active turn must allow ${entityName} save for acting participant`
                    );
                    assert.ok(
                        evaluateParticipantAIRunWriteAccess(entityName, 'save', otherParticipant),
                        `Active turn for Bea must refuse ${entityName} write acting as Cal`
                    );
                    assert.ok(
                        evaluateParticipantAIRunWriteAccess(entityName, 'delete', participantUser),
                        `Active turn must still forbid ${entityName} delete`
                    );

                    await ServerOperationScopeManager.Instance.RunInClientCrudBoundary(async () => {
                        assert.ok(
                            evaluateParticipantAIRunWriteAccess(entityName, 'save', participantUser),
                            `Direct client CRUD boundary must block ${entityName} save even inside an active scope`
                        );
                    });
                });

                // After scope exits, access locks back down
                assert.ok(
                    evaluateParticipantAIRunWriteAccess(entityName, 'save', participantUser),
                    `Access must re-lock immediately after active turn completes for ${entityName}`
                );
            }
        });

        it('registers high-priority entity server subclasses that refuse off-turn Save/Delete with failure LatestResult', async () => {
            LoadCollaborationAIRunLockdown();

            const runEntityInfo = new EntityInfo({
                ID: 'a1000000-0000-4000-8000-000000000001',
                Name: 'MJ: AI Agent Runs',
            });
            const stepEntityInfo = new EntityInfo({
                ID: 'a1000000-0000-4000-8000-000000000002',
                Name: 'MJ: AI Agent Run Steps',
            });
            const promptEntityInfo = new EntityInfo({
                ID: 'a1000000-0000-4000-8000-000000000003',
                Name: 'MJ: AI Prompt Runs',
            });

            const runReg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseEntity, 'MJ: AI Agent Runs');
            const stepReg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseEntity, 'MJ: AI Agent Run Steps');
            const promptReg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseEntity, 'MJ: AI Prompt Runs');

            assert.equal(runReg?.SubClass, CollaborationAIAgentRunEntityServer);
            assert.equal(stepReg?.SubClass, CollaborationAIAgentRunStepEntityServer);
            assert.equal(promptReg?.SubClass, CollaborationAIPromptRunEntityServer);

            const runInstance = new CollaborationAIAgentRunEntityServer(runEntityInfo);
            runInstance.ContextCurrentUser = participantUser;
            assert.equal(await runInstance.Save(), false, 'Off-turn Run Save must return false');
            assert.equal(runInstance.LatestResult?.Success, false);
            assert.match(runInstance.LatestResult?.Message ?? '', /outside an active space chat turn/i);
            assert.equal(await runInstance.Delete(), false, 'Run Delete must return false');
            assert.equal(runInstance.LatestResult?.Success, false);

            const stepInstance = new CollaborationAIAgentRunStepEntityServer(stepEntityInfo);
            stepInstance.ContextCurrentUser = participantUser;
            assert.equal(await stepInstance.Save(), false, 'Off-turn Step Save must return false');
            assert.equal(stepInstance.LatestResult?.Success, false);
            assert.equal(await stepInstance.Delete(), false, 'Step Delete must return false');

            const promptInstance = new CollaborationAIPromptRunEntityServer(promptEntityInfo);
            promptInstance.ContextCurrentUser = participantUser;
            assert.equal(await promptInstance.Save(), false, 'Off-turn Prompt Run Save must return false');
            assert.equal(promptInstance.LatestResult?.Success, false);
            assert.equal(await promptInstance.Delete(), false, 'Prompt Run Delete must return false');

            // Verify syncPromptRunBasePrototype chains and reclaims winner even if MJAIPromptRunEntityServer registers later
            class LateRegisteredPromptRunServer extends BaseEntity {
                public CustomCostHook(): string {
                    return 'cost-calculated';
                }
            }
            const beforeSyncProto = Object.getPrototypeOf(CollaborationAIPromptRunEntityServer.prototype);
            const beforeSyncCtor = Object.getPrototypeOf(CollaborationAIPromptRunEntityServer);
            try {
                MJGlobal.Instance.ClassFactory.Register(
                    BaseEntity,
                    LateRegisteredPromptRunServer,
                    'MJ: AI Prompt Runs',
                    500
                );
                assert.equal(
                    MJGlobal.Instance.ClassFactory.GetRegistration(BaseEntity, 'MJ: AI Prompt Runs')?.SubClass,
                    LateRegisteredPromptRunServer
                );
                syncPromptRunBasePrototype();
                assert.equal(
                    MJGlobal.Instance.ClassFactory.GetRegistration(BaseEntity, 'MJ: AI Prompt Runs')?.SubClass,
                    CollaborationAIPromptRunEntityServer,
                    'LoadCollaborationAIRunLockdown must keep CollaborationAIPromptRunEntityServer active above later prompt run subclasses'
                );
            } finally {
                Object.setPrototypeOf(CollaborationAIPromptRunEntityServer.prototype, beforeSyncProto);
                Object.setPrototypeOf(CollaborationAIPromptRunEntityServer, beforeSyncCtor);
            }

            assert.equal(COLLABORATION_AGENT_TURN_OPERATION, 'Collaboration.ExecuteSpaceChatTurn');
        });
    });

    describe('CT-8 Agent Owner Name Projection on Agents In Reach', () => {
        it('orders entities after entity-field-permissions and enables FLS on MJ: AI Agents with OwnerUser/OwnerUserID denied to Space Participant', () => {
            const syncCfg = JSON.parse(
                fs.readFileSync(path.join(REPO_ROOT, 'metadata/.mj-sync.json'), 'utf8')
            ) as { directoryOrder: string[] };
            const permsIdx = syncCfg.directoryOrder.indexOf('entity-permissions');
            const flsIdx = syncCfg.directoryOrder.indexOf('entity-field-permissions');
            const entitiesIdx = syncCfg.directoryOrder.indexOf('entities');
            assert.ok(permsIdx >= 0 && flsIdx > permsIdx && entitiesIdx > flsIdx,
                'metadata/.mj-sync.json must push entity-permissions -> entity-field-permissions -> entities');

            const entityEntries = JSON.parse(
                fs.readFileSync(path.join(REPO_ROOT, 'metadata/entities/.ai-agents-fls.json'), 'utf8')
            ) as EntityFlSEntry[];
            const aiAgentFlsEntry = entityEntries.find(
                (e) => e.primaryKey?.ID === '@lookup:MJ: Entities.Name=MJ: AI Agents'
            );
            assert.ok(aiAgentFlsEntry, '.ai-agents-fls.json must target MJ: AI Agents');
            assert.equal(Number(aiAgentFlsEntry.fields?.EnableFieldLevelSecurity), 1);

            const flsRows = JSON.parse(
                fs.readFileSync(
                    path.join(REPO_ROOT, 'metadata/entity-field-permissions/.entity-field-permissions.json'),
                    'utf8'
                )
            ) as FieldPermissionEntry[];

            const agentFieldMap = new Map<string, FieldPermissionEntry['fields']>();
            const seenIds = new Set<string>();
            for (const row of flsRows) {
                const id = row.primaryKey?.ID;
                assert.ok(id && !seenIds.has(id), `Duplicate or missing FLS primaryKey ID: ${id}`);
                seenIds.add(id);

                const fieldLookup = row.fields?.EntityFieldID;
                if (
                    row.fields?.RoleID === '@lookup:MJ: Roles.Name=Space Participant' &&
                    typeof fieldLookup === 'string' &&
                    fieldLookup.endsWith('&Entity=MJ: AI Agents')
                ) {
                    const match = /^@lookup:MJ: Entity Fields\.Name=([^&]+)&Entity=MJ: AI Agents$/.exec(fieldLookup);
                    assert.ok(match, `Invalid EntityFieldID lookup format: ${fieldLookup}`);
                    agentFieldMap.set(match[1], row.fields);
                }
            }

            // Primary keys & system __mj_* fields must never be restricted via EntityFieldPermissions
            assert.equal(agentFieldMap.has('ID'), false);
            assert.equal(agentFieldMap.has('__mj_CreatedAt'), false);
            assert.equal(agentFieldMap.has('__mj_UpdatedAt'), false);

            // Owner identity fields MUST be explicitly denied
            assert.equal(agentFieldMap.get('OwnerUser')?.ReadAccess, 'Deny');
            assert.equal(agentFieldMap.get('OwnerUserID')?.ReadAccess, 'Deny');

            // Safe display fields MUST remain allowed
            for (const safeField of ['Name', 'Description', 'LogoURL', 'IconClass', 'Status', 'TypeID', 'Type']) {
                assert.equal(
                    agentFieldMap.get(safeField)?.ReadAccess,
                    'Allow',
                    `Expected safe field ${safeField} to have ReadAccess=Allow`
                );
            }

            // Evaluate MJ's real EntityInfo FLS engine against parsed metadata rules
            const fields: EntityFieldInfo[] = [];
            for (const pkOrSys of ['ID', '__mj_CreatedAt', '__mj_UpdatedAt']) {
                fields.push(
                    new EntityFieldInfo({
                        ID: `field-${pkOrSys}`,
                        Entity: 'MJ: AI Agents',
                        Name: pkOrSys,
                        IsPrimaryKey: pkOrSys === 'ID',
                    })
                );
            }

            for (const [fieldName, perm] of agentFieldMap.entries()) {
                const fieldInfo = new EntityFieldInfo({
                    ID: `field-${fieldName}`,
                    Entity: 'MJ: AI Agents',
                    Name: fieldName,
                });
                fieldInfo.FieldPermissions.push(
                    new EntityFieldPermissionInfo({
                        ID: `perm-part-${fieldName}`,
                        EntityFieldID: fieldInfo.ID,
                        RoleID: PARTICIPANT_ROLE_ID,
                        ReadAccess: toFieldAccess(perm?.ReadAccess),
                        UpdateAccess: toFieldAccess(perm?.UpdateAccess),
                        CreateAccess: toFieldAccess(perm?.CreateAccess),
                    }),
                    new EntityFieldPermissionInfo({
                        ID: `perm-ui-${fieldName}`,
                        EntityFieldID: fieldInfo.ID,
                        RoleID: UI_ROLE_ID,
                        ReadAccess: FieldPermissionAccess.Allow,
                        UpdateAccess: FieldPermissionAccess.Allow,
                        CreateAccess: FieldPermissionAccess.Allow,
                    })
                );
                fields.push(fieldInfo);
            }

            const entityInfo = new EntityInfo({
                ID: 'entity-mj-ai-agents',
                Name: 'MJ: AI Agents',
                EnableFieldLevelSecurity: true,
                Fields: fields,
            });

            const participantDenied = entityInfo.GetDeniedReadFields(participantUser);
            assert.equal(participantDenied.has('owneruser'), true, 'External participant must be denied OwnerUser');
            assert.equal(participantDenied.has('owneruserid'), true, 'External participant must be denied OwnerUserID');
            assert.equal(participantDenied.has('name'), false);
            assert.equal(participantDenied.has('description'), false);
            assert.equal(participantDenied.has('id'), false);
            assert.equal(entityInfo.IsFieldReadableByUser('OwnerUser', participantUser), false);
            assert.equal(entityInfo.IsFieldReadableByUser('OwnerUserID', participantUser), false);
            assert.equal(entityInfo.IsFieldReadableByUser('Name', participantUser), true);

            const multiRoleDenied = entityInfo.GetDeniedReadFields(multiRoleParticipant);
            assert.equal(multiRoleDenied.has('owneruser'), true, 'Multi-role non-staff participant must still be denied OwnerUser');
            assert.equal(multiRoleDenied.has('owneruserid'), true, 'Multi-role non-staff participant must still be denied OwnerUserID');

            const staffDenied = entityInfo.GetDeniedReadFields(staffUser);
            assert.equal(staffDenied.has('owneruser'), false, 'Staff user (UI) still reads OwnerUser');
            assert.equal(staffDenied.has('owneruserid'), false, 'Staff user (UI) still reads OwnerUserID');
        });
    });
});
