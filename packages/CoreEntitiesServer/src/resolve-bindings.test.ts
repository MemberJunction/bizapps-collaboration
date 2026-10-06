import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EntityInfo, IMetadataProvider, RunViewParams, RunViewResult, UserInfo } from '@memberjunction/core';
import { DEFAULT_COLLABORATION_SETTINGS, type EffectiveGrant, ResolveSpaceConfiguration } from '@mj-biz-apps/collaboration-core';
import { resolveBindings } from '../dist/resolve-bindings.js';

const SPACE = 'AAAAAAAA-0000-4000-8000-000000000001';
const CHAPTER_ENTITY = 'EEEEEEEE-0000-4000-8000-000000000001';
const CHAPTER_12 = 'CCCCCCCC-0000-4000-8000-000000000012';
const CALLER = { ID: 'DDDDDDDD-0000-4000-8000-000000000001', Email: 'lena@example.test' } as UserInfo;

interface World {
    anchors?: Array<{ ID: string; EntityID: string; RecordID: string; Role: string }>;
    chapterRow?: Record<string, unknown> | null;
    person?: { ID: string } | null;
    spaceRow?: Record<string, unknown>;
}

function providerOver(world: World): IMetadataProvider {
    const ok = <T>(rows: object[]): RunViewResult<T> => ({ Success: true, Results: rows as unknown as T[], RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0, ErrorMessage: '' });
    const provider = {
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            switch (params.EntityName) {
                case 'MJ_BizApps_Collaboration: Space Anchors': return ok(world.anchors ?? []);
                case 'MJ_BizApps_Collaboration: Spaces': return ok([world.spaceRow ?? { ID: SPACE, Name: 'Chapter 12', PlannedCloseAt: null, ParentID: null, SpaceTypeID: 'T' }]);
                case 'MJ_BizApps_Common: People': return ok(world.person === null ? [] : [world.person ?? { ID: 'P-LENA' }]);
                case 'Example Chapters': return ok(world.chapterRow === null ? [] : [world.chapterRow ?? { Region: 'West', Name: 'Chapter 12' }]);
                default: return ok([]);
            }
        },
        EntityByID(id: string): EntityInfo | null {
            if (id !== CHAPTER_ENTITY) return null;
            return { ID: CHAPTER_ENTITY, Name: 'Example Chapters', PrimaryKeys: [{ Name: 'ID' }], Fields: [{ Name: 'ID' }, { Name: 'Name' }, { Name: 'Region' }] } as unknown as EntityInfo;
        },
    } as unknown as IMetadataProvider;
    return provider;
}

const configuration = ResolveSpaceConfiguration({
    App: { Settings: { ...DEFAULT_COLLABORATION_SETTINGS, Extensions: { 'example-chapter': { Region: 'National' } } }, Grants: [] },
    Type: null,
    Spaces: [{ ID: SPACE, TypeID: null, Settings: null, Grants: [] }],
});

const grant = (bindings: EffectiveGrant['Bindings']): Pick<EffectiveGrant, 'GrantID' | 'Bindings'> => ({ GrantID: 'G1', Bindings: bindings });
const anchored: World = { anchors: [{ ID: 'A1', EntityID: CHAPTER_ENTITY, RecordID: `ID|${CHAPTER_12}`, Role: 'chapter' }] };

describe('resolveBindings', () => {
    it('resolves every source: the anchor (its key value, not the ID| spelling), a field of the anchored record, the space, the settings, the caller and a literal; the log names sources, never values', async () => {
        const outcome = await resolveBindings(providerOver(anchored), CALLER, SPACE, grant({
            ChapterID: { From: 'Anchor:chapter' },
            Region: { From: 'Anchor:Chapter.Region' },
            SpaceName: { From: 'Space.Name' },
            Scope: { From: 'Config:Extensions.example-chapter.Region' },
            Who: { From: 'User.ID' },
            Mail: { From: 'User.Email' },
            Person: { From: 'User.PersonID' },
            Months: { Value: 12 },
        }), configuration);
        assert.equal(outcome.ok, true);
        if (outcome.ok) {
            assert.deepEqual(outcome.values, { ChapterID: CHAPTER_12, Region: 'West', SpaceName: 'Chapter 12', Scope: 'National', Who: CALLER.ID, Mail: 'lena@example.test', Person: 'P-LENA', Months: 12 });
            assert.deepEqual(outcome.sources, { ChapterID: 'Anchor:chapter', Region: 'Anchor:Chapter.Region', SpaceName: 'Space.Name', Scope: 'Config:Extensions.example-chapter.Region', Who: 'User.ID', Mail: 'User.Email', Person: 'User.PersonID', Months: 'Value' });
        }
    });

    it('a grant with no bindings resolves to nothing, and reads nothing', async () => {
        const outcome = await resolveBindings(providerOver({}), CALLER, SPACE, grant({}), configuration);
        assert.deepEqual(outcome, { ok: true, values: {}, sources: {} });
    });

    it('refuses when the anchor role is missing, or held twice', async () => {
        const missing = await resolveBindings(providerOver({ anchors: [] }), CALLER, SPACE, grant({ ChapterID: { From: 'Anchor:chapter' } }), configuration);
        assert.equal(missing.ok, false);
        if (!missing.ok) assert.match(missing.message, /no anchor with the role "chapter"/);
        const twice = await resolveBindings(providerOver({ anchors: [...anchored.anchors!, { ID: 'A2', EntityID: CHAPTER_ENTITY, RecordID: 'other', Role: 'chapter' }] }), CALLER, SPACE, grant({ ChapterID: { From: 'Anchor:chapter' } }), configuration);
        assert.equal(twice.ok, false);
        if (!twice.ok) assert.match(twice.message, /2 anchors with the role "chapter"/);
    });

    it('refuses a field the anchored entity lacks, an anchored record that is gone, a settings path with no value, and a caller with no Person', async () => {
        const noField = await resolveBindings(providerOver(anchored), CALLER, SPACE, grant({ X: { From: 'Anchor:chapter.Budget' } }), configuration);
        assert.equal(noField.ok, false);
        if (!noField.ok) assert.match(noField.message, /has no field named Budget/);
        const gone = await resolveBindings(providerOver({ ...anchored, chapterRow: null }), CALLER, SPACE, grant({ X: { From: 'Anchor:chapter.Region' } }), configuration);
        assert.equal(gone.ok, false);
        if (!gone.ok) assert.match(gone.message, /no longer exists/);
        const noSetting = await resolveBindings(providerOver(anchored), CALLER, SPACE, grant({ X: { From: 'Config:Chats.Nothing' } }), configuration);
        assert.equal(noSetting.ok, false);
        if (!noSetting.ok) assert.match(noSetting.message, /no value at Chats.Nothing/);
        const noPerson = await resolveBindings(providerOver({ person: null }), CALLER, SPACE, grant({ X: { From: 'User.PersonID' } }), configuration);
        assert.equal(noPerson.ok, false);
        if (!noPerson.ok) assert.match(noPerson.message, /no linked Person/);
    });

    it('refuses an expression it cannot read, before reading anything', async () => {
        const outcome = await resolveBindings(providerOver({}), CALLER, SPACE, grant({ X: { From: 'Space.Configuration' as never } }), configuration);
        assert.equal(outcome.ok, false);
        if (!outcome.ok) assert.match(outcome.message, /may read a space's/);
    });
});
