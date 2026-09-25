import { RunView, UserInfo, type IMetadataProvider } from '@memberjunction/core';
import { GetGlobalObjectStore, UUIDsEqual } from '@memberjunction/global';
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

class PersonaContextRegistry {
    private readonly personaProviders = new Map<string, GraphQLDataProvider>();
    private readonly createdKeyIds: string[] = [];
    private readonly createdScopeRuleIds: string[] = [];

    async getPersonaContext(ctx: IntegrationCheckContext, personaKey: string): Promise<IntegrationCheckContext> {
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
            Provider: provider as unknown as IMetadataProvider,
            User: provider.CurrentUser ?? personaUser,
        };
    }

    async cleanup(ctx: IntegrationCheckContext): Promise<void> {
        while (this.createdScopeRuleIds.length > 0) {
            const ruleId = this.createdScopeRuleIds.pop();
            if (ruleId) {
                try {
                    const rule = await ctx.Provider.GetEntityObject<MJAPIKeyScopeEntity>('MJ: API Key Scopes', ctx.User);
                    if (await rule.Load(ruleId)) {
                        await rule.Delete();
                    }
                } catch {
                    // best effort
                }
            }
        }

        while (this.createdKeyIds.length > 0) {
            const keyId = this.createdKeyIds.pop();
            if (keyId) {
                try {
                    const key = await ctx.Provider.GetEntityObject<MJAPIKeyEntity>('MJ: API Keys', ctx.User);
                    if (await key.Load(keyId)) {
                        await key.Delete();
                    }
                } catch {
                    // best effort
                }
            }
        }

        this.personaProviders.clear();
    }
}

export const PersonaRegistry = new PersonaContextRegistry();

export async function getPersonaContext(ctx: IntegrationCheckContext, personaKey: string): Promise<IntegrationCheckContext> {
    return PersonaRegistry.getPersonaContext(ctx, personaKey);
}

export async function cleanupPersonaProviders(ctx: IntegrationCheckContext): Promise<void> {
    return PersonaRegistry.cleanup(ctx);
}
