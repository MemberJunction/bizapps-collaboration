import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { mjBizAppsCollaborationSpaceEntity, SpaceSubtypeDirectory, SpaceSubtypeResolver } from '@mj-biz-apps/collaboration-entities';

const TYPE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';

/** A space of a type, whose provider answers a read of the type as told and counts its reads. */
function spaceOfType(typeId: string | null, answer?: { Success: boolean; Results?: Array<{ SpaceExtensionEntity: string | null }>; ErrorMessage?: string }) {
    const reads: number[] = [];
    const space = Object.create(mjBizAppsCollaborationSpaceEntity.prototype) as mjBizAppsCollaborationSpaceEntity;
    Object.defineProperties(space, {
        SpaceTypeID: { value: typeId },
        ContextCurrentUser: { value: { ID: 'u1' } },
        RunViewProviderToUse: { value: { RunView: async () => { reads.push(1); return answer ?? { Success: true, Results: [] }; } } },
    });
    return { space, reads };
}

describe("a space's subtype, from its type", () => {
    const resolver = new SpaceSubtypeResolver();
    afterEach(() => SpaceSubtypeDirectory.Instance.Replace([]));

    it('is the one directory however often the package is loaded: the engine fills it and the resolver reads it', () => {
        assert.equal(SpaceSubtypeDirectory.Instance, SpaceSubtypeDirectory.Instance);
        SpaceSubtypeDirectory.Instance.Replace([{ ID: TYPE, SpaceExtensionEntity: '  Example Boards ' }, { ID: 'other', SpaceExtensionEntity: null }]);
        assert.equal(SpaceSubtypeDirectory.Instance.Get(TYPE.toLowerCase()), 'Example Boards');
        assert.equal(SpaceSubtypeDirectory.Instance.Get('other'), null);
        assert.equal(SpaceSubtypeDirectory.Instance.Get('never-loaded'), undefined);
        assert.equal(SpaceSubtypeDirectory.Instance.Get(null), undefined);
    });

    it('answers a new space from the directory, without reading', async () => {
        SpaceSubtypeDirectory.Instance.Replace([{ ID: TYPE, SpaceExtensionEntity: 'Example Boards' }]);
        const { space, reads } = spaceOfType(TYPE);
        assert.equal(await resolver.Resolve(space), 'Example Boards');
        assert.equal(reads.length, 0);
    });

    it("reads the type when the directory isn't filled, since that answer has to be right, and answers none for a plain type", async () => {
        const named = spaceOfType(TYPE, { Success: true, Results: [{ SpaceExtensionEntity: ' Example Rooms ' }] });
        assert.equal(await resolver.Resolve(named.space), 'Example Rooms');
        assert.equal(named.reads.length, 1);
        const plain = spaceOfType(TYPE, { Success: true, Results: [{ SpaceExtensionEntity: null }] });
        assert.equal(await resolver.Resolve(plain.space), null);
    });

    it('says why when the type cannot be read, and answers none for a space with no type or a record that is not a space', async () => {
        await assert.rejects(resolver.Resolve(spaceOfType(TYPE, { Success: false, ErrorMessage: 'no access' }).space), /could not be read: no access/);
        assert.equal(await resolver.Resolve(spaceOfType(null).space), null);
        assert.equal(await resolver.Resolve({} as never), null);
    });

    it('hints a loaded space from the directory only, never reading, and gives no hint until the directory is filled', () => {
        const { space, reads } = spaceOfType(TYPE);
        assert.equal(resolver.ResolveLoadHint(space), null);
        SpaceSubtypeDirectory.Instance.Replace([{ ID: TYPE, SpaceExtensionEntity: 'Example Boards' }]);
        assert.equal(resolver.ResolveLoadHint(space), 'Example Boards');
        assert.equal(reads.length, 0);
    });
});
