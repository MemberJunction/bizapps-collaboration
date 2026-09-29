import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import {
    BaseSpaceTypeServerDriver,
    type ChildSpaceChangeContext,
    type DriverValidationResult,
    type ItemChangeContext,
    type SpaceChangeContext,
} from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import { decideSpaceKinds, SpaceEntityServer } from '../dist/SpaceEntityServer.js';
import { decideItemKind, SpaceItemEntityServer } from '../dist/SpaceItemEntityServer.js';

const SPACE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';
const PARENT = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE3';
const ACTOR = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE9';

/** Records what it is asked and answers each hook as told. */
class SpyDriver extends BaseSpaceTypeServerDriver {
    public spaceKinds: string[] = [];
    public childKinds: string[] = [];
    public itemKinds: string[] = [];
    private readonly answers: { space?: DriverValidationResult; child?: DriverValidationResult; item?: DriverValidationResult };
    constructor(answers: { space?: DriverValidationResult; child?: DriverValidationResult; item?: DriverValidationResult } = {}) {
        super();
        this.answers = answers;
    }
    public override ValidateSpaceChange(ctx: SpaceChangeContext): DriverValidationResult {
        this.spaceKinds.push(ctx.kind);
        return this.answers.space ?? { ok: true };
    }
    public override ValidateChildSpaceChange(ctx: ChildSpaceChangeContext): DriverValidationResult {
        this.childKinds.push(ctx.kind);
        return this.answers.child ?? { ok: true };
    }
    public override ValidateItemChange(ctx: ItemChangeContext): DriverValidationResult {
        this.itemKinds.push(ctx.kind);
        return this.answers.item ?? { ok: true };
    }
}

function stubOf<T extends object>(partial: Partial<T>): T {
    return partial as T;
}

describe('deleting a space or an item asks the type first', () => {
    const drivers = new Map<string, SpyDriver>();
    let systemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let resolveSpace: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;

    before(() => {
        systemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
        resolveSpace = ServerDriverRegistry.Instance.ResolveSpaceAndType.bind(ServerDriverRegistry.Instance);
        ServerDriverRegistry.Instance.ResolveSpaceAndType = (async (spaceId: string) => {
            const driver = drivers.get(spaceId.toLowerCase());
            if (!driver) throw new Error(`No driver for ${spaceId}.`);
            return { driver, space: stubOf<mjBizAppsCollaborationSpaceEntity>({}), spaceType: stubOf<mjBizAppsCollaborationSpaceTypeEntity>({}) };
        }) as unknown as typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = systemUser;
        ServerDriverRegistry.Instance.ResolveSpaceAndType = resolveSpace;
    });

    function entity<T extends object>(prototype: T, fields: Record<string, unknown>): { entity: T; history: unknown[] } {
        const target = Object.create(prototype) as T;
        const history: unknown[] = [];
        const descriptors: PropertyDescriptorMap = {
            ContextCurrentUser: { value: { ID: ACTOR, Name: 'Actor', UserRoles: [] }, writable: true },
            IsSaved: { value: true, writable: true },
            ProviderToUse: { value: {}, writable: true },
            RegisterResultHistoryEntry: { value: (entry: unknown) => history.push(entry), writable: true },
        };
        for (const [name, value] of Object.entries(fields)) descriptors[name] = { value, writable: true };
        Object.defineProperties(target, descriptors);
        return { entity: target, history };
    }

    it("asks the space's own driver for Delete, and refuses when it says no", async () => {
        const own = new SpyDriver({ space: { ok: false, message: 'Cannot delete an active Board space. Close it first.' } });
        drivers.set(SPACE.toLowerCase(), own);
        const { entity: space, history } = entity(SpaceEntityServer.prototype, { ID: SPACE, ParentID: null });
        assert.equal(await SpaceEntityServer.prototype.Delete.call(space), false);
        assert.deepEqual(own.spaceKinds, ['Delete']);
        assert.match(JSON.stringify(history), /Close it first/);
    });

    it("asks the parent's driver for DeleteChild, and refuses when it says no", async () => {
        const own = new SpyDriver();
        const parent = new SpyDriver({ child: { ok: false, message: 'A committee under a board is closed, not deleted.' } });
        drivers.set(SPACE.toLowerCase(), own);
        drivers.set(PARENT.toLowerCase(), parent);
        const { entity: space, history } = entity(SpaceEntityServer.prototype, { ID: SPACE, ParentID: PARENT });
        assert.equal(await SpaceEntityServer.prototype.Delete.call(space), false);
        assert.deepEqual(own.spaceKinds, ['Delete']);
        assert.deepEqual(parent.childKinds, ['DeleteChild']);
        assert.match(JSON.stringify(history), /closed, not deleted/);
    });

    it('deletes a space that has its subtype attached through the subtype, without asking the driver first', async () => {
        const own = new SpyDriver({ space: { ok: false, message: 'Not asked here.' } });
        drivers.set(SPACE.toLowerCase(), own);
        const calls: unknown[] = [];
        const leaf = { Delete: async (options?: unknown) => { calls.push(options); return true; } };
        const { entity: space } = entity(SpaceEntityServer.prototype, { ID: SPACE, ParentID: null, LeafEntity: leaf });
        const options = { SkipEntityActions: true };
        assert.equal(await SpaceEntityServer.prototype.Delete.call(space, options), true);
        assert.deepEqual(calls, [options]);
        assert.deepEqual(own.spaceKinds, []);
    });

    it('asks the driver once the subtype delete reaches the space row', async () => {
        const own = new SpyDriver({ space: { ok: false, message: 'Close it first.' } });
        drivers.set(SPACE.toLowerCase(), own);
        const leaf = { Delete: async () => { throw new Error('The chain must not go back to the subtype.'); } };
        const { entity: space } = entity(SpaceEntityServer.prototype, { ID: SPACE, ParentID: null, LeafEntity: leaf });
        assert.equal(await SpaceEntityServer.prototype.Delete.call(space, { IsParentEntityDelete: true }), false);
        assert.deepEqual(own.spaceKinds, ['Delete']);
    });

    it('refuses the delete of a space whose type has no driver, closed', async () => {
        drivers.delete(SPACE.toLowerCase());
        const { entity: space } = entity(SpaceEntityServer.prototype, { ID: SPACE, ParentID: null });
        assert.equal(await SpaceEntityServer.prototype.Delete.call(space), false);
    });

    it("asks the space's driver for Remove before an item is deleted", async () => {
        const own = new SpyDriver({ item: { ok: false, message: 'Filed papers stay on the record.' } });
        drivers.set(SPACE.toLowerCase(), own);
        const { entity: item, history } = entity(SpaceItemEntityServer.prototype, {
            ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEF7',
            SpaceID: SPACE,
            CheckPermissions: () => true,
        });
        assert.equal(await SpaceItemEntityServer.prototype.Delete.call(item), false);
        assert.deepEqual(own.itemKinds, ['Remove']);
        assert.match(JSON.stringify(history), /stay on the record/);
    });
});

describe('the kind of change a space or an item save is', () => {
    const none = { isNew: false, isClosing: false, isReopening: false, isMoving: false };

    it('names a create, a close, a reopen, a move and a plain update for the space, and the matching kind for its parent', () => {
        assert.deepEqual(decideSpaceKinds({ ...none, isNew: true }), { spaceKind: 'Create', childKind: 'CreateChild' });
        assert.deepEqual(decideSpaceKinds({ ...none, isClosing: true }), { spaceKind: 'Close', childKind: 'CloseChild' });
        assert.deepEqual(decideSpaceKinds({ ...none, isReopening: true }), { spaceKind: 'Reopen', childKind: 'ReopenChild' });
        assert.deepEqual(decideSpaceKinds({ ...none, isMoving: true }), { spaceKind: 'Move', childKind: 'MoveChildIn' });
    });

    it("calls a child's rename an UpdateChild, not a move in", () => {
        assert.deepEqual(decideSpaceKinds(none), { spaceKind: 'Update', childKind: 'UpdateChild' });
    });

    it('names an item add, move, promote and update, and a new item is an Add even though its space column is dirty', () => {
        const base = { isNew: false, spaceChanged: false, bandChanged: false, band: 'Team' };
        assert.equal(decideItemKind({ ...base, isNew: true, spaceChanged: true }), 'Add');
        assert.equal(decideItemKind({ ...base, spaceChanged: true }), 'Move');
        assert.equal(decideItemKind({ ...base, bandChanged: true, band: 'Shared' }), 'Promote');
        assert.equal(decideItemKind({ ...base, bandChanged: true, band: 'Team' }), 'Update');
        assert.equal(decideItemKind(base), 'Update');
    });
});
