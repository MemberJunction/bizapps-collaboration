/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Live SQL Server Integration Checks for SpaceNote -> Native MJ: Artifacts (Markdown Document)
 * promotion and `DelegateEntityID` / `DelegateRecordID` permission delegation across Team,
 * Shared, Private, and cross-organization boundaries.
 *
 * Every mutating check runs inside an isolated `CHECK_SPACE_PREFIX` space cleaned via
 * `cleanupSpace` (plus full promoted Artifact/Version/Attribute/SpaceItem teardown) so the
 * shared seeded world spaces (e.g. Northwind) are never polluted for `scripts/persona-check.sql`
 * or subsequent check bundles.
 */
import { type ArtifactDelegateContext } from '@memberjunction/core-entities';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    DEFAULT_NOTE_DOCUMENT_TITLE,
    MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME,
    NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE,
    type Band,
    type NoteVisibility,
} from '@mj-biz-apps/collaboration-core';
import {
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceMemberEntity,
    type mjBizAppsCollaborationSpaceNoteEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    CollaborationSpaceItemArtifactPermissionDelegate,
    LoadCollaborationSpaceItemArtifactPermissionDelegate,
    promoteSpaceNoteToDoc,
    updateSpaceDoc,
} from '@mj-biz-apps/collaboration-core-entities-server';
import {
    ARTIFACT_ENTITY,
    ARTIFACT_VERSION_ENTITY,
    SPACE_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_NOTE_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    SPACE_TYPE_ENTITY,
} from '../entity-names.js';
import { getPersonaContext, type PersonaIntegrationCheckContext } from '../persona-provider.js';
import { FindRows, SameID } from '../wire.js';
import { CHECK_SPACE_PREFIX } from '../world/ids.js';
import { cleanupSpace, cleanupStep, deleteWhere, registerChecks } from './cleanup-helpers.js';

const ARTIFACT_VERSION_ATTRIBUTE_ENTITY = 'MJ: Artifact Version Attributes';

interface IsolatedNoteSpace {
    spaceId: string;
    teamNoteId: string;
    sharedNoteId: string;
    privateNoteId: string;
}

async function cleanupPromotedDoc(
    ctx: IntegrationCheckContext,
    ids: { spaceId?: string | null; spaceItemId?: string | null; artifactId?: string | null },
): Promise<void> {
    if (ids.spaceItemId) {
        await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, `ID = '${ids.spaceItemId}'`, 'promoted SpaceItem'));
    }
    if (ids.spaceId) {
        await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_NOTICE_EVENT_ENTITY, `SpaceID = '${ids.spaceId}'`, 'promoted Space Notice Events'));
    }
    if (ids.artifactId) {
        if (ctx.Provider.EntityByName(ARTIFACT_VERSION_ATTRIBUTE_ENTITY)) {
            await cleanupStep(async () => {
                const versionRows = await FindRows<{ ID: string }>(
                    ctx,
                    ARTIFACT_VERSION_ENTITY,
                    `ArtifactID = '${ids.artifactId}'`,
                    ['ID'],
                    ctx.User,
                    { BypassCache: true },
                );
                if (versionRows.length > 0) {
                    const idList = versionRows.map((v) => `'${v.ID}'`).join(', ');
                    await deleteWhere(
                        ctx.Provider,
                        ctx.User,
                        ARTIFACT_VERSION_ATTRIBUTE_ENTITY,
                        `ArtifactVersionID IN (${idList})`,
                        'promoted Artifact Version Attributes',
                    );
                }
            });
        }
        await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, ARTIFACT_VERSION_ENTITY, `ArtifactID = '${ids.artifactId}'`, 'promoted Artifact Versions'));
        await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, ARTIFACT_ENTITY, `ID = '${ids.artifactId}'`, 'promoted Artifact'));
    }
}

async function createNoteInSpace(
    author: PersonaIntegrationCheckContext,
    spaceId: string,
    title: string,
    body: string,
    band: Band,
    visibility: NoteVisibility,
): Promise<string> {
    const note = await author.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, author.User);
    note.NewRecord();
    note.SpaceID = spaceId;
    note.Title = title;
    note.Body = body;
    note.Band = band;
    note.Visibility = visibility;
    Assert(await note.Save() && !!note.ID, `Failed to seed check note "${title}": ${note.LatestResult?.CompleteMessage ?? ''}`);
    return note.ID;
}

async function createIsolatedNoteSpace(
    ctx: IntegrationCheckContext,
    label: string,
    personas: {
        ada: PersonaIntegrationCheckContext;
        sam: PersonaIntegrationCheckContext;
        casey: PersonaIntegrationCheckContext;
        dana: PersonaIntegrationCheckContext;
    },
): Promise<IsolatedNoteSpace> {
    const [workspaceType] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'workspace'", ['ID']);
    const [ownerRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
    const [memberRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'member'", ['ID']);
    const [clientAdminRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'client-admin'", ['ID']);
    const [guestRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'guest'", ['ID']);
    Assert(
        !!workspaceType && !!ownerRole && !!memberRole && !!clientAdminRole && !!guestRole,
        'Workspace type and required SpaceRoleTypes must exist',
    );

    const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, personas.ada.User);
    space.NewRecord();
    space.Name = `${CHECK_SPACE_PREFIX}NoteToDoc ${label} ${Date.now()}`;
    space.SpaceTypeID = workspaceType.ID;
    space.OwnerID = personas.ada.User.ID;
    space.InheritsMembership = false;
    Assert(await space.Save() && !!space.ID, `Create isolated check space failed: ${space.LatestResult?.CompleteMessage ?? ''}`);
    const spaceId = space.ID;

    try {
        for (const seatSpec of [
            { userId: personas.ada.User.ID, roleId: ownerRole.ID, band: 'Team' as const },
            { userId: personas.sam.User.ID, roleId: memberRole.ID, band: 'Team' as const },
            { userId: personas.casey.User.ID, roleId: clientAdminRole.ID, band: 'Shared' as const },
            { userId: personas.dana.User.ID, roleId: guestRole.ID, band: 'Shared' as const },
        ]) {
            const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, personas.ada.User);
            seat.NewRecord();
            seat.SpaceID = spaceId;
            seat.UserID = seatSpec.userId;
            seat.SpaceRoleTypeID = seatSpec.roleId;
            seat.Band = seatSpec.band;
            seat.Status = 'Active';
            Assert(await seat.Save(), `Seat user ${seatSpec.userId} on isolated NoteToDoc space failed: ${seat.LatestResult?.CompleteMessage ?? ''}`);
        }

        const teamNoteId = await createNoteInSpace(
            personas.sam,
            spaceId,
            'Pricing thoughts (internal)',
            'Hold the 8% uplift until the roadmap lands. Casey will push back on the services line; have the comparison ready.',
            'Team',
            'Space',
        );
        const sharedNoteId = await createNoteInSpace(
            personas.ada,
            spaceId,
            'Kickoff recap',
            'Scope agreed with Casey: the executive roadmap by the 20th and a pricing review after. Next check-in is Thursday.',
            'Shared',
            'Space',
        );
        const privateNoteId = await createNoteInSpace(
            personas.ada,
            spaceId,
            'My follow-ups',
            'Call Casey Thursday. Send Sam the renewal numbers.',
            'Team',
            'Private',
        );

        return { spaceId, teamNoteId, sharedNoteId, privateNoteId };
    } catch (err) {
        await cleanupSpace(ctx.Provider, ctx.User, spaceId);
        throw err;
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
            const dana = await getPersonaContext(ctx, 'dana');
            // Harper is the rival external organization (Solstice Logistics) Space Participant — never seated here and not a staff UI admin
            const harper = await getPersonaContext(ctx, 'harper');

            let isolatedSpaceId: string | null = null;
            let createdItemId: string | null = null;
            let createdArtifactId: string | null = null;
            try {
                const isolated = await createIsolatedNoteSpace(ctx, 'N1', { ada, sam, casey, dana });
                isolatedSpaceId = isolated.spaceId;

                const outcome = await promoteSpaceNoteToDoc({
                    provider: ctx.Provider,
                    callerUser: sam.User,
                    spaceId: isolated.spaceId,
                    noteId: isolated.teamNoteId,
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
                Assert((await delegate.CanRead(delegateCtx, harper.User)) === 'Deny', 'Cross-org outsider Harper is denied Team doc via delegate');
            } finally {
                await cleanupPromotedDoc(ctx, { spaceId: isolatedSpaceId, spaceItemId: createdItemId, artifactId: createdArtifactId });
                if (isolatedSpaceId) {
                    await cleanupSpace(ctx.Provider, ctx.User, isolatedSpaceId);
                }
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
            const sam = await getPersonaContext(ctx, 'sam');
            const casey = await getPersonaContext(ctx, 'casey');
            const dana = await getPersonaContext(ctx, 'dana');
            const harper = await getPersonaContext(ctx, 'harper');

            let isolatedSpaceId: string | null = null;
            let createdItemId: string | null = null;
            let createdArtifactId: string | null = null;
            try {
                const isolated = await createIsolatedNoteSpace(ctx, 'N2', { ada, sam, casey, dana });
                isolatedSpaceId = isolated.spaceId;

                const outcome = await promoteSpaceNoteToDoc({
                    provider: ctx.Provider,
                    callerUser: ada.User,
                    spaceId: isolated.spaceId,
                    noteId: isolated.sharedNoteId,
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
                Assert((await delegate.CanRead(delegateCtx, harper.User)) === 'Deny', 'Cross-org outsider Harper is denied Shared doc via delegate');

                // Verify native document editability by appending v2 via updateSpaceDoc
                const updated = await updateSpaceDoc({
                    provider: ctx.Provider,
                    callerUser: ada.User,
                    spaceId: isolated.spaceId,
                    spaceItemId: outcome.data.spaceItemId,
                    content: `${outcome.data.content}\n## Follow-up\nConfirmed next Thursday.\n`,
                });
                Assert(updated.ok === true && updated.data.versionNumber === 2, `Native doc edit to v2 failed: ${updated.ok ? '' : updated.message}`);
            } finally {
                await cleanupPromotedDoc(ctx, { spaceId: isolatedSpaceId, spaceItemId: createdItemId, artifactId: createdArtifactId });
                if (isolatedSpaceId) {
                    await cleanupSpace(ctx.Provider, ctx.User, isolatedSpaceId);
                }
            }
        },
    },
    {
        Id: 'space-note-to-artifact-doc.N3',
        Name: 'N3 — Adversarial & untitled guards: Shared participant denied Team note, read-only guest denied Shared note, cross-org outsider denied, Private note locked to Team band, and untitled note falls back deterministically',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const sam = await getPersonaContext(ctx, 'sam');
            const casey = await getPersonaContext(ctx, 'casey');
            const dana = await getPersonaContext(ctx, 'dana');
            const harper = await getPersonaContext(ctx, 'harper');

            let isolatedSpaceId: string | null = null;
            try {
                const isolated = await createIsolatedNoteSpace(ctx, 'N3', { ada, sam, casey, dana });
                isolatedSpaceId = isolated.spaceId;

                const caseyBlocked = await promoteSpaceNoteToDoc({
                    provider: ctx.Provider,
                    callerUser: casey.User,
                    spaceId: isolated.spaceId,
                    noteId: isolated.teamNoteId,
                });
                Assert(caseyBlocked.ok === false && caseyBlocked.code === 'UNAUTHORIZED', 'Shared participant Casey cannot promote Team note');

                const danaGuestBlocked = await promoteSpaceNoteToDoc({
                    provider: ctx.Provider,
                    callerUser: dana.User,
                    spaceId: isolated.spaceId,
                    noteId: isolated.sharedNoteId,
                });
                Assert(danaGuestBlocked.ok === false && danaGuestBlocked.code === 'UNAUTHORIZED', 'Read-only guest Dana cannot promote Shared note');

                const harperBlocked = await promoteSpaceNoteToDoc({
                    provider: ctx.Provider,
                    callerUser: harper.User,
                    spaceId: isolated.spaceId,
                    noteId: isolated.teamNoteId,
                });
                Assert(harperBlocked.ok === false && harperBlocked.code === 'UNAUTHORIZED', 'Cross-org outsider Harper cannot promote space note');

                let samPrivateItemId: string | null = null;
                let samPrivateArtifactId: string | null = null;
                try {
                    const samOnAdaPrivate = await promoteSpaceNoteToDoc({
                        provider: ctx.Provider,
                        callerUser: sam.User,
                        spaceId: isolated.spaceId,
                        noteId: isolated.privateNoteId,
                    });
                    if (samOnAdaPrivate.ok) {
                        samPrivateItemId = samOnAdaPrivate.data.spaceItemId;
                        samPrivateArtifactId = samOnAdaPrivate.data.artifactId;
                    }
                    // Sam holds UI staff role (administers spaces in COLLAB-WORLD); verify fail-closed if non-admin or strictly locked to Team band if admin
                    Assert(
                        samOnAdaPrivate.ok === false || samOnAdaPrivate.data.band === 'Team',
                        'Private note never escapes the Team band',
                    );
                } finally {
                    await cleanupPromotedDoc(ctx, {
                        spaceId: isolatedSpaceId,
                        spaceItemId: samPrivateItemId,
                        artifactId: samPrivateArtifactId,
                    });
                }

                let untitledItemId: string | null = null;
                let untitledArtifactId: string | null = null;
                try {
                    const untitled = await promoteSpaceNoteToDoc({
                        provider: ctx.Provider,
                        callerUser: ada.User,
                        spaceId: isolated.spaceId,
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
                    await cleanupPromotedDoc(ctx, {
                        spaceId: isolatedSpaceId,
                        spaceItemId: untitledItemId,
                        artifactId: untitledArtifactId,
                    });
                }
            } finally {
                if (isolatedSpaceId) {
                    await cleanupSpace(ctx.Provider, ctx.User, isolatedSpaceId);
                }
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('space-note-to-artifact-doc', {
    Setup: async () => {},
    Teardown: async () => {},
});
