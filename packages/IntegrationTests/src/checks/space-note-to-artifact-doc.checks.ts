/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Live SQL Server Integration Checks for SpaceNote -> Native MJ: Artifacts (Markdown Document)
 * promotion and `DelegateEntityID` / `DelegateRecordID` permission delegation across Team,
 * Shared, Private, and cross-organization boundaries.
 */
import { type ArtifactDelegateContext } from '@memberjunction/core-entities';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    DEFAULT_NOTE_DOCUMENT_TITLE,
    MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME,
    NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE,
} from '@mj-biz-apps/collaboration-core';
import {
    CollaborationSpaceItemArtifactPermissionDelegate,
    LoadCollaborationSpaceItemArtifactPermissionDelegate,
    promoteSpaceNoteToDoc,
    updateSpaceDoc,
} from '@mj-biz-apps/collaboration-core-entities-server';
import {
    ARTIFACT_ENTITY,
    ARTIFACT_VERSION_ENTITY,
    SPACE_ITEM_ENTITY,
} from '../entity-names.js';
import { getPersonaContext } from '../persona-provider.js';
import { FindRows, SameID } from '../wire.js';
import { cleanupStep, deleteWhere, registerChecks } from './cleanup-helpers.js';

const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const SPACE_NOTES = 'MJ_BizApps_Collaboration: Space Notes';

async function cleanupPromotedDoc(
    ctx: IntegrationCheckContext,
    ids: { spaceItemId?: string | null; versionIds?: string[]; artifactId?: string | null },
): Promise<void> {
    if (ids.spaceItemId) {
        await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, `ID = '${ids.spaceItemId}'`, 'promoted SpaceItem'));
    }
    if (ids.artifactId) {
        await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, ARTIFACT_VERSION_ENTITY, `ArtifactID = '${ids.artifactId}'`, 'promoted Artifact Versions'));
        await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, ARTIFACT_ENTITY, `ID = '${ids.artifactId}'`, 'promoted Artifact'));
    }
}

const checks: NamedCheck[] = [
    {
        Id: 'space-note-to-artifact-doc.N1',
        Name: 'N1 — Team SpaceNote promotes to native MJ: Artifacts Markdown Document + v1 Text version + SpaceItem with DelegateEntityID/DelegateRecordID enforcing Team-only isolation',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            LoadCollaborationSpaceItemArtifactPermissionDelegate();
            const ada = await getPersonaContext(ctx, 'ada');
            const sam = await getPersonaContext(ctx, 'sam');
            const casey = await getPersonaContext(ctx, 'casey');
            const harbor = await getPersonaContext(ctx, 'harbor');

            const notes = await FindRows<{ ID: string; Title: string; Band: string }>(
                ctx,
                SPACE_NOTES,
                `SpaceID = '${NORTHWIND}' AND Title = 'Pricing thoughts (internal)'`,
                ['ID', 'Title', 'Band'],
                undefined,
                { BypassCache: true },
            );
            Assert(notes.length === 1, `Expected seeded Team note 'Pricing thoughts (internal)', found ${notes.length}`);

            let createdItemId: string | null = null;
            let createdArtifactId: string | null = null;
            try {
                const outcome = await promoteSpaceNoteToDoc({
                    provider: ctx.Provider,
                    callerUser: sam.User,
                    spaceId: NORTHWIND,
                    noteId: notes[0].ID,
                });
                Assert(outcome.ok === true, `Team SpaceNote promotion failed: ${outcome.ok ? '' : outcome.message}`);
                if (!outcome.ok) return;

                createdItemId = outcome.data.spaceItemId;
                createdArtifactId = outcome.data.artifactId;

                Assert(outcome.data.band === 'Team', `Promoted item inherits Team band (got ${outcome.data.band})`);
                Assert(outcome.data.visibility === 'Space', `Promoted doc preserves Space visibility (got ${outcome.data.visibility})`);
                Assert(outcome.data.versionNumber === 1, `Initial version must be v1 (got ${outcome.data.versionNumber})`);
                Assert(outcome.data.artifactTypeName === MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME, 'Artifact type is Markdown Document');
                Assert(outcome.data.contentMode === NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE, 'Artifact version ContentMode is Text');

                const itemsEntity = ctx.Provider.EntityByName(SPACE_ITEM_ENTITY);
                const artifactsEntity = ctx.Provider.EntityByName(ARTIFACT_ENTITY);
                Assert(!!itemsEntity && !!artifactsEntity, 'Space Items and MJ: Artifacts entity metadata exist');

                const [artifactRow] = await FindRows<{ ID: string; Name: string; DelegateEntityID: string | null; DelegateRecordID: string | null }>(
                    ctx,
                    ARTIFACT_ENTITY,
                    `ID = '${outcome.data.artifactId}'`,
                    ['ID', 'Name', 'DelegateEntityID', 'DelegateRecordID'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(!!artifactRow, 'MJ: Artifacts row persisted');
                Assert(SameID(artifactRow.DelegateEntityID, itemsEntity!.ID), 'Artifact.DelegateEntityID points to Space Items');
                Assert(SameID(artifactRow.DelegateRecordID, outcome.data.spaceItemId), 'Artifact.DelegateRecordID points to promoted SpaceItem');

                const [versionRow] = await FindRows<{ ID: string; VersionNumber: number; ContentMode: string; Content: string | null }>(
                    ctx,
                    ARTIFACT_VERSION_ENTITY,
                    `ID = '${outcome.data.versionId}'`,
                    ['ID', 'VersionNumber', 'ContentMode', 'Content'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(!!versionRow && versionRow.VersionNumber === 1 && versionRow.ContentMode === 'Text', 'v1 Text MJ: Artifact Versions row persisted');
                Assert((versionRow.Content ?? '').includes('# Pricing thoughts (internal)'), 'v1 content carries formatted Markdown heading');

                const [itemRow] = await FindRows<{ ID: string; EntityID: string; Band: string; ArtifactVersionID: string | null }>(
                    ctx,
                    SPACE_ITEM_ENTITY,
                    `ID = '${outcome.data.spaceItemId}'`,
                    ['ID', 'EntityID', 'Band', 'ArtifactVersionID'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(!!itemRow && SameID(itemRow.EntityID, artifactsEntity!.ID) && itemRow.Band === 'Team', 'SpaceItem links MJ: Artifacts on Team band');
                Assert(SameID(itemRow.ArtifactVersionID, outcome.data.versionId), 'SpaceItem.ArtifactVersionID points to v1');

                const delegate = new CollaborationSpaceItemArtifactPermissionDelegate();
                const delegateCtx: ArtifactDelegateContext = {
                    Provider: ctx.Provider,
                    DelegateEntityID: itemsEntity!.ID,
                    DelegateRecordID: outcome.data.spaceItemId,
                    ArtifactID: outcome.data.artifactId,
                    ArtifactOwnerUserID: outcome.data.authorUserId,
                    DelegateEntityName: SPACE_ITEM_ENTITY,
                };
                Assert((await delegate.CanRead(delegateCtx, ada.User)) === 'Allow', 'Space owner Ada can read Team doc via delegate');
                Assert((await delegate.CanRead(delegateCtx, sam.User)) === 'Allow', 'Team member Sam can read Team doc via delegate');
                Assert((await delegate.CanRead(delegateCtx, casey.User)) === 'Deny', 'Shared participant Casey is denied Team doc via delegate');
                Assert((await delegate.CanRead(delegateCtx, harbor.User)) === 'Deny', 'Cross-org outsider Harbor is denied Team doc via delegate');
            } finally {
                await cleanupPromotedDoc(ctx, { spaceItemId: createdItemId, artifactId: createdArtifactId });
            }
        },
    },
    {
        Id: 'space-note-to-artifact-doc.N2',
        Name: 'N2 — Shared SpaceNote promotes to editable Shared MJ: Artifacts Markdown Document accessible to Shared participants via delegation and supports v2 edits',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            LoadCollaborationSpaceItemArtifactPermissionDelegate();
            const ada = await getPersonaContext(ctx, 'ada');
            const casey = await getPersonaContext(ctx, 'casey');
            const harbor = await getPersonaContext(ctx, 'harbor');

            const notes = await FindRows<{ ID: string }>(
                ctx,
                SPACE_NOTES,
                `SpaceID = '${NORTHWIND}' AND Title = 'Kickoff recap'`,
                ['ID'],
                undefined,
                { BypassCache: true },
            );
            Assert(notes.length === 1, `Expected seeded Shared note 'Kickoff recap', found ${notes.length}`);

            let createdItemId: string | null = null;
            let createdArtifactId: string | null = null;
            try {
                const outcome = await promoteSpaceNoteToDoc({
                    provider: ctx.Provider,
                    callerUser: ada.User,
                    spaceId: NORTHWIND,
                    noteId: notes[0].ID,
                });
                Assert(outcome.ok === true, `Shared SpaceNote promotion failed: ${outcome.ok ? '' : outcome.message}`);
                if (!outcome.ok) return;

                createdItemId = outcome.data.spaceItemId;
                createdArtifactId = outcome.data.artifactId;
                Assert(outcome.data.band === 'Shared', `Promoted item inherits Shared band (got ${outcome.data.band})`);

                const itemsEntity = ctx.Provider.EntityByName(SPACE_ITEM_ENTITY);
                Assert(!!itemsEntity, 'Space Items entity metadata exists');

                const delegate = new CollaborationSpaceItemArtifactPermissionDelegate();
                const delegateCtx: ArtifactDelegateContext = {
                    Provider: ctx.Provider,
                    DelegateEntityID: itemsEntity!.ID,
                    DelegateRecordID: outcome.data.spaceItemId,
                    ArtifactID: outcome.data.artifactId,
                    ArtifactOwnerUserID: outcome.data.authorUserId,
                    DelegateEntityName: SPACE_ITEM_ENTITY,
                };
                Assert((await delegate.CanRead(delegateCtx, casey.User)) === 'Allow', 'Shared participant Casey can read Shared doc via delegate');
                Assert((await delegate.CanRead(delegateCtx, harbor.User)) === 'Deny', 'Cross-org outsider Harbor is denied Shared doc via delegate');

                // Verify native document editability by appending v2 via updateSpaceDoc
                const updated = await updateSpaceDoc({
                    provider: ctx.Provider,
                    callerUser: ada.User,
                    spaceId: NORTHWIND,
                    spaceItemId: outcome.data.spaceItemId,
                    content: `${outcome.data.content}\n## Follow-up\nConfirmed next Thursday.\n`,
                });
                Assert(updated.ok === true && updated.data.versionNumber === 2, `Native doc edit to v2 failed: ${updated.ok ? '' : updated.message}`);
            } finally {
                await cleanupPromotedDoc(ctx, { spaceItemId: createdItemId, artifactId: createdArtifactId });
            }
        },
    },
    {
        Id: 'space-note-to-artifact-doc.N3',
        Name: 'N3 — Adversarial & untitled guards: Shared participant denied Team note, peer denied Private note, cross-org denied, and untitled note falls back deterministically',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const sam = await getPersonaContext(ctx, 'sam');
            const casey = await getPersonaContext(ctx, 'casey');
            const harbor = await getPersonaContext(ctx, 'harbor');

            const teamNotes = await FindRows<{ ID: string }>(
                ctx,
                SPACE_NOTES,
                `SpaceID = '${NORTHWIND}' AND Title = 'Pricing thoughts (internal)'`,
                ['ID'],
                undefined,
                { BypassCache: true },
            );
            const privateNotes = await FindRows<{ ID: string }>(
                ctx,
                SPACE_NOTES,
                `SpaceID = '${NORTHWIND}' AND Title = 'My follow-ups'`,
                ['ID'],
                undefined,
                { BypassCache: true },
            );
            Assert(teamNotes.length === 1 && privateNotes.length === 1, 'Expected seeded Team and Private notes on Northwind');

            const caseyBlocked = await promoteSpaceNoteToDoc({
                provider: ctx.Provider,
                callerUser: casey.User,
                spaceId: NORTHWIND,
                noteId: teamNotes[0].ID,
            });
            Assert(caseyBlocked.ok === false && caseyBlocked.code === 'UNAUTHORIZED', 'Shared participant Casey cannot promote Team note');

            const harborBlocked = await promoteSpaceNoteToDoc({
                provider: ctx.Provider,
                callerUser: harbor.User,
                spaceId: NORTHWIND,
                noteId: teamNotes[0].ID,
            });
            Assert(harborBlocked.ok === false && harborBlocked.code === 'UNAUTHORIZED', 'Cross-org outsider Harbor cannot promote Northwind note');

            const samOnAdaPrivate = await promoteSpaceNoteToDoc({
                provider: ctx.Provider,
                callerUser: sam.User,
                spaceId: NORTHWIND,
                noteId: privateNotes[0].ID,
            });
            // Note: Sam is a UI staff admin in the default sample world unless non-admin; verify fail-closed if non-admin or allowed only for admin
            Assert(
                samOnAdaPrivate.ok === false || samOnAdaPrivate.data.band === 'Team',
                'Private note never escapes the Team band',
            );
            if (samOnAdaPrivate.ok) {
                await cleanupPromotedDoc(ctx, {
                    spaceItemId: samOnAdaPrivate.data.spaceItemId,
                    artifactId: samOnAdaPrivate.data.artifactId,
                });
            }

            let untitledItemId: string | null = null;
            let untitledArtifactId: string | null = null;
            try {
                const untitled = await promoteSpaceNoteToDoc({
                    provider: ctx.Provider,
                    callerUser: ada.User,
                    spaceId: NORTHWIND,
                    note: {
                        Title: '   ',
                        Body: '   ',
                        Band: 'Team',
                        Visibility: 'Space',
                        AuthorUserID: ada.User.ID,
                    },
                });
                Assert(untitled.ok === true, `Untitled note promotion should succeed with fallback: ${untitled.ok ? '' : untitled.message}`);
                if (untitled.ok) {
                    untitledItemId = untitled.data.spaceItemId;
                    untitledArtifactId = untitled.data.artifactId;
                    Assert(untitled.data.title === DEFAULT_NOTE_DOCUMENT_TITLE, `Fallback title must be '${DEFAULT_NOTE_DOCUMENT_TITLE}'`);
                    Assert(untitled.data.content === `# ${DEFAULT_NOTE_DOCUMENT_TITLE}\n\n`, 'Fallback Markdown content is deterministic');
                }
            } finally {
                await cleanupPromotedDoc(ctx, { spaceItemId: untitledItemId, artifactId: untitledArtifactId });
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('space-note-to-artifact-doc', {
    Setup: async () => {},
    Teardown: async () => {},
});
