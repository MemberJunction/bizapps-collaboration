import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { grantAdministerToDefaultRoles } from '../dist/test-support.js';
import { BaseEntity, WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import {
    BaseSpaceTypeServerDriver,
    type ChildSpaceChangeContext,
    type ItemChangeContext,
    type MemberChangeContext,
    type SpaceChangeContext,
} from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import { SpaceEntityServer } from '../dist/SpaceEntityServer.js';
import { SpaceItemEntityServer } from '../dist/SpaceItemEntityServer.js';
import { SpaceMemberEntityServer } from '../dist/SpaceMemberEntityServer.js';

// Staff stand-ins: the engine answers 'Administer Spaces' the way the shipped grants do, by the roles a test user carries
let restoreAdminister: () => void;
before(() => { restoreAdminister = grantAdministerToDefaultRoles(); });
after(() => { restoreAdminister(); });

const SPACE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';
const PARENT = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE3';
const OLD_PARENT = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE4';
const ACTOR = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE9';

interface Heard {
    hook: string;
    kind: string;
    oldValues?: Record<string, unknown>;
}

/** Records every reaction it is told about, tagged with the space it belongs to. */
class ReactionSpy extends BaseSpaceTypeServerDriver {
    public readonly heard: Heard[] = [];
    public override OnSpaceChanged(ctx: SpaceChangeContext): void {
        this.heard.push({ hook: 'OnSpaceChanged', kind: ctx.kind, oldValues: ctx.oldValues });
    }
    public override OnChildSpaceChanged(ctx: ChildSpaceChangeContext): void {
        this.heard.push({ hook: 'OnChildSpaceChanged', kind: ctx.kind, oldValues: ctx.oldValues });
    }
    public override OnItemChanged(ctx: ItemChangeContext): void {
        this.heard.push({ hook: 'OnItemChanged', kind: ctx.kind, oldValues: ctx.oldValues });
    }
    public override OnMemberChanged(ctx: MemberChangeContext): void {
        this.heard.push({ hook: 'OnMemberChanged', kind: ctx.kind, oldValues: ctx.oldValues });
    }
}

interface FieldState {
    Name: string;
    Dirty: boolean;
    OldValue: unknown;
    Value: unknown;
}

describe('what each reaction hears, through Save', () => {
    const drivers = new Map<string, ReactionSpy>();
    let systemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let resolveSpace: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    let resolveType: typeof ServerDriverRegistry.Instance.ResolveType;
    let getDriver: typeof ServerDriverRegistry.Instance.GetDriverForType;
    let baseSave: typeof BaseEntity.prototype.Save;

    const driverFor = (id: string): ReactionSpy => {
        const key = id.toLowerCase();
        if (!drivers.has(key)) drivers.set(key, new ReactionSpy());
        return drivers.get(key)!;
    };

    before(() => {
        systemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
        const registry = ServerDriverRegistry.Instance;
        resolveSpace = registry.ResolveSpaceAndType.bind(registry);
        resolveType = registry.ResolveType.bind(registry);
        getDriver = registry.GetDriverForType.bind(registry);
        registry.ResolveSpaceAndType = (async (id: string) => ({ driver: driverFor(id), space: {}, spaceType: {} })) as unknown as typeof registry.ResolveSpaceAndType;
        registry.ResolveType = (async () => ({ Code: 'test-type' })) as unknown as typeof registry.ResolveType;
        registry.GetDriverForType = (() => driverFor(SPACE)) as unknown as typeof registry.GetDriverForType;
        // MJ runs validation inside Save and clears the dirty flags when it is done: the stub does the same
        baseSave = BaseEntity.prototype.Save;
        BaseEntity.prototype.Save = async function (this: BaseEntity): Promise<boolean> {
            const fields = this.Fields as unknown as FieldState[];
            // A clean, saved record: MJ returns true without validating or writing
            if (this.IsSaved && !fields.some((f) => f.Dirty)) return true;
            const result = await this.ValidateAsync();
            if (!result.Success) return false;
            // After a save the record is saved, its old values are its new ones and nothing is dirty
            (this as unknown as { IsSaved: boolean }).IsSaved = true;
            for (const field of fields) {
                field.OldValue = field.Value;
                field.Dirty = false;
            }
            return true;
        } as typeof BaseEntity.prototype.Save;
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = systemUser;
        const registry = ServerDriverRegistry.Instance;
        registry.ResolveSpaceAndType = resolveSpace;
        registry.ResolveType = resolveType;
        registry.GetDriverForType = getDriver;
        BaseEntity.prototype.Save = baseSave;
    });

    function entity<T extends object>(prototype: T, values: Record<string, unknown>, dirty: Record<string, unknown>, isSaved: boolean): T {
        const target = Object.create(prototype) as T;
        const fields: FieldState[] = [
            ...Object.entries(values).filter(([Name]) => !(Name in dirty)).map(([Name, Value]) => ({ Name, Value, OldValue: Value, Dirty: false })),
            ...Object.entries(dirty).map(([Name, OldValue]) => ({ Name, Value: values[Name], OldValue, Dirty: true })),
        ];
        const props: PropertyDescriptorMap = {
            ContextCurrentUser: { value: { ID: ACTOR, Name: 'Actor', UserRoles: [] }, writable: true },
            IsSaved: { value: isSaved, writable: true },
            ProviderToUse: { value: {}, writable: true },
            RunViewProviderToUse: { value: {}, writable: true },
            Fields: { value: fields, writable: true },
            ValidateAsync: { value: async () => ({ Success: true, Errors: [] }), writable: true },
        };
        for (const [name, value] of Object.entries(values)) props[name] = { value, writable: true };
        Object.defineProperties(target, props);
        return target;
    }

    const spaceEntity = (values: Record<string, unknown>, dirty: Record<string, unknown>, isSaved = true): SpaceEntityServer =>
        entity(SpaceEntityServer.prototype, { ID: SPACE, SpaceTypeID: 'type-1', ParentID: PARENT, ClosedAt: null, ...values }, dirty, isSaved);

    async function saveAndHear(target: SpaceEntityServer): Promise<{ own: Heard[]; parent: Heard[]; leftParent: Heard[] }> {
        drivers.clear();
        await SpaceEntityServer.prototype.Save.call(target);
        return { own: driverFor(SPACE).heard, parent: driverFor(PARENT).heard, leftParent: driverFor(OLD_PARENT).heard };
    }

    it('tells a create Create and its parent CreateChild, with no old values', async () => {
        const heard = await saveAndHear(spaceEntity({ ParentID: PARENT }, { ParentID: null, Name: null }, false));
        assert.deepEqual(heard.own.map((h) => [h.hook, h.kind]), [['OnSpaceChanged', 'Create']]);
        assert.deepEqual(heard.parent.map((h) => [h.hook, h.kind]), [['OnChildSpaceChanged', 'CreateChild']]);
        assert.deepEqual(heard.own[0].oldValues, {});
    });

    it('tells a close Close and its parent CloseChild, and a reopen Reopen and ReopenChild', async () => {
        const closed = await saveAndHear(spaceEntity({ ClosedAt: new Date() }, { ClosedAt: null }));
        assert.equal(closed.own[0].kind, 'Close');
        assert.equal(closed.parent[0].kind, 'CloseChild');
        const reopened = await saveAndHear(spaceEntity({ ClosedAt: null }, { ClosedAt: new Date() }));
        assert.equal(reopened.own[0].kind, 'Reopen');
        assert.equal(reopened.parent[0].kind, 'ReopenChild');
    });

    it('tells a move Move, the new parent MoveChildIn and the parent it left MoveChildOut, with the old parent in the old values', async () => {
        const heard = await saveAndHear(spaceEntity({ ParentID: PARENT }, { ParentID: OLD_PARENT }));
        assert.equal(heard.own[0].kind, 'Move');
        assert.equal(heard.parent[0].kind, 'MoveChildIn');
        assert.deepEqual(heard.leftParent.map((h) => h.kind), ['MoveChildOut']);
        assert.equal(heard.own[0].oldValues?.['ParentID'], OLD_PARENT);
    });

    it("tells a child's rename UpdateChild, not a move, and hands over what the name was", async () => {
        const heard = await saveAndHear(spaceEntity({ Name: 'New name' }, { Name: 'Old name' }));
        assert.equal(heard.own[0].kind, 'Update');
        assert.equal(heard.parent[0].kind, 'UpdateChild');
        assert.equal(heard.leftParent.length, 0);
        assert.deepEqual(heard.own[0].oldValues, { Name: 'Old name' });
    });

    it('hears nothing for a save that changes nothing, and its own kind on the next real change', async () => {
        const target = spaceEntity({ ClosedAt: new Date() }, { ClosedAt: null });
        const closed = await saveAndHear(target);
        assert.equal(closed.own[0].kind, 'Close');
        // Nothing is dirty now: a clean save tells nobody anything
        drivers.clear();
        await SpaceEntityServer.prototype.Save.call(target);
        assert.deepEqual(driverFor(SPACE).heard, []);
        assert.deepEqual(driverFor(PARENT).heard, []);
        // A rename after the close is an update, not the close again
        const fields = target.Fields as unknown as FieldState[];
        fields.push({ Name: 'Name', Value: 'New', OldValue: 'Old', Dirty: true });
        await SpaceEntityServer.prototype.Save.call(target);
        assert.deepEqual(driverFor(SPACE).heard.map((h) => h.kind), ['Update']);
        assert.deepEqual(driverFor(SPACE).heard[0].oldValues, { Name: 'Old' });
    });

    it("lets the next driver hear when one throws, and names the hook, the type and the space in the log", async () => {
        drivers.clear();
        const own = driverFor(SPACE);
        own.OnSpaceChanged = () => { throw new Error('the space driver broke'); };
        const logged: string[] = [];
        const spy = mock.method(console, 'error', (...args: unknown[]) => { logged.push(args.map(String).join(' ')); });
        try {
            await SpaceEntityServer.prototype.Save.call(spaceEntity({ ParentID: PARENT }, { ParentID: OLD_PARENT }));
        } finally {
            spy.mock.restore();
        }
        assert.deepEqual(driverFor(PARENT).heard.map((h) => h.kind), ['MoveChildIn']);
        assert.deepEqual(driverFor(OLD_PARENT).heard.map((h) => h.kind), ['MoveChildOut']);
        const line = logged.find((l) => l.includes('OnSpaceChanged'));
        assert.ok(line, `the failure is logged: ${logged.join(' | ')}`);
        assert.match(line!, new RegExp(`OnSpaceChanged of space type 'test-type' failed for space ${SPACE}: the space driver broke`));
    });

    it('starts clean on the retry after a refused save', async () => {
        const target = spaceEntity({ Name: 'New' }, { Name: 'Old' });
        const stubbedValidate = target.ValidateAsync;
        (target as unknown as { ValidateAsync: () => Promise<{ Success: boolean; Errors: unknown[] }> }).ValidateAsync = async () => ({ Success: false, Errors: [] });
        drivers.clear();
        assert.equal(await SpaceEntityServer.prototype.Save.call(target), false);
        assert.deepEqual(driverFor(SPACE).heard, [], 'a refused save hears nothing');
        (target as unknown as { ValidateAsync: typeof stubbedValidate }).ValidateAsync = stubbedValidate;
        await SpaceEntityServer.prototype.Save.call(target);
        assert.deepEqual(driverFor(SPACE).heard.map((h) => h.kind), ['Update']);
    });

    it("stamps the server's clock on a close by anyone, unless staff backdate it: a date ahead of the server is the server's own time", async () => {
        const backdated = new Date(Date.now() - 24 * 3600 * 1000);
        const participant = { ID: ACTOR, Name: 'Actor', UserRoles: [{ Role: 'Space Participant' }] };
        const staff = { ID: ACTOR, Name: 'Staff', UserRoles: [{ Role: 'Developer' }] };
        for (const [who, minutes] of [[participant, -1], [participant, 24 * 60], [participant, -24 * 60]] as const) {
            const sent = new Date(Date.now() + minutes * 60_000);
            const target = spaceEntity({ ClosedAt: sent, ContextCurrentUser: who }, { ClosedAt: null });
            await saveAndHear(target);
            const stamped = (target as unknown as { ClosedAt: Date }).ClosedAt.getTime();
            assert.ok(Math.abs(stamped - Date.now()) < 5000, `sent ${minutes} minutes from now, stored ${new Date(stamped).toISOString()}`);
        }
        for (const minutes of [1, 24 * 60]) {
            const ahead = spaceEntity({ ClosedAt: new Date(Date.now() + minutes * 60_000), ContextCurrentUser: staff }, { ClosedAt: null });
            await saveAndHear(ahead);
            const stamped = (ahead as unknown as { ClosedAt: Date }).ClosedAt.getTime();
            assert.ok(Math.abs(stamped - Date.now()) < 5000, `staff sent ${minutes} minutes ahead, stored ${new Date(stamped).toISOString()}`);
        }
        const kept = spaceEntity({ ClosedAt: backdated, ContextCurrentUser: staff }, { ClosedAt: null });
        await saveAndHear(kept);
        assert.equal((kept as unknown as { ClosedAt: Date }).ClosedAt.getTime(), backdated.getTime());
    });

    it("gives a staff re-stamp of an already closed space the same rule: ahead of the server is the server's time, in the past is kept", async () => {
        const staff = { ID: ACTOR, Name: 'Staff', UserRoles: [{ Role: 'Developer' }] };
        const ahead = spaceEntity({ ClosedAt: new Date(Date.now() + 24 * 3600 * 1000), ContextCurrentUser: staff }, { ClosedAt: new Date(Date.now() - 3600 * 1000) });
        await saveAndHear(ahead);
        assert.ok(Math.abs((ahead as unknown as { ClosedAt: Date }).ClosedAt.getTime() - Date.now()) < 5000, 'a re-stamp a day ahead is stored as now');
        const backdated = new Date(Date.now() - 10 * 24 * 3600 * 1000);
        const kept = spaceEntity({ ClosedAt: backdated, ContextCurrentUser: staff }, { ClosedAt: new Date(Date.now() - 3600 * 1000) });
        await saveAndHear(kept);
        assert.equal((kept as unknown as { ClosedAt: Date }).ClosedAt.getTime(), backdated.getTime());
    });

    const itemEntity = (values: Record<string, unknown>, dirty: Record<string, unknown>, isSaved = true): SpaceItemEntityServer =>
        entity(SpaceItemEntityServer.prototype, { ID: 'item-1', SpaceID: SPACE, Band: 'Team', EntityID: 'entity-1', RecordID: 'record-1', ...values }, dirty, isSaved);

    async function itemHeard(target: SpaceItemEntityServer): Promise<Heard[]> {
        drivers.clear();
        await SpaceItemEntityServer.prototype.Save.call(target);
        return driverFor(SPACE).heard;
    }

    it("tells an item's move Move, a rename Update, and a new item filed straight into Shared Add", async () => {
        assert.deepEqual((await itemHeard(itemEntity({ SpaceID: SPACE }, { SpaceID: PARENT }))).map((h) => h.kind), ['Move']);
        const rename = await itemHeard(itemEntity({ Name: 'b' }, { Name: 'a' }));
        assert.deepEqual(rename.map((h) => h.kind), ['Update']);
        assert.deepEqual(rename[0].oldValues, { Name: 'a' });
        const shared = await itemHeard(itemEntity({ Band: 'Shared' }, { Band: null, SpaceID: null }, false));
        assert.deepEqual(shared.map((h) => h.kind), ['Add']);
    });

    const seatEntity = (values: Record<string, unknown>, dirty: Record<string, unknown>, isSaved = true): SpaceMemberEntityServer =>
        entity(SpaceMemberEntityServer.prototype, { ID: 'seat-1', UserID: 'user-1', PersonID: null, SpaceID: SPACE, Status: 'Active', SpaceRoleTypeID: 'role-1', Band: 'Team', ...values }, dirty, isSaved);

    async function seatHeard(target: SpaceMemberEntityServer): Promise<Heard[]> {
        drivers.clear();
        await SpaceMemberEntityServer.prototype.Save.call(target);
        return driverFor(SPACE).heard;
    }

    it("tells a new seat Invite whatever else is dirty (its band is derived from its role)", async () => {
        const heard = await seatHeard(seatEntity({ Band: 'Shared', SpaceRoleTypeID: 'role-1' }, { Band: null, SpaceRoleTypeID: null }, false));
        assert.deepEqual(heard.map((h) => h.kind), ['Invite']);
    });

    it("tells a seat's band change BandChange, an approval Invite, and a removal Remove", async () => {
        assert.deepEqual((await seatHeard(seatEntity({ Band: 'Shared' }, { Band: 'Team' }))).map((h) => h.kind), ['BandChange']);
        assert.deepEqual((await seatHeard(seatEntity({ Status: 'Active' }, { Status: 'Invited' }))).map((h) => h.kind), ['Invite']);
        const removed = await seatHeard(seatEntity({ Status: 'Removed' }, { Status: 'Active' }));
        assert.deepEqual(removed.map((h) => h.kind), ['Remove']);
        assert.deepEqual(removed[0].oldValues, { Status: 'Active' });
    });
});
