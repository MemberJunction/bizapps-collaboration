import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    AuthorizationInfo,
    BaseRemotableOperation,
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
import { MJGlobal } from '@memberjunction/global';
import {
    BaseHealthProbe,
    BaseLiveCrudVerifier,
    BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY,
    BootEntityGrantInventoryOperation,
    COLLABORATION_BOOT_ENTITY_REGISTRY,
    COLLABORATION_POLYMORPHIC_FK_SPECS,
    COLLABORATION_ROOT_AUTHORIZATION_NAME,
    COLLABORATION_SCHEMA_NAME,
    CollaborationEngine,
    CollaborationPersonaSecurityProbe,
    CollaborationPersonaSecurityVerifier,
    LoadCollaborationSecurityAuditOperations,
    PARTICIPANT_ROLE_ID,
    PERSONA_SECURITY_PROBE_KEY,
    PERSONA_SECURITY_PROBE_OPERATION_KEY,
    PERSONA_SECURITY_VERIFIER_KEY,
    PersonaSecurityProbeOperation,
    SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY,
    SpaceParticipantRoleAuditOperation,
    STAFF_ROLE_AUDIT_OPERATION_KEY,
    StaffRoleAuditOperation,
} from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const DEV_ROLE_ID = 'E1AFCCEC-6A37-EF11-86D4-000D3A4E707E';
const DEV_USER_ID = 'D2000001-0000-4000-8000-000000000013';
const BEA_USER_ID = 'D2000001-0000-4000-8000-000000000004';
const FILTER_READ_ID = 'F1000001-0000-4000-8000-000000000001';
const FILTER_CAT_ID = 'F1000001-0000-4000-8000-000000000002';
const FILTER_SHELL_ID = 'F1000001-0000-4000-8000-000000000003';
const FILTER_WRITE_ID = 'F1000001-0000-4000-8000-000000000004';

function makeUser(id: string, roleId: string, type: 'User' | 'Owner' = 'User'): UserInfo {
    const ur = new UserRoleInfo({ UserID: id, RoleID: roleId });
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: 'Test User',
        Email: 'test@example.com',
        Type: type,
        IsActive: true,
        UserRoles: [ur],
    };
    return partial as UserInfo;
}

function createServerAuditProvider(): IMetadataProvider {
    const rootAuth = new AuthorizationInfo();
    rootAuth.ID = '1AB4325C-EBD6-44D3-BA0D-2916DCD3320E';
    rootAuth.Name = COLLABORATION_ROOT_AUTHORIZATION_NAME;
    rootAuth.IsActive = true;

    const adminAuth = new AuthorizationInfo();
    adminAuth.ID = 'F22C7B81-D6F8-4439-A4EB-F4C88FC1C9F1';
    adminAuth.Name = 'Administer Spaces';
    adminAuth.ParentID = rootAuth.ID;
    adminAuth.IsActive = true;
    Object.defineProperty(adminAuth, 'UserCanExecute', {
        value: (u: UserInfo) => u?.UserRoles?.some((r) => r.RoleID?.toLowerCase() === DEV_ROLE_ID.toLowerCase()) ?? false,
    });

    const polyByEntity = new Map<string, Array<{ payload: string; disc: string }>>();
    for (const s of COLLABORATION_POLYMORPHIC_FK_SPECS) {
        const list = polyByEntity.get(s.EntityName.toLowerCase()) ?? [];
        list.push({ payload: s.PayloadFieldName, disc: s.EntityIDFieldName });
        polyByEntity.set(s.EntityName.toLowerCase(), list);
    }

    const entities: EntityInfo[] = COLLABORATION_BOOT_ENTITY_REGISTRY.map((spec, idx) => {
        const entityId = `E0000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`;
        const e = new EntityInfo();
        e.ID = entityId;
        e.Name = spec.EntityName;
        e.SchemaName = spec.EntityName.startsWith('MJ_BizApps_Collaboration:') ? COLLABORATION_SCHEMA_NAME : '__mj';
        e.AllowAllRowsAPI = false;

        const idField = new EntityFieldInfo({ Name: 'ID', IsPrimaryKey: true });
        const fields: EntityFieldInfo[] = [idField];
        for (const p of polyByEntity.get(spec.EntityName.toLowerCase()) ?? []) {
            fields.push(new EntityFieldInfo({ Name: p.disc }));
            fields.push(new EntityFieldInfo({ Name: p.payload, EntityIDFieldName: p.disc }));
        }
        Object.defineProperty(e, 'Fields', { value: fields, writable: true, configurable: true });

        const perms: EntityPermissionInfo[] = [];
        if (spec.PolicyKind !== 'staff-only-denied') {
            perms.push(
                new EntityPermissionInfo({
                    EntityID: entityId,
                    RoleID: PARTICIPANT_ROLE_ID,
                    Type: 'Allow',
                    CanRead: true,
                    ReadRLSFilterID:
                        spec.PolicyKind === 'shell-deny-all'
                            ? FILTER_SHELL_ID
                            : spec.PolicyKind === 'active-catalog'
                              ? FILTER_CAT_ID
                              : FILTER_READ_ID,
                    ...(spec.PolicyKind === 'reach-scoped' && spec.RequireWriteRlsWhenWritable
                        ? {
                              CanCreate: true,
                              CanUpdate: true,
                              CreateRLSFilterID: FILTER_WRITE_ID,
                              UpdateRLSFilterID: FILTER_WRITE_ID,
                          }
                        : {}),
                }),
            );
        }
        Object.defineProperty(e, 'Permissions', { value: perms, writable: true, configurable: true });
        return e;
    });

    const filters: Array<Pick<RowLevelSecurityFilterInfo, 'ID' | 'Name' | 'FilterText'>> = [
        { ID: FILTER_READ_ID, Name: 'Read', FilterText: "(SpaceID IN (SELECT SpaceID FROM [__mj_BizAppsCollaboration].[fnCollaborationAccess](TRY_CAST('{{UserID}}' AS UNIQUEIDENTIFIER))))" },
        { ID: FILTER_CAT_ID, Name: 'Catalog', FilterText: '(IsActive = 1)' },
        { ID: FILTER_SHELL_ID, Name: 'Shell', FilterText: '(1 = 0)' },
        { ID: FILTER_WRITE_ID, Name: 'Write', FilterText: "(UserID = TRY_CAST('{{UserID}}' AS UNIQUEIDENTIFIER))" },
    ];

    const provider: Partial<IMetadataProvider> & {
        RunView: <T>(params: RunViewParams) => Promise<RunViewResult<T>>;
    } = {
        Entities: entities,
        Authorizations: [rootAuth, adminAuth],
        AuthorizationRoles: [],
        EntityByName: (name: string) => entities.find((e) => e.Name.toLowerCase() === name.toLowerCase()),
        EntityByID: (id: string) => entities.find((e) => e.ID.toLowerCase() === id.toLowerCase()),
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            if (params.EntityName === 'MJ: Row Level Security Filters') {
                return { Success: true, Results: filters as T[], RowCount: filters.length, TotalRowCount: filters.length, ExecutionTime: 1, ErrorMessage: '' };
            }
            return { Success: true, Results: [] as T[], RowCount: 0, TotalRowCount: 0, ExecutionTime: 1, ErrorMessage: '' };
        },
    };
    return provider as IMetadataProvider;
}

describe('CoreEntitiesServer & Server security audit operation registration', () => {
    it('LoadCollaborationSecurityAuditOperations retains XS-1, XS-2, and XS-7 BaseRemotableOperation classes in ClassFactory', () => {
        LoadCollaborationSecurityAuditOperations();

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
    });

    it('CollaborationEngine delegates XS-1, XS-2, XS-3, and XS-7 audits and rejects external participant callers', async () => {
        const provider = createServerAuditProvider();
        let rollbacks = 0;
        Object.defineProperty(provider, 'BeginEntityTransaction', {
            value: async () => ({
                IsNested: false,
                Commit: async () => {
                    throw new Error('XS-3 must never commit');
                },
                Rollback: async () => {
                    rollbacks += 1;
                },
            }),
        });
        const admin = makeUser(DEV_USER_ID, DEV_ROLE_ID, 'Owner');
        const participant = makeUser(BEA_USER_ID, PARTICIPANT_ROLE_ID, 'User');

        const xs1 = await CollaborationEngine.Instance.RunSpaceParticipantRoleAudit({}, admin, provider);
        const xs7 = await CollaborationEngine.Instance.RunStaffRoleAudit({}, admin, provider);
        const xs2 = await CollaborationEngine.Instance.RunBootEntityGrantInventory({}, admin, provider);
        const xs3 = await CollaborationEngine.Instance.RunPersonaSecurityProbe(
            {
                FixtureMode: 'world-provided',
                WorldFixtures: {
                    SpaceAID: 'C1000001-0000-4000-8000-000000000002',
                    SpaceBID: 'C1000001-0000-4000-8000-000000000006',
                    ExternalParticipantUser: participant,
                    RestrictedStaffUser: makeUser('D2000001-0000-4000-8000-000000000001', DEV_ROLE_ID, 'User'),
                    OutOfSpaceRecords: [],
                },
            },
            admin,
            provider,
        );

        assert.equal(xs1.Passed, true);
        assert.equal(xs7.Passed, true);
        assert.equal(xs2.Passed, true);
        assert.equal(xs3.Passed, true);
        assert.equal(xs3.Stats.RolledBack, true);
        assert.equal(rollbacks, 1);

        await assert.rejects(
            () => CollaborationEngine.Instance.RunBootEntityGrantInventory({}, participant, provider),
            /External Space Participant accounts cannot invoke/,
        );
        await assert.rejects(
            () => CollaborationEngine.Instance.RunPersonaSecurityProbe({}, participant, provider),
            /External Space Participant accounts cannot invoke/,
        );
    });

    it('ground-truth check: COLLABORATION_BOOT_ENTITY_REGISTRY & COLLABORATION_POLYMORPHIC_FK_SPECS cover 100% of repo metadata files', () => {
        const generatedEntitiesPath = resolve(repoRoot, 'packages/Entities/src/generated/entities/__mj_BizAppsCollaboration.ts');
        const generatedSrc = readFileSync(generatedEntitiesPath, 'utf8');
        const registeredEntityNames = [...generatedSrc.matchAll(/@RegisterClass\(BaseEntity,\s*'([^']+)'\)/g)].map((m) => m[1]);
        assert.equal(registeredEntityNames.length, 14);
        const registrySet = new Set(COLLABORATION_BOOT_ENTITY_REGISTRY.map((e) => e.EntityName));
        for (const entityName of registeredEntityNames) {
            assert.equal(registrySet.has(entityName), true, `Missing entity '${entityName}' from COLLABORATION_BOOT_ENTITY_REGISTRY`);
        }

        const polyMetaPath = resolve(repoRoot, 'metadata/entities/.polymorphic-fk-entity-fields.json');
        const polyMeta = JSON.parse(readFileSync(polyMetaPath, 'utf8')) as Array<{
            fields: { Name: string };
            relatedEntities: { 'MJ: Entity Fields': Array<{ fields: { Name: string; EntityIDFieldName: string } }> };
        }>;
        for (const entry of polyMeta) {
            for (const f of entry.relatedEntities['MJ: Entity Fields']) {
                const match = COLLABORATION_POLYMORPHIC_FK_SPECS.find(
                    (s) =>
                        s.EntityName === entry.fields.Name &&
                        s.PayloadFieldName === f.fields.Name &&
                        s.EntityIDFieldName === f.fields.EntityIDFieldName,
                );
                assert.ok(match, `Missing polymorphic FK spec for ${entry.fields.Name}.${f.fields.Name} -> ${f.fields.EntityIDFieldName}`);
            }
        }

        for (const relPath of [
            'metadata/entity-permissions/.entity-permissions.json',
            'metadata/entity-permissions/.core-entity-permissions.json',
        ]) {
            const perms = JSON.parse(readFileSync(resolve(repoRoot, relPath), 'utf8')) as Array<{
                fields: {
                    EntityID: string;
                    CanRead?: number;
                    ReadRLSFilterID?: string | null;
                };
            }>;
            for (const p of perms) {
                const entityName = p.fields.EntityID.replace(/^@lookup:MJ:\s*Entities\.Name=/, '');
                assert.equal(registrySet.has(entityName), true, `Missing permissioned entity '${entityName}' from ${relPath}`);
                if (p.fields.CanRead === 1) {
                    assert.ok(typeof p.fields.ReadRLSFilterID === 'string' && p.fields.ReadRLSFilterID.length > 0, `Entity '${entityName}' in ${relPath} lacks ReadRLSFilterID`);
                }
            }
        }
    });
});
