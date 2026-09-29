/**
 * SpaceTypeEntityServer
 * Validates SpaceType configuration, extension entity, and server driver registration.
 * Follows extensibility plan § 4, § 5, § 7.
 */

import { BaseEntity, BaseEntityResult, LogError, Metadata, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { ValidateCollaborationSettings, type CollaborationSettings } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { refuseSubtypeEntity, type SubtypeEntityShape } from './subtype-rules.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { asMetadata } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Types';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceTypeEntityServer extends mjBizAppsCollaborationSpaceTypeEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    private failDelete(message: string): false {
        const result = new BaseEntityResult();
        result.Success = false;
        result.Type = 'delete';
        result.Message = message;
        this.RegisterResultHistoryEntry(result);
        return false;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const user = this.ContextCurrentUser;
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
        if (!user) {
            const msg = 'Space type delete refused: no signed-in user.';
            LogError(msg);
            return this.failDelete(msg);
        }
        const canConfig = CollaborationEngine.Instance.UserCanConfigureSpaceTypes(user, md);
        if (!canConfig) {
            const msg = "Space type delete refused: user lacks 'Configure Space Types' authorization.";
            LogError(msg);
            return this.failDelete(msg);
        }
        return super.Delete(options);
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;

        // Configure Space Types covers the types themselves: check on every create and update
        if (!user) {
            return fail(result, 'Name', 'Space type change refused: no signed-in user.');
        }

        const canConfig = CollaborationEngine.Instance.UserCanConfigureSpaceTypes(user, md);
        if (!canConfig) {
            return fail(result, 'Name', "Space type change refused: user lacks 'Configure Space Types' authorization.");
        }

        // 1. Validate Configuration JSON if present
        if (this.Configuration) {
            let parsed: unknown;
            try {
                parsed = JSON.parse(this.Configuration);
            } catch {
                return fail(result, 'Configuration', 'Space type configuration must be valid JSON.');
            }

            const validation = ValidateCollaborationSettings(parsed, 'type');
            if (!validation.valid) {
                return fail(result, 'Configuration', `Invalid space type configuration: ${validation.errors.join('; ')}`);
            }

            const config = parsed as CollaborationSettings;
            if (config.StorageAccountID) {
                const storageCheck = CollaborationEngine.Instance.ValidateStorageAccountActive(config.StorageAccountID);
                if (!storageCheck.valid) {
                    return fail(result, 'Configuration', storageCheck.error ?? 'Configured storage account does not exist or is not active.');
                }
            }
        }

        // 2. Validate SpaceExtensionEntity if set
        if (this.SpaceExtensionEntity?.trim()) {
            const extEntity = md.EntityByName(this.SpaceExtensionEntity.trim());
            if (!extEntity) {
                return fail(result, 'SpaceExtensionEntity', `Extension entity "${this.SpaceExtensionEntity}" does not exist in MemberJunction.`);
            }
            const spaces = md.EntityByName('MJ_BizApps_Collaboration: Spaces');
            if (!spaces) return fail(result, 'SpaceExtensionEntity', 'The Spaces entity could not be read, so the subtype cannot be checked.');
            const shape = (info: NonNullable<typeof spaces>): SubtypeEntityShape => ({ ID: info.ID, Name: info.Name, ParentID: info.ParentID ?? null, Permissions: info.Permissions });
            const refusal = refuseSubtypeEntity(shape(spaces), shape(extEntity), (id) => { const found = md.EntityByID(id); return found ? shape(found) : undefined; });
            if (refusal) return fail(result, 'SpaceExtensionEntity', refusal);
        }

        // 3. Clear driver registry cache when type is validated/saved
        ServerDriverRegistry.Instance.ClearCache();

        return result;
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const ok = await super.Save(options);
        if (ok) {
            ServerDriverRegistry.Instance.ClearCache();
        }
        return ok;
    }
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceTypeEntityServer(): void {
    void SpaceTypeEntityServer;
}
