import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { BaseEntity, EntitySaveOptions, WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { BaseSpaceTypeServerDriver, type DriverValidationResult, type SpaceChangeContext } from '../dist/base-space-type-server-driver.js';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import { SpaceEntityServer } from '../dist/SpaceEntityServer.js';

/** Save options as MJ hands a parent's save: naming the subtype that started it. */
function asSubtype(name: string | null): EntitySaveOptions {
    const options = new EntitySaveOptions();
    if (name) options.ISAActiveChildEntityName = name;
    return options;
}

const SPACE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';
const ACTOR = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE9';
const BOARDS = 'Example Boards';

class SpyDriver extends BaseSpaceTypeServerDriver {
    public asked: SpaceChangeContext[] = [];
    public told: SpaceChangeContext[] = [];
    private readonly verdict: DriverValidationResult;
    constructor(verdict: DriverValidationResult = { ok: true }) {
        super();
        this.verdict = verdict;
    }
    public override OnSpaceChanged(ctx: SpaceChangeContext): void {
        this.told.push(ctx);
    }
    public override ValidateSpaceChange(ctx: SpaceChangeContext): DriverValidationResult {
        this.asked.push(ctx);
        return this.verdict;
    }
}

/** A saved space with its subtype attached, whose own fields are as told. */
function savedSpace(opts: { spaceDirty?: boolean; parentId?: string | null; user?: object | null; leafFields?: Array<{ Name: string; Dirty: boolean; OldValue: unknown }> }) {
    const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
    const history: Array<{ Message?: string; Type?: string }> = [];
    const leaf = { Fields: opts.leafFields ?? [{ Name: 'TermName', Dirty: true, OldValue: 'Original' }] };
    Object.defineProperties(space, {
        ContextCurrentUser: { value: opts.user === undefined ? { ID: ACTOR, Name: 'Actor', UserRoles: [] } : opts.user, writable: true },
        SpaceTypeID: { value: 'type-1', writable: true },
        IsSaved: { value: true, writable: true },
        ID: { value: SPACE, writable: true },
        ParentID: { value: opts.parentId ?? null, writable: true },
        ClosedAt: { value: null, writable: true },
        ProviderToUse: { value: {}, writable: true },
        // The subtype is in reach whichever side the save started from: loaded through the space, or linked back to the space its own save made
        LeafEntity: { value: leaf, writable: true },
        Fields: { value: [{ Name: 'Name', Dirty: !!opts.spaceDirty, OldValue: 'x' }, { Name: 'OwnerID', Dirty: false }], writable: true },
        RegisterResultHistoryEntry: { value: (entry: { Message?: string; Type?: string }) => history.push(entry), writable: true },
    });
    return { space, history };
}

describe("a change to only a subtype's own columns", () => {
    let configure = true;
    let configureAsked = 0;
    const drivers = new Map<string, SpyDriver>();
    let heldConfigure: typeof CollaborationEngine.Instance.UserCanConfigureSpaces;
    let heldResolve: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    let heldSystem: typeof WellKnownUserSource.Instance.GetSystemUser;
    let heldSave: typeof BaseEntity.prototype.Save;
    let heldResolveType: typeof ServerDriverRegistry.Instance.ResolveType;
    let heldGetDriver: typeof ServerDriverRegistry.Instance.GetDriverForType;

    before(() => {
        heldConfigure = CollaborationEngine.Instance.UserCanConfigureSpaces.bind(CollaborationEngine.Instance);
        CollaborationEngine.Instance.UserCanConfigureSpaces = async () => { configureAsked += 1; return configure; };
        heldResolve = ServerDriverRegistry.Instance.ResolveSpaceAndType.bind(ServerDriverRegistry.Instance);
        ServerDriverRegistry.Instance.ResolveSpaceAndType = (async (spaceId: string) => {
            const driver = drivers.get(spaceId.toLowerCase());
            if (!driver) throw new Error(`No driver for ${spaceId}.`);
            return {
                driver,
                space: {} as mjBizAppsCollaborationSpaceEntity,
                spaceType: { SpaceExtensionEntity: BOARDS } as mjBizAppsCollaborationSpaceTypeEntity,
            };
        }) as unknown as typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
        // MJ's own save, which the space's `Save` ends in: it succeeds, and the driver is looked up as a reaction does
        heldSave = BaseEntity.prototype.Save;
        BaseEntity.prototype.Save = async function () { return true; } as typeof BaseEntity.prototype.Save;
        heldResolveType = ServerDriverRegistry.Instance.ResolveType.bind(ServerDriverRegistry.Instance);
        ServerDriverRegistry.Instance.ResolveType = (async () => ({ Code: 'test-type', SpaceExtensionEntity: BOARDS })) as unknown as typeof ServerDriverRegistry.Instance.ResolveType;
        heldGetDriver = ServerDriverRegistry.Instance.GetDriverForType.bind(ServerDriverRegistry.Instance);
        ServerDriverRegistry.Instance.GetDriverForType = (() => drivers.get(SPACE.toLowerCase())) as unknown as typeof ServerDriverRegistry.Instance.GetDriverForType;
        heldSystem = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
    });
    after(() => {
        CollaborationEngine.Instance.UserCanConfigureSpaces = heldConfigure;
        ServerDriverRegistry.Instance.ResolveSpaceAndType = heldResolve;
        WellKnownUserSource.Instance.GetSystemUser = heldSystem;
        BaseEntity.prototype.Save = heldSave;
        ServerDriverRegistry.Instance.ResolveType = heldResolveType;
        ServerDriverRegistry.Instance.GetDriverForType = heldGetDriver;
    });

    it('is refused for someone without Configure Spaces and an owner seat, before the space is saved', async () => {
        configure = false;
        configureAsked = 0;
        drivers.set(SPACE.toLowerCase(), new SpyDriver());
        const { space, history } = savedSpace({});
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), false);
        assert.equal(configureAsked, 1);
        assert.match(history[0]?.Message ?? '', /needs the 'Configure Spaces' authorization and an owner seat/);
        assert.equal(history[0]?.Type, 'update');
    });

    it("is judged by the type's driver as an Update, on the space being saved (whose LeafEntity holds the new values), told the subtype and what its columns held, and its refusal comes back", async () => {
        configure = true;
        const driver = new SpyDriver({ ok: false, message: 'A board keeps its term while a vote is open.' });
        drivers.set(SPACE.toLowerCase(), driver);
        const { space, history } = savedSpace({ leafFields: [{ Name: 'TermName', Dirty: true, OldValue: 'Original' }, { Name: 'Quorum', Dirty: false, OldValue: 50 }, { Name: '__mj_UpdatedAt', Dirty: true, OldValue: 'x' }] });
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), false);
        assert.equal(driver.asked.length, 1);
        assert.equal(driver.asked[0].kind, 'Update');
        assert.equal(driver.asked[0].subtypeEntityName, BOARDS);
        assert.deepEqual(driver.asked[0].oldValues, { TermName: 'Original' });
        assert.equal(driver.asked[0].space, space, 'the driver judges the space being saved, not a stored copy');
        assert.match(history[0]?.Message ?? '', /keeps its term while a vote is open/);
    });

    it('is refused when the type has no driver registered, closed', async () => {
        configure = true;
        drivers.delete(SPACE.toLowerCase());
        const { space, history } = savedSpace({});
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), false);
        assert.match(history[0]?.Message ?? '', /No driver/);
    });

    it('is judged and heard once: after the save the space\'s driver is told an Update with the columns\' old values, and no parent hears a child change', async () => {
        configure = true;
        const driver = new SpyDriver();
        drivers.set(SPACE.toLowerCase(), driver);
        const { space } = savedSpace({ leafFields: [{ Name: 'TermName', Dirty: true, OldValue: 'Original' }] });
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), true);
        assert.equal(driver.asked.length, 1);
        assert.equal(driver.told.length, 1);
        assert.equal(driver.told[0].kind, 'Update');
        assert.equal(driver.told[0].subtypeEntityName, BOARDS);
        assert.deepEqual(driver.told[0].oldValues, { TermName: 'Original' });
    });

    it("is refused when the space can't see the subtype that is saving it: a change nobody could judge doesn't pass, and neither the right nor the driver is asked", async () => {
        configure = true;
        configureAsked = 0;
        const driver = new SpyDriver();
        drivers.set(SPACE.toLowerCase(), driver);
        const { space, history } = savedSpace({});
        // MJ links a space to the subtype that saves it. Without the link, `LeafEntity` is the space itself.
        Object.defineProperty(space, 'LeafEntity', { value: space, writable: true });
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), false);
        assert.match(history[0]?.Message ?? '', /can't see the subtype that is saving it/);
        assert.equal(driver.asked.length, 0);
        assert.equal(driver.told.length, 0);
        assert.equal(configureAsked, 0);
        // A plain save, which no subtype started, is not held to it
        assert.equal(await SpaceEntityServer.prototype.Save.call(savedSpace({}).space, asSubtype(null)), true);
    });

    it("is told to the space's own driver only: a parent's driver hears no child change, and is not asked", async () => {
        configure = true;
        const PARENT = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE3';
        const own = new SpyDriver();
        const parent = new SpyDriver();
        drivers.set(SPACE.toLowerCase(), own);
        drivers.set(PARENT.toLowerCase(), parent);
        const heldResolve = ServerDriverRegistry.Instance.ResolveSpaceAndType;
        const childCalls: string[] = [];
        parent.OnChildSpaceChanged = () => { childCalls.push('told'); };
        parent.ValidateChildSpaceChange = () => { childCalls.push('asked'); return { ok: true }; };
        try {
            const { space } = savedSpace({ parentId: PARENT });
            assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), true);
            assert.equal(own.told.length, 1);
            assert.deepEqual(childCalls, []);
        } finally {
            ServerDriverRegistry.Instance.ResolveSpaceAndType = heldResolve;
        }
    });

    it('is refused without a signed-in user, before the space is saved', async () => {
        configureAsked = 0;
        const driver = new SpyDriver();
        drivers.set(SPACE.toLowerCase(), driver);
        const { space, history } = savedSpace({ user: null });
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), false);
        assert.match(history[0]?.Message ?? '', /there is no signed-in user/);
        assert.equal(driver.told.length, 0);
        assert.equal(configureAsked, 0);
    });

    it('is nothing to judge when the save changes nothing: MJ saves the parent whether or not the subtype is dirty, and nobody is asked or told', async () => {
        configure = false;
        configureAsked = 0;
        const driver = new SpyDriver({ ok: false, message: 'Would refuse.' });
        drivers.set(SPACE.toLowerCase(), driver);
        const { space } = savedSpace({ leafFields: [{ Name: 'TermName', Dirty: false, OldValue: 'Original' }, { Name: '__mj_UpdatedAt', Dirty: true, OldValue: 'x' }] });
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), true);
        assert.equal(configureAsked, 0);
        assert.equal(driver.asked.length, 0);
        assert.equal(driver.told.length, 0);
    });

    it("is left to the space's own validation when the space itself changed, and to nothing here for a plain save", async () => {
        configure = false;
        configureAsked = 0;
        const driver = new SpyDriver();
        drivers.set(SPACE.toLowerCase(), driver);
        // The space changed: MJ validates it, so this path does not ask; a plain save carries no subtype name
        assert.equal(await SpaceEntityServer.prototype.Save.call(savedSpace({ spaceDirty: true }).space, asSubtype(BOARDS)), true);
        assert.equal(await SpaceEntityServer.prototype.Save.call(savedSpace({}).space, asSubtype(null)), true);
        assert.equal(configureAsked, 0);
        assert.equal(driver.asked.length, 0);
    });
});
