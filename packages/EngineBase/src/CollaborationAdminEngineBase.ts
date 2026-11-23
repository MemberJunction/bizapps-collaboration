/**
 * CollaborationAdminEngineBase — the Collaboration metadata only staff can read.
 *
 * MemberJunction's BaseEngine loads an engine's entities all or nothing: when the user can't read one of them, it loads none and
 * marks the engine permission-constrained. So the entities every seated person reads (space types, role types, the app's settings)
 * live in CollaborationEngineBase, and the ones a Space Participant has no read on live here:
 * - Authorizations and Authorization Roles (MemberJunction's catalog rows)
 * - App- and type-level Space Grants (stage 1: what the app and each type offer in their spaces; a space's own rows are read per space)
 *
 * A guest who can't read these gets an empty, constrained engine and a working workspace; the rights checks read MemberJunction's
 * metadata, not this engine. Readers of this engine check `IsPermissionConstrained` the way Explorer's own pages do, and treat it as none.
 */

import {
    BaseEngine,
    type BaseEnginePropertyConfig,
    type IMetadataProvider,
    Metadata,
    RegisterForStartup,
    type UserInfo,
} from '@memberjunction/core';
import type { GrantKind } from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceGrantEntity } from '@mj-biz-apps/collaboration-entities';
import type { MJAuthorizationEntity, MJAuthorizationRoleEntity } from '@memberjunction/core-entities';
import {
    type BootEntityGrantInventoryInput,
    type BootEntityGrantInventoryResult,
    runBootEntityGrantInventory,
} from './boot-entity-grant-inventory.js';
import {
    type PersonaSecurityProbeInput,
    type PersonaSecurityProbeResult,
    runPersonaSecurityProbe,
} from './persona-security-probe.js';
import { authorizeSecurityAuditCaller } from './security-audit-types.js';
import {
    runSpaceParticipantRoleAudit,
    type SpaceParticipantRoleAuditInput,
    type SpaceParticipantRoleAuditResult,
} from './space-participant-role-audit.js';
import {
    runStaffRoleAudit,
    type StaffRoleAuditInput,
    type StaffRoleAuditResult,
} from './staff-role-audit.js';

const normalizeKey = (key: string | null | undefined): string => (key ?? '').trim().toLowerCase();

@RegisterForStartup()
export class CollaborationAdminEngineBase extends BaseEngine<CollaborationAdminEngineBase> {
    private _authorizations: MJAuthorizationEntity[] = [];
    private _authorizationRoles: MJAuthorizationRoleEntity[] = [];
    private _appAndTypeSpaceGrants: mjBizAppsCollaborationSpaceGrantEntity[] = [];

    // Memoized lookup index, reset on reload in AdditionalLoading()
    private _authorizationsByName: Map<string, MJAuthorizationEntity> | null = null;

    public static get Instance(): CollaborationAdminEngineBase {
        return super.getInstance<CollaborationAdminEngineBase>();
    }

    public async Config(
        forceRefresh?: boolean,
        contextUser?: UserInfo,
        provider?: IMetadataProvider
    ): Promise<void> {
        const md = provider ?? Metadata.Provider;
        const params: Array<Partial<BaseEnginePropertyConfig>> = [
            {
                PropertyName: '_authorizations',
                EntityName: 'MJ: Authorizations',
                CacheLocal: true,
            },
            {
                PropertyName: '_authorizationRoles',
                EntityName: 'MJ: Authorization Roles',
                CacheLocal: true,
            },
            {
                PropertyName: '_appAndTypeSpaceGrants',
                EntityName: 'MJ_BizApps_Collaboration: Space Grants',
                CacheLocal: true,
                Filter: 'SpaceID IS NULL',
                OrderBy: 'Sequence',
            },
        ];
        return await this.Load(params, md, forceRefresh ?? false, contextUser);
    }

    protected override async AdditionalLoading(_contextUser?: UserInfo): Promise<void> {
        this._authorizationsByName = null;
    }

    // ─── Collections ───────────────────────────────────────────────────────────

    public get Authorizations(): MJAuthorizationEntity[] {
        return this.GetConfigData<MJAuthorizationEntity>('_authorizations');
    }

    public get AuthorizationRoles(): MJAuthorizationRoleEntity[] {
        return this.GetConfigData<MJAuthorizationRoleEntity>('_authorizationRoles');
    }

    /** The app's and every type's grants: the rows with no space. A space's own rows are read per space, by the resolver. */
    public get AppAndTypeSpaceGrants(): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceGrantEntity>('_appAndTypeSpaceGrants');
    }

    // ─── Grants ────────────────────────────────────────────────────────────────

    /** The app-wide grants: no type, no space. */
    public get AppSpaceGrants(): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.AppAndTypeSpaceGrants.filter((g) => !g.SpaceTypeID && !g.SpaceID);
    }

    /** One type's grants. */
    public SpaceGrantsForType(typeId: string): mjBizAppsCollaborationSpaceGrantEntity[] {
        const key = normalizeKey(typeId);
        return this.AppAndTypeSpaceGrants.filter((g) => g.SpaceTypeID && normalizeKey(g.SpaceTypeID) === key && !g.SpaceID);
    }

    /** The app-wide grants of one kind. */
    public AppGrantsOfKind(kind: GrantKind): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.AppSpaceGrants.filter((g) => g.Kind === kind);
    }

    /** One type's grants of one kind. */
    public TypeGrantsOfKind(typeId: string, kind: GrantKind): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.SpaceGrantsForType(typeId).filter((g) => g.Kind === kind);
    }

    // ─── Authorizations ────────────────────────────────────────────────────────

    public AuthorizationByName(name: string): MJAuthorizationEntity | undefined {
        if (!this._authorizationsByName) {
            const map = new Map<string, MJAuthorizationEntity>();
            for (const a of this.Authorizations) {
                if (a.Name) map.set(normalizeKey(a.Name), a);
            }
            this._authorizationsByName = map;
        }
        return this._authorizationsByName.get(normalizeKey(name));
    }

    // ─── Security Audits (XS-1, XS-2, XS-7) ────────────────────────────────────

    /** Executes the XS-1 Space Participant Role Audit after verifying caller staff-admin authorization. */
    public async RunSpaceParticipantRoleAudit(
        input: SpaceParticipantRoleAuditInput = {},
        contextUser?: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<SpaceParticipantRoleAuditResult> {
        const md = provider ?? Metadata.Provider;
        const user = contextUser ?? md.CurrentUser;
        const auth = authorizeSecurityAuditCaller(user, md);
        if (!auth.authorized) {
            throw new Error(auth.reason);
        }
        return runSpaceParticipantRoleAudit(md, user!, input);
    }

    /** Executes the XS-7 Staff Role Audit after verifying caller staff-admin authorization. */
    public async RunStaffRoleAudit(
        input: StaffRoleAuditInput = {},
        contextUser?: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<StaffRoleAuditResult> {
        const md = provider ?? Metadata.Provider;
        const user = contextUser ?? md.CurrentUser;
        const auth = authorizeSecurityAuditCaller(user, md);
        if (!auth.authorized) {
            throw new Error(auth.reason);
        }
        return runStaffRoleAudit(md, user!, input);
    }

    /** Executes the XS-2 Boot Entity Grant Filter Inventory after verifying caller staff-admin authorization. */
    public async RunBootEntityGrantInventory(
        input: BootEntityGrantInventoryInput = {},
        contextUser?: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<BootEntityGrantInventoryResult> {
        const md = provider ?? Metadata.Provider;
        const user = contextUser ?? md.CurrentUser;
        const auth = authorizeSecurityAuditCaller(user, md);
        if (!auth.authorized) {
            throw new Error(auth.reason);
        }
        return runBootEntityGrantInventory(md, user!, input);
    }

    /** Executes the XS-3 Automated Cross-Surface Persona Security Probe inside a rolled-back transaction after verifying caller staff-admin authorization. */
    public async RunPersonaSecurityProbe(
        input: PersonaSecurityProbeInput = {},
        contextUser?: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<PersonaSecurityProbeResult> {
        const md = provider ?? Metadata.Provider;
        const user = contextUser ?? md.CurrentUser;
        const auth = authorizeSecurityAuditCaller(user, md);
        if (!auth.authorized) {
            throw new Error(auth.reason);
        }
        return runPersonaSecurityProbe(md, user!, input);
    }
}
