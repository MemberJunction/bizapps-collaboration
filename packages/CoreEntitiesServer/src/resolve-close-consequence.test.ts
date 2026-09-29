import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { resolveCloseConsequence } from '../dist/resolve-close-consequence.js';

const SPACE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE1';
const PARENT = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';
const TYPE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE3';
const KEEPER = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE4';
const VIEWER = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE5';

const viewer = { ID: VIEWER, Name: 'Viewer', UserRoles: [] } as unknown as UserInfo;

/** A provider that answers the reads the resolver makes, and records who asked. */
function provider(options: { viewerCanRead: boolean }) {
    const askedAs: string[] = [];
    const answer = (entity: string, filter: string, user: UserInfo | undefined): object[] => {
        askedAs.push(`${entity}:${user?.ID ?? 'none'}`);
        if (entity.endsWith('Spaces')) {
            if (user?.ID === VIEWER && !options.viewerCanRead) return [];
            return [{ ID: SPACE, ParentID: PARENT, SpaceTypeID: TYPE, OwnerID: KEEPER, Configuration: JSON.stringify({ Chats: { WhoCanStart: 'Anyone' } }) }];
        }
        if (entity === 'MJ: Users') return [{ Name: 'Ada Owner' }];
        if (entity === 'MJ: User Roles') return [{ Role: 'UI', RoleID: 'r1' }, { Role: 'Space Participant', RoleID: 'r2' }];
        return filter ? [] : [];
    };
    const md = {
        async RunView(params: { EntityName: string; ExtraFilter?: string }, user?: UserInfo) {
            const rows = answer(params.EntityName, params.ExtraFilter ?? '', user);
            return { Success: true, Results: rows, RowCount: rows.length };
        },
    } as unknown as IMetadataProvider;
    return { md, askedAs };
}

describe('what closing a space would do, read on the server', () => {
    let systemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let resolved: typeof CollaborationEngine.Instance.ResolvePostCloseAccessForSpace;
    let reopen: typeof CollaborationEngine.Instance.UserCanReopenSpace;
    let stamped = { access: 'None' as 'ReadOnly' | 'ReadOnlyWithAgent' | 'None', days: null as number | null };
    let canReopen = true;
    let resolveParams: Parameters<typeof CollaborationEngine.Instance.ResolvePostCloseAccessForSpace>[0] | null = null;
    let reopenFor: { id: string; roles: string[] } | null = null;

    before(() => {
        const engine = CollaborationEngine.Instance;
        systemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
        resolved = engine.ResolvePostCloseAccessForSpace.bind(engine);
        engine.ResolvePostCloseAccessForSpace = async (params) => { resolveParams = params; return stamped; };
        reopen = engine.UserCanReopenSpace.bind(engine);
        engine.UserCanReopenSpace = async (user) => { reopenFor = { id: user.ID, roles: (user.UserRoles ?? []).map((role) => role.Role ?? '') }; return canReopen; };
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = systemUser;
        CollaborationEngine.Instance.ResolvePostCloseAccessForSpace = resolved;
        CollaborationEngine.Instance.UserCanReopenSpace = reopen;
    });

    it("returns what the close would stamp (resolved as the close resolves it, from the parent and the space's own settings), the keeper's name, and whether they can reopen it", async () => {
        stamped = { access: 'None', days: null };
        canReopen = true;
        const { md } = provider({ viewerCanRead: true });
        const result = await resolveCloseConsequence(md, viewer, SPACE);
        assert.deepEqual(result, { access: 'None', days: null, keeperUserId: KEEPER.toLowerCase(), keeperName: 'Ada Owner', keeperCanReopen: true });
        assert.equal(resolveParams?.parentId, PARENT);
        assert.equal(resolveParams?.spaceTypeId, TYPE);
        assert.deepEqual(resolveParams?.currentConfig, { Chats: { WhoCanStart: 'Anyone' } });
    });

    it('carries a window, and asks the keeper\'s right as the keeper, with their roles', async () => {
        stamped = { access: 'ReadOnly', days: 30 };
        const { md } = provider({ viewerCanRead: true });
        const result = await resolveCloseConsequence(md, viewer, SPACE);
        assert.equal(result.access, 'ReadOnly');
        assert.equal(result.days, 30);
        assert.deepEqual(reopenFor, { id: KEEPER.toLowerCase(), roles: ['UI', 'Space Participant'] });
    });

    it('says the keeper cannot reopen it when the engine says so', async () => {
        canReopen = false;
        const { md } = provider({ viewerCanRead: true });
        assert.equal((await resolveCloseConsequence(md, viewer, SPACE)).keeperCanReopen, false);
        canReopen = true;
    });

    it('refuses a viewer who cannot read the space, and never tells them its keeper', async () => {
        const { md } = provider({ viewerCanRead: false });
        await assert.rejects(resolveCloseConsequence(md, viewer, SPACE), /not one you can read/);
    });

    it('refuses an id that is not a space id', async () => {
        const { md } = provider({ viewerCanRead: true });
        await assert.rejects(resolveCloseConsequence(md, viewer, "x'; DROP TABLE"), /not a valid space id/);
    });
});
