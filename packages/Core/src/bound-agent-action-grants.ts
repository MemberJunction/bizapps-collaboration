/**
 * CX-3 & CA-4 Pure Domain Rules:
 * - Server-bound action grants for space agents (hidden bound parameter schema redaction,
 *   unbound user-level schema generation, and strict server-side parameter injection / spoof rejection).
 * - Non-loosening per-root delivery principal resolution.
 *
 * Strictly typed with zero `any`, zero `unknown`, and zero DB dependencies.
 */
import type { DeliveryPrincipalConfig } from './configuration.ts';
import type { EffectiveGrant } from './effective-configuration.ts';
import type { Band } from './rules.ts';

/** Standard contextual parameters that are ALWAYS treated as server-bound & hidden from space agents. */
export const DEFAULT_HIDDEN_BOUND_PARAM_NAMES = [
    'SpaceID',
    'RootSpaceID',
    'RootEntityID',
    'RootRecordID',
    'Band',
    'DeliveryPrincipalID',
] as const;

export type HiddenBoundParamOverridePolicy = 'Reject' | 'StripAndInject';

export type BoundParamPrimitive = string | number | boolean | null;
export type BoundParamValue =
    | BoundParamPrimitive
    | readonly BoundParamPrimitive[]
    | { readonly [key: string]: BoundParamPrimitive };
export type BoundParamValuesMap = Record<string, BoundParamValue | undefined>;

export interface ActionParamDefinition {
    Name: string;
    Type: 'Input' | 'Output' | 'Both';
    ValueType?: string | null;
    IsRequired?: boolean;
    IsArray?: boolean;
    Description?: string | null;
    DefaultValue?: string | null;
}

export interface ActionMetadataDescriptor {
    ActionID: string;
    ActionName: string;
    Description?: string | null;
    DriverClass?: string | null;
    SupportsAudience: boolean;
}

export interface ExposedAgentActionParam {
    Name: string;
    ValueType: string;
    IsRequired: boolean;
    IsArray: boolean;
    Description: string | null;
    DefaultValue: string | null;
}

export interface BoundActionGrantExposure {
    GrantID: string;
    ActionID: string;
    ActionName: string;
    DisplayName: string;
    Description: string | null;
    Band: Band;
    SupportsAudience: boolean;
    /** Only unbound user-level input parameters; NEVER contains hidden bound parameters. */
    ExposedParams: readonly ExposedAgentActionParam[];
    /** Normalized names of hidden server-bound parameters (names only, never values). */
    HiddenBoundParamNames: readonly string[];
    /** JSON-schema-like descriptor exposed to the space agent's tool catalog. */
    ToolSchema: {
        name: string;
        description: string | null;
        parameters: {
            type: 'object';
            properties: Record<string, { type: string; description?: string }>;
            required: string[];
            additionalProperties: false;
        };
    };
}

export interface BoundActionPromptCatalogItem {
    actionId: string;
    name: string;
    description: string | null;
    parameters: readonly ExposedAgentActionParam[];
}

export type BoundActionEnforcementResult =
    | {
          allowed: true;
          injectedParams: Record<string, BoundParamValue>;
          boundParamNames: readonly string[];
          strippedSpoofedNames: readonly string[];
      }
    | {
          allowed: false;
          resultCode: 'SERVER_BOUND_SCOPE_SPOOFING' | 'SERVER_BOUND_SCOPE_MISSING' | 'BINDING_VALIDATION_FAILED';
          message: string;
          spoofedParamNames: readonly string[];
      };

const normalizeName = (name: string): string => name.trim().toLowerCase();

function isInputParamType(raw: string): boolean {
    const trimmed = raw.trim();
    return trimmed === 'Input' || trimmed === 'Both';
}

/** Collects all hidden server-bound parameter names (explicit grant bindings + implicit space contextual params). */
export function collectHiddenBoundParamNames(
    grantBindings: Readonly<Record<string, object | string | number | boolean | null | undefined>> | null | undefined,
    extraHiddenParamNames: readonly string[] = [],
): Set<string> {
    const hidden = new Set<string>();
    for (const name of DEFAULT_HIDDEN_BOUND_PARAM_NAMES) {
        hidden.add(normalizeName(name));
    }
    for (const name of Object.keys(grantBindings ?? {})) {
        const clean = normalizeName(name);
        if (clean) hidden.add(clean);
    }
    for (const name of extraHiddenParamNames) {
        const clean = normalizeName(name);
        if (clean) hidden.add(clean);
    }
    return hidden;
}

/** Filters action parameters to ONLY unbound user-level Input/Both parameters for agent visibility. */
export function redactActionParametersForAgent(
    allParams: readonly ActionParamDefinition[],
    hiddenNames: ReadonlySet<string>,
): ExposedAgentActionParam[] {
    const visible: ExposedAgentActionParam[] = [];
    for (const param of allParams) {
        if (!isInputParamType(param.Type)) {
            continue;
        }
        if (hiddenNames.has(normalizeName(param.Name))) {
            continue;
        }
        visible.push({
            Name: param.Name,
            ValueType: param.ValueType?.trim() || 'Scalar',
            IsRequired: Boolean(param.IsRequired),
            IsArray: Boolean(param.IsArray),
            Description: param.Description ?? null,
            DefaultValue: param.DefaultValue ?? null,
        });
    }
    return visible;
}

function jsonSchemaTypeForParam(param: ExposedAgentActionParam): string {
    if (param.IsArray) return 'array';
    const vt = param.ValueType.toLowerCase();
    if (vt.includes('object')) return 'object';
    if (vt.includes('number') || vt.includes('int') || vt.includes('decimal')) return 'number';
    if (vt.includes('bool')) return 'boolean';
    return 'string';
}

/** Builds an agent-visible grant exposure containing strictly unbound user parameters. */
export function buildBoundActionGrantExposure(
    grant: Pick<EffectiveGrant, 'GrantID' | 'Band' | 'Label' | 'Bindings'>,
    action: ActionMetadataDescriptor,
    allParams: readonly ActionParamDefinition[],
    extraHiddenParamNames: readonly string[] = [],
): BoundActionGrantExposure {
    const hiddenSet = collectHiddenBoundParamNames(grant.Bindings, extraHiddenParamNames);
    const exposedParams = redactActionParametersForAgent(allParams, hiddenSet);
    const displayName = grant.Label?.trim() || action.ActionName;

    const properties: Record<string, { type: string; description?: string }> = {};
    const required: string[] = [];
    for (const p of exposedParams) {
        properties[p.Name] = {
            type: jsonSchemaTypeForParam(p),
            ...(p.Description ? { description: p.Description } : {}),
        };
        if (p.IsRequired) {
            required.push(p.Name);
        }
    }

    const hiddenBoundNames: string[] = [];
    for (const p of allParams) {
        if (isInputParamType(p.Type) && hiddenSet.has(normalizeName(p.Name))) {
            hiddenBoundNames.push(p.Name);
        }
    }
    for (const boundKey of Object.keys(grant.Bindings ?? {})) {
        if (!hiddenBoundNames.some((n) => normalizeName(n) === normalizeName(boundKey))) {
            hiddenBoundNames.push(boundKey);
        }
    }

    return {
        GrantID: grant.GrantID,
        ActionID: action.ActionID,
        ActionName: action.ActionName,
        DisplayName: displayName,
        Description: action.Description ?? null,
        Band: grant.Band,
        SupportsAudience: action.SupportsAudience,
        ExposedParams: exposedParams,
        HiddenBoundParamNames: hiddenBoundNames,
        ToolSchema: {
            name: displayName,
            description: action.Description ?? null,
            parameters: {
                type: 'object',
                properties,
                required,
                additionalProperties: false,
            },
        },
    };
}

/** Produces a prompt-safe action catalog that exposes zero hidden bound parameters or bound values. */
export function buildBoundActionPromptCatalog(
    exposures: readonly BoundActionGrantExposure[],
): BoundActionPromptCatalogItem[] {
    return exposures.map((e) => ({
        actionId: e.ActionID,
        name: e.DisplayName,
        description: e.Description,
        parameters: e.ExposedParams,
    }));
}

/**
 * Enforces server-side injection of hidden bound parameters and rejects (or strips) any
 * caller/agent attempt to supply or spoof hidden bound parameters.
 */
export function enforceBoundActionParameters(input: {
    actionName: string;
    callerArgs: BoundParamValuesMap | null | undefined;
    serverBoundValues: BoundParamValuesMap;
    allParams: readonly ActionParamDefinition[];
    extraHiddenParamNames?: readonly string[];
    overridePolicy?: HiddenBoundParamOverridePolicy;
}): BoundActionEnforcementResult {
    const policy: HiddenBoundParamOverridePolicy = input.overridePolicy ?? 'Reject';
    const hiddenSet = collectHiddenBoundParamNames(input.serverBoundValues, input.extraHiddenParamNames ?? []);
    const caller = input.callerArgs ?? {};

    const spoofedParamNames: string[] = [];
    const merged: Record<string, BoundParamValue> = {};

    for (const [key, val] of Object.entries(caller)) {
        if (hiddenSet.has(normalizeName(key))) {
            spoofedParamNames.push(key);
            continue;
        }
        if (val !== undefined) {
            merged[key] = val;
        }
    }

    if (spoofedParamNames.length > 0 && policy === 'Reject') {
        return {
            allowed: false,
            resultCode: 'SERVER_BOUND_SCOPE_SPOOFING',
            message: `Action '${input.actionName}' refused: caller/agent attempted to supply hidden server-bound parameter(s): ${spoofedParamNames.join(', ')}.`,
            spoofedParamNames,
        };
    }

    const inputDefs = input.allParams.filter((p) => isInputParamType(p.Type));
    const boundParamNames: string[] = [];

    // Inject authoritative server-bound values using the action's canonical parameter spelling when defined.
    for (const [boundKey, boundVal] of Object.entries(input.serverBoundValues)) {
        const def = inputDefs.find((d) => normalizeName(d.Name) === normalizeName(boundKey));
        const targetName = def ? def.Name : boundKey;
        if (def?.IsRequired && (boundVal === null || boundVal === undefined || boundVal === '')) {
            return {
                allowed: false,
                resultCode: 'SERVER_BOUND_SCOPE_MISSING',
                message: `Action '${input.actionName}' refused: required server-bound parameter '${targetName}' could not be resolved.`,
                spoofedParamNames,
            };
        }
        if (boundVal !== undefined) {
            merged[targetName] = boundVal;
            if (!boundParamNames.includes(targetName)) {
                boundParamNames.push(targetName);
            }
        }
    }

    // Fail closed if any required hidden parameter has no resolved server value.
    for (const def of inputDefs) {
        if (def.IsRequired && hiddenSet.has(normalizeName(def.Name))) {
            const existing = Object.entries(merged).find(([k]) => normalizeName(k) === normalizeName(def.Name));
            const val = existing?.[1];
            if (val === undefined || val === null || val === '') {
                return {
                    allowed: false,
                    resultCode: 'SERVER_BOUND_SCOPE_MISSING',
                    message: `Action '${input.actionName}' refused: required server-bound parameter '${def.Name}' is missing.`,
                    spoofedParamNames,
                };
            }
        }
    }

    return {
        allowed: true,
        injectedParams: merged,
        boundParamNames,
        strippedSpoofedNames: policy === 'StripAndInject' ? spoofedParamNames : [],
    };
}

export interface DeliveryPrincipalLevelInput {
    level: 'App' | 'SpaceType' | 'RootSpace' | 'SubSpace';
    config: DeliveryPrincipalConfig | null | undefined;
    allowOverride?: boolean;
}

export type NonLooseningPrincipalResolution =
    | {
          ok: true;
          principalUserId: string;
          sourceLevel: 'App' | 'SpaceType' | 'RootSpace' | 'SubSpace';
      }
    | {
          ok: false;
          message: string;
      };

const PRINCIPAL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pure non-loosening per-root delivery principal resolution (CA-4).
 * Never falls back to the approving user's personal identity.
 */
export function resolveNonLooseningDeliveryPrincipal(
    levels: readonly DeliveryPrincipalLevelInput[],
): NonLooseningPrincipalResolution {
    let effectiveAllowlist: Set<string> | null = null;
    let resolvedUserId: string | null = null;
    let sourceLevel: 'App' | 'SpaceType' | 'RootSpace' | 'SubSpace' | null = null;

    for (const entry of levels) {
        const cfg = entry.config;
        if (!cfg) continue;

        if (cfg.AllowFallbackToCaller !== undefined && cfg.AllowFallbackToCaller !== false) {
            return {
                ok: false,
                message: `Delivery principal configuration at ${entry.level} cannot set AllowFallbackToCaller to true.`,
            };
        }

        if (entry.level === 'SubSpace' && entry.allowOverride === false) {
            continue;
        }

        if (cfg.AllowedPrincipalUserIDs && cfg.AllowedPrincipalUserIDs.length > 0) {
            const nextSet = new Set<string>();
            for (const rawId of cfg.AllowedPrincipalUserIDs) {
                const clean = rawId.trim().toLowerCase();
                if (!PRINCIPAL_UUID_RE.test(clean)) {
                    return { ok: false, message: `Invalid AllowedPrincipalUserID "${rawId}" at ${entry.level}.` };
                }
                if (!effectiveAllowlist || effectiveAllowlist.has(clean)) {
                    nextSet.add(clean);
                } else {
                    return {
                        ok: false,
                        message: `Delivery principal allowlist at ${entry.level} cannot loosen ancestor allowlist by adding "${rawId}".`,
                    };
                }
            }
            effectiveAllowlist = nextSet;
        }

        if (cfg.UserID) {
            const cleanUser = cfg.UserID.trim().toLowerCase();
            if (!PRINCIPAL_UUID_RE.test(cleanUser)) {
                return { ok: false, message: `Invalid DeliveryPrincipal.UserID "${cfg.UserID}" at ${entry.level}.` };
            }
            if (effectiveAllowlist && !effectiveAllowlist.has(cleanUser)) {
                return {
                    ok: false,
                    message: `DeliveryPrincipal.UserID "${cfg.UserID}" at ${entry.level} is outside the permitted principal allowlist.`,
                };
            }
            resolvedUserId = cleanUser;
            sourceLevel = entry.level;
        }
    }

    if (!resolvedUserId || !sourceLevel) {
        return {
            ok: false,
            message: 'Per-root delivery principal is not configured; refusing to fall back to caller personal identity.',
        };
    }

    return {
        ok: true,
        principalUserId: resolvedUserId,
        sourceLevel,
    };
}
