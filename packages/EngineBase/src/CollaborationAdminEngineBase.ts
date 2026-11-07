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
}
