/**
 * Stage 4 over the wire: a note's promotion as the browser saves it (an entity save through MJAPI), *Turn into document*
 * through the upload path, and the component grant through `GetSpaceComponent`, as the Data tab calls it.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient, type mjBizAppsCollaborationSpaceNoteEntity } from '@mj-biz-apps/collaboration-entities';
import { noteDocument } from '@mj-biz-apps/collaboration-core';
import { FILE_ENTITY, SPACE_GRANT_ENTITY, SPACE_ITEM_ENTITY, SPACE_TYPE_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext } from '../../wire.js';
import { cleanupStep, deleteWhere, registerChecks } from '../cleanup-helpers.js';

const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const CHAPTER_12_STAFF = 'C1000001-0000-4000-8000-000000000019';
const SPACE_NOTES = 'MJ_BizApps_Collaboration: Space Notes';
const AUDIT_LOGS = 'MJ: Audit Logs';
const MARK = 'COLLAB-CHECK stage4 wire';
type ClientPersona = Awaited<ReturnType<typeof getPersonaClientContext>>;
const asPersona = (ctx: IntegrationCheckContext, persona: ClientPersona): IntegrationCheckContext => ({ ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext);
const clientOf = (persona: ClientPersona): CollaborationClient => new CollaborationClient(persona.GraphQLProvider);

const checks: NamedCheck[] = [
    {
        Id: 'stage4.SC1',
        Name: 'SC1 — over the wire (call 15): Sam writes a Team note, Ada promotes it with an entity save as the browser does, Casey then reads it',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const sam = await getPersonaClientContext(ctx, 'sam');
            const casey = await getPersonaClientContext(ctx, 'casey');
            let id: string | null = null;
            try {
                const note = await sam.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTES, sam.User);
                note.NewRecord();
                note.SpaceID = NORTHWIND;
                // The browser stamps the author too: MJ's required-field check runs on the client before the server's stamp
                note.AuthorUserID = sam.User.ID;
                note.Title = `${MARK} team note`;
                note.Body = 'Hold the uplift.';
                note.Band = 'Team';
                note.Visibility = 'Space';
                Assert(await note.Save(), `Sam writes a Team note over the wire: ${note.LatestResult?.CompleteMessage ?? ''}`);
                id = note.ID;
                const caseyBefore = await FindRows<{ ID: string }>(asPersona(ctx, casey), SPACE_NOTES, `ID = '${id}'`, ['ID'], casey.User, { BypassCache: true });
                Assert(caseyBefore.length === 0, 'Casey does not read the Team note');

                const adaPromotes = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTES, ada.User);
                Assert(await adaPromotes.Load(id), 'Ada loads the note');
                adaPromotes.Band = 'Shared';
                Assert(await adaPromotes.Save(), `Ada promotes it over the wire: ${adaPromotes.LatestResult?.CompleteMessage ?? ''}`);
                const caseyAfter = await FindRows<{ Band: string }>(asPersona(ctx, casey), SPACE_NOTES, `ID = '${id}'`, ['Band'], casey.User, { BypassCache: true });
                Assert(caseyAfter.length === 1 && caseyAfter[0].Band === 'Shared', 'Casey reads it once it is Shared');
            } finally {
                if (id) {
                    await deleteWhere(ctx.Provider, ctx.User, AUDIT_LOGS, `RecordID = '${id}'`, 'the promotion log row');
                    await deleteWhere(ctx.Provider, ctx.User, SPACE_NOTES, `ID = '${id}'`, 'the stage 4 note');
                }
            }
        },
    },
    {
        Id: 'stage4.SC2',
        Name: 'SC2 — over the wire: Turn into document files a note as a Markdown item on the note\'s band through UploadSpaceFile',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            let itemId: string | null = null;
            let fileId: string | null = null;
            try {
                const doc = noteDocument({ Title: `${MARK} Kickoff recap`, Body: 'Scope agreed.\n\nNext check-in Thursday.' });
                Assert(doc.fileName === 'collab-check-stage4-wire-kickoff-recap.md', `The file is named from the title: ${doc.fileName}`);
                const res = await clientOf(ada).UploadSpaceFile({ SpaceID: NORTHWIND, FileName: doc.fileName, MimeType: doc.mimeType, Base64Data: Buffer.from(doc.content, 'utf8').toString('base64'), Folder: 'Notes', Band: 'Team' });
                Assert(res.Success === true && !!res.ItemID, `The document is filed: ${res.ErrorMessage ?? ''}`);
                itemId = res.ItemID!;
                const [item] = await FindRows<{ ID: string; Band: string; RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `ID = '${itemId}'`, ['ID', 'Band', 'RecordID'], undefined, { BypassCache: true });
                Assert(!!item && item.Band === 'Team', `The item sits on the note's band (${item?.Band})`);
                fileId = item.RecordID.replace(/^ID\|/i, '');
                const [file] = await FindRows<{ Name: string; ContentType: string }>(ctx, FILE_ENTITY, `ID = '${fileId}'`, ['Name', 'ContentType'], undefined, { BypassCache: true });
                Assert(!!file && file.Name === doc.fileName, `The file carries the note's name (${file?.Name})`);
            } finally {
                if (itemId) await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, `ID = '${itemId}'`, 'the note document item'));
                if (fileId) await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, FILE_ENTITY, `ID = '${fileId}'`, 'the note document file'));
            }
        },
    },
    {
        Id: 'stage4.SC3',
        Name: 'SC3 — over the wire: GetSpaceComponent gives national staff the chapter banner with its bound props; a leader who does not reach the staff space is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await getPersonaClientContext(ctx, 'nico');
            const marco = await getPersonaClientContext(ctx, 'marco');
            const [type] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'example-chapter-staff'", ['ID']);
            const [grant] = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, `SpaceTypeID = '${type.ID}' AND Kind = 'Component'`, ['ID']);
            Assert(!!grant, 'The staff type grants the chapter banner component');
            try {
                const got = await clientOf(nico).GetSpaceComponent(CHAPTER_12_STAFF, grant.ID);
                Assert(got.Success === true && !!got.SpecificationJSON, `Nico gets the component over the wire: ${got.ErrorMessage ?? ''}`);
                const spec = JSON.parse(got.SpecificationJSON ?? '{}') as { name?: string; code?: string };
                Assert(spec.name === 'ExampleChapterBanner' && typeof spec.code === 'string', `The specification is the component's (${spec.name})`);
                const props = JSON.parse(got.PropsJSON ?? '{}') as Record<string, unknown>;
                Assert(props.chapterName === 'Chapter 12' && props.region === 'West', `The props are bound from the anchor: ${got.PropsJSON}`);
                const refused = await clientOf(marco).GetSpaceComponent(CHAPTER_12_STAFF, grant.ID);
                Assert(refused.Success === false && /do not reach/.test(refused.ErrorMessage ?? ''), `Marco is refused: ${refused.ErrorMessage ?? ''}`);
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, AUDIT_LOGS, `RecordID = '${grant.ID}'`, 'the component run log rows'));
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage4', {
    Setup: async () => {},
    Teardown: async () => {},
});
