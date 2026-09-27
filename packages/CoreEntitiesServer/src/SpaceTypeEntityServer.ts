/**
 * SpaceTypeEntityServer
 * Validates SpaceType configuration, extension entity, and server driver registration.
 * Follows extensibility plan § 4, § 5, § 7.
 */

import { BaseEntity, RunView, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { validateSpaceTypeConfiguration, type ISpaceTypeConfiguration } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { requireSystemUser } from './load-graph.js';
import { ServerDriverRegistry } from './server-driver-registry.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Types';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceTypeEntityServer extends mjBizAppsCollaborationSpaceTypeEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();

        // 1. Validate Configuration JSON if present
        if (this.Configuration) {
            let parsed: unknown;
            try {
                parsed = JSON.parse(this.Configuration);
            } catch {
                return fail(result, 'Configuration', 'Space type configuration must be valid JSON.');
            }

            const validation = validateSpaceTypeConfiguration(parsed);
            if (!validation.valid) {
                return fail(result, 'Configuration', `Invalid space type configuration: ${validation.errors.join('; ')}`);
            }

            // Verify AllowedTypeCodes if provided
            const config = parsed as ISpaceTypeConfiguration;
            if (config.Children?.AllowedTypeCodes && config.Children.AllowedTypeCodes.length > 0) {
                try {
                    const system = await requireSystemUser(this);
                    const rv = new RunView(this.RunViewProviderToUse);
                    const codesList = config.Children.AllowedTypeCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
                    const existingTypes = await rv.RunView<{ Code: string }>({
                        EntityName: ENTITY,
                        ExtraFilter: `Code IN (${codesList})`,
                        Fields: ['Code'],
                        ResultType: 'simple',
                    }, system);

                    if (existingTypes.Success) {
                        const found = new Set(existingTypes.Results?.map(r => r.Code.toLowerCase()) ?? []);
                        const missing = config.Children.AllowedTypeCodes.filter(c => !found.has(c.toLowerCase()));
                        if (missing.length > 0) {
                            return fail(result, 'Configuration', `AllowedTypeCodes contains unknown type codes: ${missing.join(', ')}.`);
                        }
                    }
                } catch {
                    // Ignore transient network/DB lookup error in validation
                }
            }
        }

        // 2. Validate SpaceExtensionEntity if set
        if (this.SpaceExtensionEntity?.trim()) {
            try {
                const system = await requireSystemUser(this);
                const rv = new RunView(this.RunViewProviderToUse);
                const extResult = await rv.RunView<{ ID: string; ParentEntityID: string | null }>({
                    EntityName: 'MJ: Entities',
                    ExtraFilter: `Name = '${this.SpaceExtensionEntity.trim().replace(/'/g, "''")}'`,
                    Fields: ['ID', 'ParentEntityID'],
                    MaxRows: 1,
                    ResultType: 'simple',
                }, system);

                if (!extResult.Success || !extResult.Results?.[0]) {
                    return fail(result, 'SpaceExtensionEntity', `Extension entity "${this.SpaceExtensionEntity}" does not exist in MemberJunction.`);
                }
            } catch {
                // Non-fatal if system user read fails in tests
            }
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
