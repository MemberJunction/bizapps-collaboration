/**
 * Stage 4 (B19, B21, B22), the server's side of the screens: a note's promotion under the plan's call 15 (made by Ian on
 * 2026-10-13), the author-only rule beside it, a component grant run with its props bound on the server, a participant's star
 * through MJ's favorites, and the world's notes and pins as each persona reads them. The screens themselves are the walkthrough.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CompositeKey, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceNoteEntity } from '@mj-biz-apps/collaboration-entities';
import { NOTE_PROMOTED_AUDIT_LOG_TYPE } from '@mj-biz-apps/collaboration-core';
import { getSpaceComponent } from '@mj-biz-apps/collaboration-core-entities-server';
import { SPACE_ENTITY, SPACE_GRANT_ENTITY, SPACE_TYPE_ENTITY } from '../entity-names.js';
import { FindRows } from '../wire.js';
import { getPersonaContext, type PersonaIntegrationCheckContext } from '../persona-provider.js';
import { cleanupStep, deleteWhere, registerChecks } from './cleanup-helpers.js';

const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const CHAPTER_12 = 'C1000001-0000-4000-8000-000000000016';
const CHAPTER_12_STAFF = 'C1000001-0000-4000-8000-000000000019';
const SPACE_NOTES = 'MJ_BizApps_Collaboration: Space Notes';
const SPACE_PINS = 'MJ_BizApps_Collaboration: Space Member Pins';
const AUDIT_LOGS = 'MJ: Audit Logs';
const USER_FAVORITES = 'MJ: User Favorites';
const MARK = 'COLLAB-CHECK stage4';

type Persona = PersonaIntegrationCheckContext;
const asPersona = (ctx: IntegrationCheckContext, persona: Persona): IntegrationCheckContext => ({ ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext);

async function writeNote(persona: Persona, spaceId: string, title: string, band: 'Team' | 'Shared', visibility: 'Space' | 'Private' = 'Space'): Promise<mjBizAppsCollaborationSpaceNoteEntity> {
    const note = await persona.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTES, persona.User);
    note.NewRecord();
    note.SpaceID = spaceId;
    note.Title = title;
    note.Body = 'Written by the stage 4 check.';
    note.Band = band;
    note.Visibility = visibility;
    const saved = await note.Save();
    Assert(saved, `${persona.User.Email} writes "${title}": ${note.LatestResult?.CompleteMessage ?? ''}`);
    return note;
}

async function loadNoteAs(persona: Persona, id: string): Promise<mjBizAppsCollaborationSpaceNoteEntity> {
    const note = await persona.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTES, persona.User);
    Assert(await note.Load(id), `${persona.User.Email} loads note ${id}`);
    return note;
}

async function titlesAs(ctx: IntegrationCheckContext, persona: Persona, spaceId: string): Promise<string[]> {
    const rows = await FindRows<{ Title: string }>(asPersona(ctx, persona), SPACE_NOTES, `SpaceID = '${spaceId}'`, ['Title'], persona.User, { BypassCache: true });
    return rows.map((row) => row.Title).sort();
}

const checks: NamedCheck[] = [
    {
        Id: 'stage4.S1',
        Name: "S1 — call 15: a Team note is promoted to Shared by the owner (logged); a private note is not promoted; a Shared note is not taken back; a member who administers spaces (every UI user on this app) may promote too",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const sam = await getPersonaContext(ctx, 'sam');
            const casey = await getPersonaContext(ctx, 'casey');
            const ids: string[] = [];
            try {
                const written = await writeNote(sam, NORTHWIND, `${MARK} pricing (team)`, 'Team');
                ids.push(written.ID);
                Assert(!(await titlesAs(ctx, casey, NORTHWIND)).includes(written.Title), 'Casey, on the Shared band, does not read the Team note');

                // Sam's seat is a member's (it may not promote the band), but every UI user on this app administers spaces, and an
                // administrator promotes: the refusal for a member who does not administer is the pure rule's, pinned in Core's tests
                const adaPromotes = await loadNoteAs(ada, written.ID);
                adaPromotes.Band = 'Shared';
                Assert(await adaPromotes.Save(), `Ada, the owner, promotes it: ${adaPromotes.LatestResult?.CompleteMessage ?? ''}`);
                Assert((await titlesAs(ctx, casey, NORTHWIND)).includes(written.Title), 'Casey now reads it');
                const logged = await FindRows<{ ID: string; AuditLogType: string }>(ctx, AUDIT_LOGS, `RecordID = '${written.ID}'`, ['ID', 'AuditLogType'], undefined, { BypassCache: true });
                Assert(logged.some((row) => row.AuditLogType === NOTE_PROMOTED_AUDIT_LOG_TYPE), `The promotion is in the audit log as "${NOTE_PROMOTED_AUDIT_LOG_TYPE}" (${logged.map((r) => r.AuditLogType).join(', ')})`);

                // Demotion is refused for the author (by the band rule) and for the owner (who edits nothing but the band, and only upward)
                const samDemotes = await loadNoteAs(sam, written.ID);
                samDemotes.Band = 'Team';
                Assert(!(await samDemotes.Save()) && /not taken back/i.test(samDemotes.LatestResult?.CompleteMessage ?? ''), `A Shared note is not taken back to Team by its author: ${samDemotes.LatestResult?.CompleteMessage ?? ''}`);
                const adaDemotes = await loadNoteAs(ada, written.ID);
                adaDemotes.Band = 'Team';
                Assert(!(await adaDemotes.Save()), `Nor by the owner: ${adaDemotes.LatestResult?.CompleteMessage ?? ''}`);

                const secret = await writeNote(ada, NORTHWIND, `${MARK} private`, 'Team', 'Private');
                ids.push(secret.ID);
                const promotePrivate = await loadNoteAs(ada, secret.ID);
                promotePrivate.Band = 'Shared';
                Assert(!(await promotePrivate.Save()) && /private/i.test(promotePrivate.LatestResult?.CompleteMessage ?? ''), `A private note is not promoted: ${promotePrivate.LatestResult?.CompleteMessage ?? ''}`);

                const samsOwn = await writeNote(sam, NORTHWIND, `${MARK} sam promotes as an administrator`, 'Team');
                ids.push(samsOwn.ID);
                const samPromotes = await loadNoteAs(sam, samsOwn.ID);
                samPromotes.Band = 'Shared';
                Assert(await samPromotes.Save(), `Sam, who administers spaces, promotes his note: ${samPromotes.LatestResult?.CompleteMessage ?? ''}`);
                Assert((await titlesAs(ctx, casey, NORTHWIND)).includes(samsOwn.Title), 'Casey reads it');
            } finally {
                if (ids.length) {
                    await deleteWhere(ctx.Provider, ctx.User, AUDIT_LOGS, `RecordID IN (${ids.map((id) => `'${id}'`).join(',')})`, 'the promotion log rows');
                    await deleteWhere(ctx.Provider, ctx.User, SPACE_NOTES, `ID IN (${ids.map((id) => `'${id}'`).join(',')})`, 'the stage 4 notes');
                }
            }
        },
    },
    {
        Id: 'stage4.S2',
        Name: 'S2 — beside the promotion, only the author edits: the owner cannot retitle a member\'s note, and a promotion that changes anything else is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const sam = await getPersonaContext(ctx, 'sam');
            let id: string | null = null;
            try {
                const written = await writeNote(sam, NORTHWIND, `${MARK} author-only`, 'Team');
                id = written.ID;
                const retitle = await loadNoteAs(ada, id);
                retitle.Title = `${MARK} retitled by the owner`;
                Assert(!(await retitle.Save()) && /only the author/i.test(retitle.LatestResult?.CompleteMessage ?? ''), `The owner cannot retitle it: ${retitle.LatestResult?.CompleteMessage ?? ''}`);
                const both = await loadNoteAs(ada, id);
                both.Band = 'Shared';
                both.Body = 'changed along the way';
                Assert(!(await both.Save()) && /changes nothing else/i.test(both.LatestResult?.CompleteMessage ?? ''), `A promotion with another change is refused: ${both.LatestResult?.CompleteMessage ?? ''}`);
                const mine = await loadNoteAs(sam, id);
                mine.Title = `${MARK} author-only, edited`;
                Assert(await mine.Save(), `The author edits his note: ${mine.LatestResult?.CompleteMessage ?? ''}`);
            } finally {
                if (id) await deleteWhere(ctx.Provider, ctx.User, SPACE_NOTES, `ID = '${id}'`, 'the stage 4 note');
            }
        },
    },
    {
        Id: 'stage4.S3',
        Name: 'S3 — GetSpaceComponent (B19): national staff get the chapter banner with its props bound from the anchor; a value for a bound name is refused; a leader who does not reach the staff space is refused; every run is logged',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await getPersonaContext(ctx, 'nico');
            const marco = await getPersonaContext(ctx, 'marco');
            const [type] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'example-chapter-staff'", ['ID']);
            const [grant] = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, `SpaceTypeID = '${type.ID}' AND Kind = 'Component'`, ['ID']);
            Assert(!!grant, 'The staff type grants the chapter banner component (metadata-tests/components)');
            const before = (await FindRows<{ ID: string }>(ctx, AUDIT_LOGS, `RecordID = '${grant.ID}'`, ['ID'])).length;
            try {
                const ran = await getSpaceComponent({ provider: ctx.Provider, user: nico.User, spaceId: CHAPTER_12_STAFF, grantId: grant.ID });
                Assert(ran.ok === true, `Nico gets the component: ${ran.ok ? '' : ran.message}`);
                if (ran.ok) {
                    Assert(ran.name === 'Example: Chapter Banner' && ran.specification.includes('ExampleChapterBanner'), `The specification comes with it (${ran.name})`);
                    Assert(ran.props.chapterName === 'Chapter 12' && ran.props.region === 'West', `The props are bound from the chapter anchor: ${JSON.stringify(ran.props)}`);
                }
                const bound = await getSpaceComponent({ provider: ctx.Provider, user: nico.User, spaceId: CHAPTER_12_STAFF, grantId: grant.ID, clientValues: { chapterName: 'Chapter 40' } });
                Assert(bound.ok === false && /bound by the grant/.test(bound.ok ? '' : bound.message), `A value for chapterName is refused: ${bound.ok ? '' : bound.message}`);
                const refused = await getSpaceComponent({ provider: ctx.Provider, user: marco.User, spaceId: CHAPTER_12_STAFF, grantId: grant.ID });
                Assert(refused.ok === false && /do not reach/.test(refused.ok ? '' : refused.message), `Marco is refused: ${refused.ok ? '' : refused.message}`);
                const after = (await FindRows<{ ID: string }>(ctx, AUDIT_LOGS, `RecordID = '${grant.ID}'`, ['ID'], undefined, { BypassCache: true })).length;
                Assert(after >= before + 2, `The run and the refused value are logged (${after - before} new rows)`);
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, AUDIT_LOGS, `RecordID = '${grant.ID}'`, 'the component run log rows'));
            }
        },
    },
    {
        Id: 'stage4.S4',
        Name: "S4 — the star (B22): a participant stars a space through MJ's favorites, reads her own star and nobody else's",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const lena = await getPersonaContext(ctx, 'lena');
            const nico = await getPersonaContext(ctx, 'nico');
            const key = CompositeKey.FromID(CHAPTER_12);
            const favorites = ctx.Provider as unknown as {
                SetRecordFavoriteStatus(userId: string, entityName: string, key: CompositeKey, isFavorite: boolean, contextUser: UserInfo): Promise<void>;
                GetRecordFavoriteStatus(userId: string, entityName: string, key: CompositeKey, contextUser?: UserInfo): Promise<boolean>;
            };
            try {
                await favorites.SetRecordFavoriteStatus(lena.User.ID, SPACE_ENTITY, key, true, lena.User);
                await favorites.SetRecordFavoriteStatus(nico.User.ID, SPACE_ENTITY, key, true, nico.User);
                Assert(await favorites.GetRecordFavoriteStatus(lena.User.ID, SPACE_ENTITY, key, lena.User), 'Lena reads her star');
                const lenaSees = await FindRows<{ UserID: string }>(asPersona(ctx, lena), USER_FAVORITES, `RecordID = '${CHAPTER_12}'`, ['UserID'], lena.User, { BypassCache: true });
                Assert(lenaSees.length === 1 && lenaSees[0].UserID.toLowerCase() === lena.User.ID.toLowerCase(), `Lena reads only her own favorite row (${lenaSees.length})`);
                await favorites.SetRecordFavoriteStatus(lena.User.ID, SPACE_ENTITY, key, false, lena.User);
                Assert(!(await favorites.GetRecordFavoriteStatus(lena.User.ID, SPACE_ENTITY, key, lena.User)), 'Unstarred, it is gone');
            } finally {
                await cleanupStep(() => favorites.SetRecordFavoriteStatus(lena.User.ID, SPACE_ENTITY, key, false, lena.User));
                await cleanupStep(() => favorites.SetRecordFavoriteStatus(nico.User.ID, SPACE_ENTITY, key, false, nico.User));
            }
        },
    },
    {
        Id: 'stage4.S5',
        Name: "S5 — the world's notes and pins, as each persona reads them: Casey the Shared note only, Sam the Team one too, Ada her private one as well; pins are their owner's alone",
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const [ada, sam, casey, nico] = await Promise.all(['ada', 'sam', 'casey', 'nico'].map((key) => getPersonaContext(ctx, key)));
            Assert(JSON.stringify(await titlesAs(ctx, casey, NORTHWIND)) === JSON.stringify(['Kickoff recap']), `Casey reads the Shared note only: ${(await titlesAs(ctx, casey, NORTHWIND)).join(' | ')}`);
            Assert(JSON.stringify(await titlesAs(ctx, sam, NORTHWIND)) === JSON.stringify(['Kickoff recap', 'Pricing thoughts (internal)']), `Sam reads Shared and Team, not Ada's private note: ${(await titlesAs(ctx, sam, NORTHWIND)).join(' | ')}`);
            Assert((await titlesAs(ctx, ada, NORTHWIND)).length === 3, `Ada reads all three (${(await titlesAs(ctx, ada, NORTHWIND)).length})`);
            Assert(JSON.stringify(await titlesAs(ctx, nico, CHAPTER_12_STAFF)) === JSON.stringify(['Renewal push plan']), 'Nico reads the staff space\'s note');
            const adaPins = await FindRows<{ ID: string }>(asPersona(ctx, ada), SPACE_PINS, `SpaceID = '${NORTHWIND}'`, ['ID'], ada.User, { BypassCache: true });
            Assert(adaPins.length === 2, `Ada has her two pins on Northwind (${adaPins.length})`);
            const samSees = await FindRows<{ ID: string }>(asPersona(ctx, sam), SPACE_PINS, `SpaceID = '${NORTHWIND}'`, ['ID'], sam.User, { BypassCache: true });
            Assert(samSees.length === 0, `Sam reads none of them (${samSees.length})`);
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage4', {
    Setup: async () => {},
    Teardown: async () => {},
});
