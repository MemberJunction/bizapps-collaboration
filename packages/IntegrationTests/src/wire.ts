import { RunView, UserInfo, type IMetadataProvider } from '@memberjunction/core';
import { EscapeSQLString, UUIDsEqual } from '@memberjunction/global';
import type { IntegrationCheckContext } from '@memberjunction/testing-integration/registry';
import { Assert } from '@memberjunction/testing-integration/registry';
import { USER_ENTITY, USER_ROLE_ENTITY } from './entity-names.js';

export function Quote(value: string): string {
    return EscapeSQLString(value);
}

export function SameID(left: string | null | undefined, right: string | null | undefined): boolean {
    return UUIDsEqual(left ?? '', right ?? '');
}

export function View(ctx: IntegrationCheckContext): RunView {
    return RunView.FromMetadataProvider(ctx.Provider as IMetadataProvider);
}

/**
 * Reads rows with the caller's own filter. Pass `BypassCache` to re-read a query a check has already made
 * when the server changed those rows behind the client's back (a save on another entity that writes them).
 */
export async function FindRows<T extends object>(
    ctx: IntegrationCheckContext,
    entityName: string,
    extraFilter: string,
    fields: string[],
    user?: UserInfo,
    options?: { BypassCache?: boolean },
): Promise<T[]> {
    const res = await View(ctx).RunView<T>(
        {
            EntityName: entityName,
            ExtraFilter: extraFilter,
            Fields: fields,
            ResultType: 'simple',
            BypassCache: options?.BypassCache,
        },
        user ?? ctx.User,
    );
    Assert(res.Success, `RunView ${entityName} failed: ${res.ErrorMessage ?? 'unknown'}`);
    return res.Results ?? [];
}

export async function FindId(
    ctx: IntegrationCheckContext,
    entityName: string,
    extraFilter: string,
    user?: UserInfo,
): Promise<string | null> {
    const rows = await FindRows<{ ID: string }>(ctx, entityName, extraFilter, ['ID'], user);
    return rows[0]?.ID ?? null;
}

export async function RequireSave(
    entity: { Save: () => Promise<boolean>; LatestResult?: { CompleteMessage?: string } },
    what: string,
): Promise<void> {
    const saved = await entity.Save();
    Assert(saved, `${what} save failed: ${entity.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

const personaEmailMap: Record<string, string> = {
    ada: 'ada.owner@collab-world.example',
    sam: 'sam.member@collab-world.example',
    casey: 'casey.admin@collab-world.example',
    bea: 'bea.member@collab-world.example',
    dana: 'dana.director@collab-world.example',
    lee: 'lee.learner@collab-world.example',
    rio: 'rio.learner@collab-world.example',
    nora: 'nora.none@collab-world.example',
    harbor: 'harbor.owner@collab-world.example',
    harper: 'harper.member@collab-world.example',
    pat: 'pat.invited@collab-world.example',
    remy: 'remy.removed@collab-world.example',
    dev: 'dev.admin@collab-world.example',
    lena: 'lena.leader@collab-world.example',
    marco: 'marco.leader@collab-world.example',
    nico: 'nico.national@collab-world.example',
};

const personaCache = new Map<string, UserInfo>();

export async function GetPersonaUser(ctx: IntegrationCheckContext, keyOrEmail: string): Promise<UserInfo> {
    const email = (personaEmailMap[keyOrEmail.toLowerCase()] ?? keyOrEmail).toLowerCase();
    if (personaCache.has(email)) return personaCache.get(email)!;

    // Check UserCache provided on context if available
    const ctxWithCache = ctx as { UserCache?: { Users?: UserInfo[] } };
    if (ctxWithCache.UserCache?.Users) {
        const found = ctxWithCache.UserCache.Users.find((u) => u.Email?.toLowerCase() === email);
        if (found) {
            personaCache.set(email, found);
            return found;
        }
    }

    // Resolve over provider
    const view = View(ctx);
    const userRes = await view.RunView<{
        ID: string;
        Name: string;
        FirstName: string;
        LastName: string;
        Email: string;
        Type: string;
        IsActive: boolean;
    }>({
        EntityName: USER_ENTITY,
        ExtraFilter: `Email = '${Quote(email)}'`,
        Fields: ['ID', 'Name', 'FirstName', 'LastName', 'Email', 'Type', 'IsActive'],
        MaxRows: 1,
        ResultType: 'simple',
    }, ctx.User);

    Assert(userRes.Success && (userRes.Results?.length ?? 0) > 0, `User with email ${email} not found.`);
    const rawUser = userRes.Results![0];

    const rolesRes = await view.RunView<{
        UserID: string;
        RoleID: string;
        Role: string;
    }>({
        EntityName: USER_ROLE_ENTITY,
        ExtraFilter: `UserID = '${rawUser.ID}'`,
        Fields: ['UserID', 'RoleID', 'Role'],
        ResultType: 'simple',
    }, ctx.User);

    const userRoles = (rolesRes.Results ?? []).map((r) => ({
        UserID: rawUser.ID,
        RoleID: r.RoleID,
        Role: r.Role,
    }));

    const user = new UserInfo(ctx.Provider as IMetadataProvider, {
        ID: rawUser.ID,
        Name: rawUser.Name,
        FirstName: rawUser.FirstName,
        LastName: rawUser.LastName,
        Email: rawUser.Email,
        Type: rawUser.Type,
        IsActive: rawUser.IsActive,
        UserRoles: userRoles,
    });

    personaCache.set(email, user);
    return user;
}

export {
    getPersonaContext,
    getPersonaClientContext,
    type PersonaIntegrationCheckContext,
    type PersonaClientIntegrationCheckContext,
    cleanupPersonaProviders,
    isClientTransport,
} from './persona-provider.js';
