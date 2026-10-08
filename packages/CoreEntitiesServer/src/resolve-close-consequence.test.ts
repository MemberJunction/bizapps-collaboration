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
        async RunViews(params: { EntityName: string; ExtraFilter?: string }[], user?: UserInfo) {
            return params.map((one) => {
                const rows = answer(one.EntityName, one.ExtraFilter ?? '', user);
                return { Success: true, Results: rows, RowCount: rows.length };
            });
        },
        async RunView(params: { EntityName: string; ExtraFilter?: string }, user?: UserInfo) {
            const rows = answer(params.EntityName, params.ExtraFilter ?? '', user);
            return { Success: true, Results: rows, RowCount: rows.length };
        },
    } as unknown as IMetadataProvider;
    return { md, askedAs };
}

/** A type's statuses as the engine holds them: Active, Paused, Closed, Archived in the shipped shape. */
const status = (id: string, code: string, name: string, sequence: number, over: Partial<Record<string, unknown>> = {}) => ({
    ID: id, SpaceTypeID: TYPE, Code: code, Name: name, Sequence: sequence, IsDefault: code === 'active', ReadOnly: code !== 'active', Visible: code !== 'archived',
    AgentRetrieval: code !== 'archived', CanChangeAfter: code !== 'archived', NotifyMembersOnEnter: code === 'paused' || code === 'closed', IsTerminal: code === 'closed' || code === 'archived', ...over,
});
const SHIPPED = [
    status('E0000000-0000-4000-8000-000000000001', 'active', 'Active', 1),
    status('E0000000-0000-4000-8000-000000000002', 'paused', 'Paused', 2),
    status('E0000000-0000-4000-8000-000000000003', 'closed', 'Closed', 3),
    status('E0000000-0000-4000-8000-000000000004', 'archived', 'Archived', 4),
];

describe('what closing a space would do, read on the server', () => {
    let systemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let changeStatus: typeof CollaborationEngine.Instance.UserCanChangeSpaceStatus;
    let statusesFor: typeof CollaborationEngine.Instance.StatusesForType;
    let terminalFor: typeof CollaborationEngine.Instance.FirstTerminalStatusForType;
    let ensureLoaded: typeof CollaborationEngine.Instance.EnsureLoaded;
    let statuses: ReturnType<typeof status>[] = SHIPPED;
    let canReopen = true;
    let reopenFor: { id: string; roles: string[] } | null = null;
    let viewerCanClose = true;
    let reopenThrows = false;
    let close: typeof CollaborationEngine.Instance.UserCanCloseSpace;

    before(() => {
        const engine = CollaborationEngine.Instance;
        systemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
        ensureLoaded = engine.EnsureLoaded.bind(engine);
        engine.EnsureLoaded = async () => undefined;
        statusesFor = engine.StatusesForType.bind(engine);
        engine.StatusesForType = () => [...statuses].sort((a, b) => a.Sequence - b.Sequence) as unknown as ReturnType<typeof statusesFor>;
        terminalFor = engine.FirstTerminalStatusForType.bind(engine);
        engine.FirstTerminalStatusForType = () => [...statuses].sort((a, b) => a.Sequence - b.Sequence).find((s) => s.IsTerminal) as unknown as ReturnType<typeof terminalFor>;
        changeStatus = engine.UserCanChangeSpaceStatus.bind(engine);
        close = engine.UserCanCloseSpace.bind(engine);
        engine.UserCanCloseSpace = async () => viewerCanClose;
        engine.UserCanChangeSpaceStatus = async (user) => { if (reopenThrows) throw new Error('the seat could not be read'); reopenFor = { id: user.ID, roles: (user.UserRoles ?? []).map((role) => role.Role ?? '') }; return canReopen; };
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = systemUser;
        CollaborationEngine.Instance.EnsureLoaded = ensureLoaded;
        CollaborationEngine.Instance.StatusesForType = statusesFor;
        CollaborationEngine.Instance.FirstTerminalStatusForType = terminalFor;
        CollaborationEngine.Instance.UserCanChangeSpaceStatus = changeStatus;
        CollaborationEngine.Instance.UserCanCloseSpace = close;
    });

    it("returns the status the close moves the space to (the type's first terminal status) and what it allows, the keeper's name, and whether they can reopen it", async () => {
        statuses = SHIPPED;
        canReopen = true;
        const { md } = provider({ viewerCanRead: true });
        const result = await resolveCloseConsequence(md, viewer, SPACE);
        assert.equal(result.status?.Code, 'closed');
        assert.deepEqual([result.readOnly, result.visible, result.agentRetrieval], [true, true, true]);
        assert.deepEqual({ keeperUserId: result.keeperUserId, keeperName: result.keeperName }, { keeperUserId: KEEPER.toLowerCase(), keeperName: 'Ada Owner' });
        // Closed is terminal and the only status after it is Archived (read-only): nobody reopens it, whatever their right
        assert.equal(result.keeperCanReopen, false);
    });

    it("asks the keeper's right as the keeper, with their roles, when a writable status follows the close", async () => {
        // A type whose Closed is followed by a Reopened status that allows writes
        statuses = [...SHIPPED.slice(0, 3), status('E0000000-0000-4000-8000-000000000005', 'reopened', 'Reopened', 5, { ReadOnly: false, IsTerminal: false })];
        const { md } = provider({ viewerCanRead: true });
        const result = await resolveCloseConsequence(md, viewer, SPACE);
        assert.equal(result.keeperCanReopen, true);
        assert.deepEqual(reopenFor, { id: KEEPER.toLowerCase(), roles: ['UI', 'Space Participant'] });
    });

    it('reads a type with no statuses yet as read-only and visible, with no status to name', async () => {
        statuses = [];
        try {
            const { md } = provider({ viewerCanRead: true });
            const result = await resolveCloseConsequence(md, viewer, SPACE);
            assert.equal(result.status, null);
            assert.deepEqual([result.readOnly, result.visible, result.agentRetrieval], [true, true, true]);
            assert.equal(result.keeperCanReopen, false);
        } finally {
            statuses = SHIPPED;
        }
    });

    it('says the keeper cannot reopen it when the engine says so', async () => {
        statuses = [...SHIPPED.slice(0, 3), status('E0000000-0000-4000-8000-000000000005', 'reopened', 'Reopened', 5, { ReadOnly: false, IsTerminal: false })];
        canReopen = false;
        try {
            const { md } = provider({ viewerCanRead: true });
            assert.equal((await resolveCloseConsequence(md, viewer, SPACE)).keeperCanReopen, false);
        } finally {
            canReopen = true;
            statuses = SHIPPED;
        }
    });

    it('answers null, not false, when the check of the keeper\'s right fails: could not check is not cannot', async () => {
        statuses = [...SHIPPED.slice(0, 3), status('E0000000-0000-4000-8000-000000000005', 'reopened', 'Reopened', 5, { ReadOnly: false, IsTerminal: false })];
        reopenThrows = true;
        try {
            const { md } = provider({ viewerCanRead: true });
            assert.equal((await resolveCloseConsequence(md, viewer, SPACE)).keeperCanReopen, null);
        } finally {
            reopenThrows = false;
            statuses = SHIPPED;
        }
    });

    it('refuses someone who can read the space but may not close it: they are not told who keeps it', async () => {
        viewerCanClose = false;
        try {
            const { md } = provider({ viewerCanRead: true });
            await assert.rejects(resolveCloseConsequence(md, viewer, SPACE), /Only someone who may close this space can ask/);
        } finally {
            viewerCanClose = true;
        }
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
