import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentMayQuote, authorizeItemWrite, visibleSpaces } from './rules.ts';
import { authorizeNoticeWrite, authorizeUseWrite, foldersIn, openMode, recordUse, requestedItemBand, shareRecipients, storedContentType } from './phase2.ts';
import { itemsIn, phase0Items, phase0Members, phase0Spaces } from './phase0.fixture.ts';

describe('phase 0 uses one set of rules', () => {
    it('shows the client only the discovery sub-space, and not the team band', () => {
        assert.deepEqual(visibleSpaces(phase0Spaces, phase0Members, 'bea').map((space) => space.id), ['discovery']);
        const team = itemsIn('discovery', 'file').find((item) => item.band === 'Team');
        assert.ok(team);
        assert.equal(agentMayQuote({
            callerCanRead: true,
            callerCanSeeTeam: false,
            itemBand: team.band,
            itemSpaceId: team.spaceId,
            askedFromSpaceId: 'discovery',
            spaces: phase0Spaces,
        }), false);
    });

    it('keeps the outside director inside the committee', () => {
        assert.deepEqual(visibleSpaces(phase0Spaces, phase0Members, 'director').map((space) => space.id), ['committee']);
        assert.equal(agentMayQuote({
            callerCanRead: false,
            callerCanSeeTeam: false,
            itemBand: 'Shared',
            itemSpaceId: 'discovery',
            askedFromSpaceId: 'engagement',
            spaces: phase0Spaces,
        }), false);
    });

    it('does not quote the engagement from inside discovery', () => {
        assert.equal(agentMayQuote({
            callerCanRead: true,
            callerCanSeeTeam: true,
            itemBand: 'Team',
            itemSpaceId: 'engagement',
            askedFromSpaceId: 'discovery',
            spaces: phase0Spaces,
        }), false);
    });

    it('runs the cohort through the same functions', () => {
        assert.deepEqual(visibleSpaces(phase0Spaces, phase0Members, 'lee').map((space) => space.id), ['cohort']);
        assert.equal(itemsIn('cohort', 'file').length, 1);
    });
});

describe('phase 2 library, share, and use', () => {
    it('groups files into folders and leaves tasks out of the library', () => {
        assert.deepEqual(foldersIn(phase0Items, 'discovery'), ['Deliverables', 'Working']);
        assert.equal(itemsIn('discovery', 'task').length, 1);
    });

    it('notifies people who can see a shared item, and not the promoter', () => {
        assert.deepEqual(shareRecipients({
            spaces: phase0Spaces,
            memberships: phase0Members,
            spaceId: 'discovery',
            promoterUserId: 'ada',
        }), ['bea']);
    });

    it('lands a learner upload in Shared when they cannot see Team', () => {
        const learner = phase0Members.find((member) => member.userId === 'lee');
        assert.ok(learner);
        const decision = authorizeItemWrite({
            callerUserId: 'lee',
            previousSpaceId: null,
            nextSpaceId: 'cohort',
            previousBand: null,
            nextBand: 'Team',
            now: new Date('2026-09-23T00:00:00Z'),
            spaces: phase0Spaces,
            memberships: phase0Members,
        });
        assert.equal(decision.ok && decision.band, 'Shared');
        assert.equal(decision.ok && decision.promotedByUserId, 'lee');
        const askedShared = authorizeItemWrite({
            callerUserId: 'lee',
            previousSpaceId: null,
            nextSpaceId: 'cohort',
            previousBand: null,
            nextBand: 'Shared',
            now: new Date('2026-09-23T00:00:00Z'),
            spaces: phase0Spaces,
            memberships: phase0Members,
        });
        assert.equal(askedShared.ok && askedShared.band, 'Shared');
    });

    it('refuses an item use in someone else\'s name, outside the space, or on a Team item the caller cannot see', () => {
        const shared = { callerUserId: 'bea', userId: 'bea', spaceId: 'discovery', itemSpaceId: 'discovery', itemBand: 'Shared' as const, spaces: phase0Spaces, memberships: phase0Members, isNew: true };
        assert.equal(authorizeUseWrite(shared).ok, true);
        assert.equal(authorizeUseWrite({ ...shared, userId: 'ada' }).ok, false);
        assert.equal(authorizeUseWrite({ ...shared, itemSpaceId: 'committee' }).ok, false);
        assert.equal(authorizeUseWrite({ ...shared, itemBand: 'Team' }).ok, false);
        assert.equal(authorizeUseWrite({ ...shared, callerUserId: 'ada', userId: 'ada', itemBand: 'Team' }).ok, true);
        assert.equal(authorizeUseWrite({ ...shared, isNew: false }).ok, false);
    });

    it('refuses a notice to the promoter, to someone outside the share, or about a Team item they cannot see', () => {
        const notice = { callerUserId: 'ada', recipientUserId: 'bea', spaceId: 'discovery', itemSpaceId: 'discovery', itemBand: 'Shared' as const, spaces: phase0Spaces, memberships: phase0Members, isNew: true };
        assert.equal(authorizeNoticeWrite(notice).ok, true);
        assert.equal(authorizeNoticeWrite({ ...notice, recipientUserId: 'ada' }).ok, false);
        assert.equal(authorizeNoticeWrite({ ...notice, recipientUserId: 'lee' }).ok, false);
        assert.equal(authorizeNoticeWrite({ ...notice, itemBand: 'Team' }).ok, false);
        assert.equal(authorizeNoticeWrite({ ...notice, callerUserId: 'lee', recipientUserId: 'ada', spaceId: 'cohort', itemSpaceId: 'cohort' }).ok, true);
        assert.equal(authorizeNoticeWrite({ ...notice, isNew: false }).ok, false);
    });

    it('requests the type default when the caller may place it, and Team otherwise', () => {
        assert.equal(requestedItemBand('Shared', true, true), 'Shared');
        assert.equal(requestedItemBand('Shared', false, false), 'Shared');
        assert.equal(requestedItemBand('Shared', true, false), 'Team');
        assert.equal(requestedItemBand('Team', true, true), 'Team');
    });

    it('keeps only passive content types', () => {
        assert.equal(storedContentType('text/html'), 'text/plain');
        assert.equal(storedContentType('image/svg+xml'), 'application/octet-stream');
        assert.equal(storedContentType('application/pdf'), 'application/pdf');
        assert.equal(openMode('text/html'), 'download');
        assert.equal(openMode('text/plain'), 'text');
        assert.equal(openMode('image/png'), 'inline');
    });

    it('records an open', () => {
        const at = new Date('2026-09-23T12:00:00Z');
        assert.deepEqual(recordUse('brief', 'bea', at, 'open'), { itemId: 'brief', userId: 'bea', at, kind: 'open' });
    });
});
