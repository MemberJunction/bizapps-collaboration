import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { EntitySaveOptions, WellKnownUserSource, type UserInfo } from '@memberjunction/core';
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
    private readonly verdict: DriverValidationResult;
    constructor(verdict: DriverValidationResult = { ok: true }) {
        super();
        this.verdict = verdict;
    }
    public override ValidateSpaceChange(ctx: SpaceChangeContext): DriverValidationResult {
        this.asked.push(ctx);
        return this.verdict;
    }
}

/** A saved space with its subtype attached, whose own fields are as told. */
function savedSpace(opts: { spaceDirty?: boolean; leafFields?: Array<{ Name: string; Dirty: boolean; OldValue: unknown }> }) {
    const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
    const history: Array<{ Message?: string; Type?: string }> = [];
    const leaf = { Fields: opts.leafFields ?? [{ Name: 'TermName', Dirty: true, OldValue: 'Original' }] };
    Object.defineProperties(space, {
        ContextCurrentUser: { value: { ID: ACTOR, Name: 'Actor', UserRoles: [] }, writable: true },
        IsSaved: { value: true, writable: true },
        ID: { value: SPACE, writable: true },
        ParentID: { value: null, writable: true },
        ClosedAt: { value: null, writable: true },
        ProviderToUse: { value: {}, writable: true },
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
        heldSystem = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
    });
    after(() => {
        CollaborationEngine.Instance.UserCanConfigureSpaces = heldConfigure;
        ServerDriverRegistry.Instance.ResolveSpaceAndType = heldResolve;
        WellKnownUserSource.Instance.GetSystemUser = heldSystem;
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

    it("is judged by the type's driver as an Update, told the subtype and what its columns held, and its refusal comes back", async () => {
        configure = true;
        const driver = new SpyDriver({ ok: false, message: 'A board keeps its term while a vote is open.' });
        drivers.set(SPACE.toLowerCase(), driver);
        const { space, history } = savedSpace({ leafFields: [{ Name: 'TermName', Dirty: true, OldValue: 'Original' }, { Name: 'Quorum', Dirty: false, OldValue: 50 }, { Name: '__mj_UpdatedAt', Dirty: true, OldValue: 'x' }] });
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), false);
        assert.equal(driver.asked.length, 1);
        assert.equal(driver.asked[0].kind, 'Update');
        assert.equal(driver.asked[0].subtypeEntityName, BOARDS);
        assert.deepEqual(driver.asked[0].oldValues, { TermName: 'Original' });
        assert.match(history[0]?.Message ?? '', /keeps its term while a vote is open/);
    });

    it('is refused when the type has no driver registered, closed', async () => {
        configure = true;
        drivers.delete(SPACE.toLowerCase());
        const { space, history } = savedSpace({});
        assert.equal(await SpaceEntityServer.prototype.Save.call(space, asSubtype(BOARDS)), false);
        assert.match(history[0]?.Message ?? '', /No driver/);
    });

    it("is left to the space's own validation when the space itself changed, and to nothing here for a plain save", async () => {
        configureAsked = 0;
        drivers.set(SPACE.toLowerCase(), new SpyDriver());
        // The space changed: MJ validates it, so this path does not; the save then goes on to MJ, which this stub does not have
        await assert.rejects(SpaceEntityServer.prototype.Save.call(savedSpace({ spaceDirty: true }).space, asSubtype(BOARDS)));
        // A plain space's save carries no subtype name
        await assert.rejects(SpaceEntityServer.prototype.Save.call(savedSpace({}).space, asSubtype(null)));
        assert.equal(configureAsked, 0);
    });
});
