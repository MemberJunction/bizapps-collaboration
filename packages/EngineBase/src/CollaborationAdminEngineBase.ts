/**
 * CollaborationAdminEngineBase — the Collaboration metadata only staff can read.
 *
 * MemberJunction's BaseEngine loads an engine's entities all or nothing: when the user can't read one of them, it loads none and
 * marks the engine permission-constrained. So the entities every seated person reads (space types, role types, the app's settings)
 * live in CollaborationEngineBase, and the ones a Space Participant has no read on live here:
 * - Authorizations and Authorization Roles (MemberJunction's catalog rows)
 * - App- and type-level Space Agents, Skills, and Knowledge Sources
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
import type {
    mjBizAppsCollaborationSpaceAgentEntity,
    mjBizAppsCollaborationSpaceAgentSkillEntity,
    mjBizAppsCollaborationSpaceKnowledgeSourceEntity,
} from '@mj-biz-apps/collaboration-entities';
import type { MJAuthorizationEntity, MJAuthorizationRoleEntity } from '@memberjunction/core-entities';

const normalizeKey = (key: string | null | undefined): string => (key ?? '').trim().toLowerCase();

@RegisterForStartup()
export class CollaborationAdminEngineBase extends BaseEngine<CollaborationAdminEngineBase> {
    private _authorizations: MJAuthorizationEntity[] = [];
    private _authorizationRoles: MJAuthorizationRoleEntity[] = [];
    private _appAndTypeSpaceAgents: mjBizAppsCollaborationSpaceAgentEntity[] = [];
    private _appAndTypeSpaceAgentSkills: mjBizAppsCollaborationSpaceAgentSkillEntity[] = [];
    private _appAndTypeSpaceKnowledgeSources: mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] = [];

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
                PropertyName: '_appAndTypeSpaceAgents',
                EntityName: 'MJ_BizApps_Collaboration: Space Agents',
                CacheLocal: true,
                Filter: 'SpaceID IS NULL',
            },
            {
                PropertyName: '_appAndTypeSpaceAgentSkills',
                EntityName: 'MJ_BizApps_Collaboration: Space Agent Skills',
                CacheLocal: true,
                Filter: 'SpaceID IS NULL',
            },
            {
                PropertyName: '_appAndTypeSpaceKnowledgeSources',
                EntityName: 'MJ_BizApps_Collaboration: Space Knowledge Sources',
                CacheLocal: true,
                Filter: 'SpaceID IS NULL',
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

    public get AppAndTypeSpaceAgents(): mjBizAppsCollaborationSpaceAgentEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceAgentEntity>('_appAndTypeSpaceAgents');
    }

    public get AppAndTypeSpaceAgentSkills(): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceAgentSkillEntity>('_appAndTypeSpaceAgentSkills');
    }

    public get AppAndTypeSpaceKnowledgeSources(): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceKnowledgeSourceEntity>('_appAndTypeSpaceKnowledgeSources');
    }

    // ─── Agents, Skills, Knowledge ─────────────────────────────────────────────

    public get AppSpaceAgents(): mjBizAppsCollaborationSpaceAgentEntity[] {
        return this.AppAndTypeSpaceAgents.filter(
            a => !a.SpaceTypeID && !a.SpaceID
        );
    }

    public SpaceAgentsForType(typeId: string): mjBizAppsCollaborationSpaceAgentEntity[] {
        const key = normalizeKey(typeId);
        return this.AppAndTypeSpaceAgents.filter(
            a => a.SpaceTypeID && normalizeKey(a.SpaceTypeID) === key && !a.SpaceID
        );
    }

    public get AppSpaceAgentSkills(): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        return this.AppAndTypeSpaceAgentSkills.filter(
            s => !s.SpaceTypeID && !s.SpaceID
        );
    }

    public SpaceAgentSkillsForType(typeId: string): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        const key = normalizeKey(typeId);
        return this.AppAndTypeSpaceAgentSkills.filter(
            s => s.SpaceTypeID && normalizeKey(s.SpaceTypeID) === key && !s.SpaceID
        );
    }

    public get AppSpaceKnowledgeSources(): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        return this.AppAndTypeSpaceKnowledgeSources.filter(
            k => !k.SpaceTypeID && !k.SpaceID
        );
    }

    public SpaceKnowledgeSourcesForType(typeId: string): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        const key = normalizeKey(typeId);
        return this.AppAndTypeSpaceKnowledgeSources.filter(
            k => k.SpaceTypeID && normalizeKey(k.SpaceTypeID) === key && !k.SpaceID
        );
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
