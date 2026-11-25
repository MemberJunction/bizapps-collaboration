import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { SPACE_ENTITY, SPACE_ITEM_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaContext, View } from '../../wire.js';
import { deleteRowAndConfirm, registerChecks } from '../cleanup-helpers.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const HARBOR_SPACE_ID = 'C1000001-0000-4000-8000-000000000006';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';

const checks: NamedCheck[] = [
    {
        Id: 'row-filters.RF1',
        Name: 'RF1 — Bea (Client on Discovery) sees Discovery and Field notes, but nothing from Harbor over the wire',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const view = View(beaCtx);

            const spaces = await view.RunView<{ ID: string; Name: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID', 'Name'],
                ResultType: 'simple',
            });

            Assert(spaces.Success, `Bea RunView Spaces failed over the wire: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Bea can see Discovery space');
            Assert(!visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Bea MUST NOT see Harbor space');
        },
    },
    {
        Id: 'row-filters.RF2',
        Name: 'RF2 — Bea sees only Shared band items; Team items (discovery-brief) are hidden over the wire',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const view = View(beaCtx);

            const items = await view.RunView<{ ID: string; SpaceID: string; Band: string }>({
                EntityName: SPACE_ITEM_ENTITY,
                Fields: ['ID', 'SpaceID', 'Band'],
                ResultType: 'simple',
            });

            Assert(items.Success, `Bea RunView Space Items failed over the wire: ${items.ErrorMessage ?? 'unknown'}`);
            Assert(Array.isArray(items.Results) && items.Results.length > 0, 'Bea must see at least one Shared item in Discovery');
            for (const item of items.Results ?? []) {
                Assert(item.Band === 'Shared', `Bea saw non-Shared item with band '${item.Band}'`);
            }

            // Find Team items in Discovery space and assert Bea cannot see any of them by ID
            const teamItems = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND Band = 'Team'`,
                ['ID'],
            );
            Assert(teamItems.length > 0, 'At least one Team item exists in Discovery space');
            const beaVisibleItemIds = new Set((items.Results ?? []).map((i) => i.ID.toLowerCase()));
            for (const teamItem of teamItems) {
                Assert(!beaVisibleItemIds.has(teamItem.ID.toLowerCase()), `Team item ${teamItem.ID} MUST NOT be visible to Bea`);
            }
        },
    },
    {
        Id: 'row-filters.RF3',
        Name: 'RF3 — Harper (Client on Harbor) sees Harbor, but nothing from Discovery or Committee over the wire',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harperCtx = await getPersonaContext(ctx, 'harper');
            const view = View(harperCtx);

            const spaces = await view.RunView<{ ID: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID'],
                ResultType: 'simple',
            });

            Assert(spaces.Success, `Harper RunView Spaces failed over the wire: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Harper can see Harbor space');
            Assert(!visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Harper MUST NOT see Discovery space');
            Assert(!visibleIds.has(COMMITTEE_SPACE_ID.toLowerCase()), 'Harper MUST NOT see Committee space');
        },
    },
    {
        Id: 'row-filters.RF4',
        Name: 'RF4 — Dana (Director on Committee) sees Committee, but not Discovery or Harbor over the wire',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const danaCtx = await getPersonaContext(ctx, 'dana');
            const view = View(danaCtx);

            const spaces = await view.RunView<{ ID: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID'],
                ResultType: 'simple',
            });

            Assert(spaces.Success, `Dana RunView Spaces failed over the wire: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(COMMITTEE_SPACE_ID.toLowerCase()), 'Dana can see Committee space');
            Assert(!visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Dana MUST NOT see Discovery space');
            Assert(!visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Dana MUST NOT see Harbor space');
        },
    },
    {
        Id: 'row-filters.RF5',
        Name: 'RF5 — over the wire: Space Participant (Bea) reads enabled MJ: Artifact Types, Shared artifacts & versions in Discovery, and 0 Team or Harbor artifacts',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const harborCtx = await getPersonaContext(ctx, 'harbor');
            const beaView = View(beaCtx);

            const typesRes = await beaView.RunView<{ ID: string; Name: string }>({
                EntityName: 'MJ: Artifact Types',
                Fields: ['ID', 'Name'],
                ResultType: 'simple',
            });
            Assert(typesRes.Success && (typesRes.Results?.length ?? 0) > 0, `Bea reads enabled MJ: Artifact Types over wire (err=${typesRes.ErrorMessage ?? ''})`);

            const mdType = (typesRes.Results ?? []).find((t) => t.Name === 'Markdown Document') ?? typesRes.Results![0];
            const artifactsEntity = ctx.Provider.EntityByName('MJ: Artifacts');
            Assert(!!artifactsEntity?.ID, 'MJ: Artifacts entity metadata exists');

            const createdArtifactIds: string[] = [];
            const createdVersionIds: string[] = [];
            const createdItemIds: string[] = [];

            const seedSpaceArtifact = async (
                spaceId: string,
                signerCtx: typeof adaCtx,
                band: 'Shared' | 'Team',
                name: string,
            ): Promise<{ artifactId: string; versionId: string }> => {
                const art = await ctx.Provider.GetEntityObject('MJ: Artifacts', ctx.User);
                art.NewRecord();
                art.Set('Name', name);
                art.Set('TypeID', mdType.ID);
                art.Set('UserID', signerCtx.User.ID);
                Assert(await art.Save(), `Save wire fixture artifact ${name}: ${art.LatestResult?.CompleteMessage ?? ''}`);
                const artifactId = String(art.Get('ID'));
                createdArtifactIds.push(artifactId);

                const ver = await ctx.Provider.GetEntityObject('MJ: Artifact Versions', ctx.User);
                ver.NewRecord();
                ver.Set('ArtifactID', artifactId);
                ver.Set('VersionNumber', 1);
                ver.Set('Content', `# ${name}`);
                ver.Set('UserID', signerCtx.User.ID);
                Assert(await ver.Save(), `Save wire fixture artifact version ${name}: ${ver.LatestResult?.CompleteMessage ?? ''}`);
                const versionId = String(ver.Get('ID'));
                createdVersionIds.push(versionId);

                const item = await signerCtx.Provider.GetEntityObject(SPACE_ITEM_ENTITY, signerCtx.User);
                item.NewRecord();
                item.Set('SpaceID', spaceId);
                item.Set('EntityID', artifactsEntity!.ID);
                item.Set('RecordID', `ID|${artifactId}`);
                item.Set('Band', band);
                item.Set('ArtifactVersionID', versionId);
                Assert(await item.Save(), `Save wire fixture SpaceItem ${name}: ${item.LatestResult?.CompleteMessage ?? ''}`);
                createdItemIds.push(String(item.Get('ID')));

                return { artifactId, versionId };
            };

            try {
                const shared = await seedSpaceArtifact(DISCOVERY_SPACE_ID, adaCtx, 'Shared', 'RF5 Wire Discovery Shared Brief');
                const team = await seedSpaceArtifact(DISCOVERY_SPACE_ID, adaCtx, 'Team', 'RF5 Wire Discovery Team Notes');
                const harbor = await seedSpaceArtifact(HARBOR_SPACE_ID, harborCtx, 'Shared', 'RF5 Wire Harbor Shared Brief');

                const allIds = `'${shared.artifactId}', '${team.artifactId}', '${harbor.artifactId}'`;
                const beaArtsRes = await beaView.RunView<{ ID: string }>({
                    EntityName: 'MJ: Artifacts',
                    ExtraFilter: `ID IN (${allIds})`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                });
                Assert(beaArtsRes.Success, `Bea RunView MJ: Artifacts over wire failed: ${beaArtsRes.ErrorMessage ?? ''}`);
                const artSet = new Set((beaArtsRes.Results ?? []).map((r) => r.ID.toLowerCase()));
                Assert(artSet.has(shared.artifactId.toLowerCase()), 'Bea reads Discovery Shared artifact over wire');
                Assert(!artSet.has(team.artifactId.toLowerCase()), 'Bea MUST NOT read Discovery Team artifact over wire');
                Assert(!artSet.has(harbor.artifactId.toLowerCase()), 'Bea MUST NOT read Harbor Shared artifact over wire');

                const allVerIds = `'${shared.versionId}', '${team.versionId}', '${harbor.versionId}'`;
                const beaVersRes = await beaView.RunView<{ ID: string }>({
                    EntityName: 'MJ: Artifact Versions',
                    ExtraFilter: `ID IN (${allVerIds})`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                });
                Assert(beaVersRes.Success, `Bea RunView MJ: Artifact Versions over wire failed: ${beaVersRes.ErrorMessage ?? ''}`);
                const verSet = new Set((beaVersRes.Results ?? []).map((r) => r.ID.toLowerCase()));
                Assert(verSet.has(shared.versionId.toLowerCase()), 'Bea reads Discovery Shared artifact version over wire');
                Assert(!verSet.has(team.versionId.toLowerCase()), 'Bea MUST NOT read Discovery Team artifact version over wire');
                Assert(!verSet.has(harbor.versionId.toLowerCase()), 'Bea MUST NOT read Harbor artifact version over wire');

                for (const auxEntity of [
                    'MJ: Artifact Version Attributes',
                    'MJ: Artifact Permissions',
                    'MJ: Artifact Uses',
                    'MJ: Collection Artifacts',
                    'MJ: Conversation Detail Artifacts',
                    'MJ: Conversation Artifacts',
                ]) {
                    const auxRes = await beaView.RunView<{ ID: string }>({ EntityName: auxEntity, Fields: ['ID'], MaxRows: 5, ResultType: 'simple' });
                    Assert(auxRes.Success, `Bea RunView ${auxEntity} over wire succeeds: ${auxRes.ErrorMessage ?? ''}`);
                }
            } finally {
                for (const id of createdItemIds.reverse()) await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, id, 'RF5 wire space item');
                for (const id of createdVersionIds.reverse()) await deleteRowAndConfirm(ctx.Provider, ctx.User, 'MJ: Artifact Versions', id, 'RF5 wire artifact version');
                for (const id of createdArtifactIds.reverse()) await deleteRowAndConfirm(ctx.Provider, ctx.User, 'MJ: Artifacts', id, 'RF5 wire artifact');
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('row-filters', {
    Setup: async () => {},
    Teardown: async () => {},
});
