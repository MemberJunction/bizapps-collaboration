import { type IMetadataProvider } from '@memberjunction/core';
import { BaseSingleton, GetGlobalObjectStore, UUIDsEqual } from '@memberjunction/global';
import { GraphQLDataProvider, GraphQLProviderConfigData } from '@memberjunction/graphql-dataprovider';
import { GetAPIKeyEngine } from '@memberjunction/api-keys';
import { MJAPIKeyEntity, MJAPIKeyScopeEntity } from '@memberjunction/core-entities';
import { Assert, LoadClientConfig } from '@memberjunction/testing-integration';
import type { IntegrationCheckContext } from '@memberjunction/testing-integration/registry';
import { GetPersonaUser } from './wire.js';

const GRAPHQL_PROVIDER_SINGLETON_KEY = '___SINGLETON__GraphQLDataProvider';

export function isClientTransport(ctx: IntegrationCheckContext): boolean {
    const hasPool = 'Pool' in ctx && !!(ctx as { Pool?: unknown }).Pool;
    const hasExecuteGQL = !!ctx.Provider && 'ExecuteGQL' in ctx.Provider && typeof (ctx.Provider as { ExecuteGQL: unknown }).ExecuteGQL === 'function';
    return !hasPool && hasExecuteGQL;
}

export function newSecondaryGraphQLProvider(): GraphQLDataProvider {
    const store = GetGlobalObjectStore();
    const singleton = store?.[GRAPHQL_PROVIDER_SINGLETON_KEY];
    if (store) {
        delete store[GRAPHQL_PROVIDER_SINGLETON_KEY];
    }
    try {
        return new GraphQLDataProvider();
    } finally {
        if (store && singleton) {
            store[GRAPHQL_PROVIDER_SINGLETON_KEY] = singleton;
        }
    }
}

export async function buildUserKeyProvider(rawKey: string): Promise<GraphQLDataProvider> {
    const client = LoadClientConfig();
    const provider = newSecondaryGraphQLProvider();
    const config = new GraphQLProviderConfigData(
        '', // no JWT
        client.Url,
        '', // no websocket needed
        async () => '',
        undefined,
        undefined,
        undefined,
        undefined, // NO system key
        rawKey,
    );
    const ok = await provider.Config(config, undefined, true /* separateConnection */);
    if (!ok) {
        throw new Error('secondary GraphQLDataProvider Config() returned false');
    }
    return provider;
}

export async function buildUserKeyProviderWithRetry(rawKey: string): Promise<GraphQLDataProvider> {
    const deadline = Date.now() + 60_000;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            return await buildUserKeyProvider(rawKey);
        } catch (e) {
            lastError = e;
            await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function mintUserApiKey(
    ctx: IntegrationCheckContext,
    userId: string,
    label: string,
): Promise<{ rawKey: string; keyId: string; scopeRuleId: string }> {
    const engine = GetAPIKeyEngine();
    await engine.Config(false, ctx.User, ctx.Provider as IMetadataProvider);
    const created = await engine.CreateAPIKey({ UserId: userId, Label: label }, ctx.User);
    if (!created.Success || !created.RawKey || !created.APIKeyId) {
        throw new Error(`CreateAPIKey('${label}') failed: ${created.Error ?? 'no raw key returned'}`);
    }

    const fullAccess = engine.Scopes.find((s) => s.FullPath === 'full_access');
    if (!fullAccess) {
        throw new Error("the seeded 'full_access' API scope was not found — cannot authorize the minted key");
    }

    const rule = await ctx.Provider.GetEntityObject<MJAPIKeyScopeEntity>('MJ: API Key Scopes', ctx.User);
    rule.NewRecord();
    rule.APIKeyID = created.APIKeyId;
    rule.ScopeID = fullAccess.ID;
    rule.ResourcePattern = '*';
    rule.PatternType = 'Include';
    rule.IsDeny = false;
    rule.Priority = 0;
    if (!(await rule.Save())) {
        throw new Error(`granting full_access to the minted key failed: ${rule.LatestResult?.CompleteMessage ?? ''}`);
    }

    return {
        rawKey: created.RawKey,
        keyId: created.APIKeyId,
        scopeRuleId: rule.ID,
    };
}

export interface PersonaIntegrationCheckContext extends IntegrationCheckContext {
    GraphQLProvider?: GraphQLDataProvider;
}

export class PersonaContextRegistry extends BaseSingleton<PersonaContextRegistry> {
    private readonly personaProviders = new Map<string, GraphQLDataProvider>();
    private readonly createdKeyIds: string[] = [];
    private readonly createdScopeRuleIds: string[] = [];

    public constructor() {
        super();
    }

    public static get Instance(): PersonaContextRegistry {
        return PersonaContextRegistry.getInstance<PersonaContextRegistry>();
    }

    async getPersonaContext(ctx: IntegrationCheckContext, personaKey: string): Promise<PersonaIntegrationCheckContext> {
        const personaUser = await GetPersonaUser(ctx, personaKey);

        if (!isClientTransport(ctx)) {
            // Server transport: delegate to base provider with CurrentUser set to persona
            const serverProvider = Object.create(ctx.Provider);
            Object.defineProperty(serverProvider, 'CurrentUser', {
                value: personaUser,
                configurable: true,
                enumerable: true,
            });
            Assert(
                UUIDsEqual(serverProvider.CurrentUser?.ID, personaUser.ID),
                `Server provider CurrentUser is ${personaKey}`,
            );
            return {
                ...ctx,
                Provider: serverProvider as IMetadataProvider,
                User: personaUser,
            };
        }

        // Client transport: authenticate via minted user key
        const userUuid = personaUser.ID.toLowerCase();
        let provider = this.personaProviders.get(userUuid);
        if (!provider) {
            const minted = await mintUserApiKey(ctx, personaUser.ID, `test-persona-${personaKey}-${Date.now()}`);
            this.createdKeyIds.push(minted.keyId);
            this.createdScopeRuleIds.push(minted.scopeRuleId);
            provider = await buildUserKeyProviderWithRetry(minted.rawKey);
            this.personaProviders.set(userUuid, provider);
        }

        Assert(
            UUIDsEqual(provider.CurrentUser?.ID, personaUser.ID),
            `Client provider CurrentUser must be ${personaKey} (${personaUser.ID}), saw ${provider.CurrentUser?.ID}`,
        );

        return {
            ...ctx,
            Provider: provider,
            User: provider.CurrentUser ?? personaUser,
            GraphQLProvider: provider,
        };
    }

    async cleanup(ctx: IntegrationCheckContext): Promise<void> {
        const errors: string[] = [];
        while (this.createdScopeRuleIds.length > 0) {
            const ruleId = this.createdScopeRuleIds.pop();
            if (ruleId) {
                try {
                    const rule = await ctx.Provider.GetEntityObject<MJAPIKeyScopeEntity>('MJ: API Key Scopes', ctx.User);
                    if (await rule.Load(ruleId)) {
                        const deleted = await rule.Delete();
                        if (!deleted) {
                            errors.push(`Failed to delete API key scope rule ${ruleId}: ${rule.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                        }
                    }
                } catch (e) {
                    errors.push(`Error deleting API key scope rule ${ruleId}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        }

        while (this.createdKeyIds.length > 0) {
            const keyId = this.createdKeyIds.pop();
            if (keyId) {
                try {
                    const key = await ctx.Provider.GetEntityObject<MJAPIKeyEntity>('MJ: API Keys', ctx.User);
                    if (await key.Load(keyId)) {
                        const deleted = await key.Delete();
                        if (!deleted) {
                            errors.push(`Failed to delete API key ${keyId}: ${key.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                        }
                    }
                } catch (e) {
                    errors.push(`Error deleting API key ${keyId}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        }

        this.personaProviders.clear();

        if (errors.length > 0) {
            throw new Error(`cleanupPersonaProviders encountered ${errors.length} error(s):\n${errors.join('\n')}`);
        }
    }
}

export const PersonaRegistry = PersonaContextRegistry.Instance;

export interface PersonaClientIntegrationCheckContext extends PersonaIntegrationCheckContext {
    GraphQLProvider: GraphQLDataProvider;
}

export async function getPersonaContext(ctx: IntegrationCheckContext, personaKey: string): Promise<PersonaIntegrationCheckContext> {
    return PersonaRegistry.getPersonaContext(ctx, personaKey);
}

export async function getPersonaClientContext(ctx: IntegrationCheckContext, personaKey: string): Promise<PersonaClientIntegrationCheckContext> {
    const pCtx = await PersonaRegistry.getPersonaContext(ctx, personaKey);
    Assert(!!pCtx.GraphQLProvider, `GraphQLProvider is required on client path for persona '${personaKey}'`);
    return pCtx as PersonaClientIntegrationCheckContext;
}

export async function cleanupPersonaProviders(ctx: IntegrationCheckContext): Promise<void> {
    return PersonaRegistry.cleanup(ctx);
}

