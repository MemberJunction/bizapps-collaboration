import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MJGlobal } from '@memberjunction/global';
import {
    BaseNeedsYouProvider,
    BaseSpaceHeaderChipProvider,
    NeedsYouProvider,
    SpaceHeaderChipProvider,
    type NeedsYouItem,
    type SpaceBatchContext,
    type SpaceHeaderChip,
} from '@mj-biz-apps/collaboration-core';
import { settingsAccess } from './settings-access.ts';
import { buildSettingsModel, type SettingsSpaceRow, type SettingsTypeInfo } from './settings-model.ts';
import {
    collectSpaceHeaderChips,
    collectSpaceNeedsYouItems,
    matchesSpaceTypeMetadata,
    normalizeHeaderActions,
    normalizeHeaderChips,
    normalizeSettingsSections,
} from './space-extensions.ts';

const SPACE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SPACE_ID = '22222222-2222-4222-8222-222222222222';
const VIEWER_ID = '33333333-3333-4333-8333-333333333333';

class BoardNeedsYouHighProvider extends BaseNeedsYouProvider {
    public override async getItemsForSpaces(context: SpaceBatchContext): Promise<NeedsYouItem[]> {
        return [
            {
                id: 'vote-1',
                spaceId: context.spaceIds[0],
                title: 'Motion 2026-14: External Auditor',
                description: 'Cast your ballot before Friday.',
                actionLabel: 'Vote now',
                actionType: 'vote',
                urgency: 'high',
                metadata: { tab: 'motions' },
            },
            {
                id: 'other-space-item',
                spaceId: OTHER_SPACE_ID,
                title: 'Should be filtered out',
            },
        ];
    }
}

class CriticalWildcardNeedsYouProvider extends BaseNeedsYouProvider {
    public override async getItemsForSpaces(context: SpaceBatchContext): Promise<NeedsYouItem[]> {
        return [
            {
                id: 'critical-1',
                spaceId: context.spaceIds[0],
                title: 'Action required immediately',
                description: 'Critical compliance review.',
                actionLabel: 'Review',
                urgency: 'critical',
                metadata: { iconClass: 'fa-solid fa-shield-halved', isSpark: true },
            },
        ];
    }
}

class LegacyNeedsYouProvider extends NeedsYouProvider {
    public override async getItems(spaceId?: string): Promise<NeedsYouItem[]> {
        return [
            {
                id: 'legacy-1',
                spaceId,
                title: 'Pending question',
                urgency: 'normal',
            },
        ];
    }
}

class ThrowingNeedsYouProvider extends BaseNeedsYouProvider {
    public override async getItemsForSpaces(): Promise<NeedsYouItem[]> {
        throw new Error('Provider offline');
    }
}

class BoardChipProvider extends BaseSpaceHeaderChipProvider {
    public override async getChipsForSpaces(context: SpaceBatchContext): Promise<Map<string, SpaceHeaderChip[]>> {
        const result = new Map<string, SpaceHeaderChip[]>();
        result.set(context.spaceIds[0], [
            { id: 'term-chip', label: 'FY2026 term', variant: 'info', icon: 'fa-regular fa-calendar' },
        ]);
        return result;
    }
}

class LegacyChipProvider extends SpaceHeaderChipProvider {
    public override async getChips(): Promise<SpaceHeaderChip[]> {
        return [{ id: 'legacy-chip', label: 'Legacy badge', variant: 'plain' }];
    }
}

class NonMatchingChipProvider extends BaseSpaceHeaderChipProvider {
    public override async getChipsForSpaces(context: SpaceBatchContext): Promise<Map<string, SpaceHeaderChip[]>> {
        const result = new Map<string, SpaceHeaderChip[]>();
        result.set(context.spaceIds[0], [{ id: 'wrong-type', label: 'Should not appear' }]);
        return result;
    }
}

describe('space-extensions helpers (CX-9)', () => {
    const factory = MJGlobal.Instance.ClassFactory;

    it('matchesSpaceTypeMetadata handles wildcards, case-insensitive matches, and empty metadata', () => {
        assert.equal(matchesSpaceTypeMetadata(undefined, 'board'), true);
        assert.equal(matchesSpaceTypeMetadata({ spaceTypes: ['*'] }, 'board'), true);
        assert.equal(matchesSpaceTypeMetadata({ spaceTypes: ['Example-Board'] }, 'example-board'), true);
        assert.equal(matchesSpaceTypeMetadata({ spaceTypes: ['deal-room'] }, 'example-board'), false);
    });

    it('collectSpaceNeedsYouItems collects batch and single providers, sorts by urgency, and isolates failures', async () => {
        factory.Register(BaseNeedsYouProvider, BoardNeedsYouHighProvider, 'cx9-test:board-needs', 1, true, false, { spaceTypes: ['example-board'] });
        factory.Register(BaseNeedsYouProvider, CriticalWildcardNeedsYouProvider, 'cx9-test:crit-needs', 1, true, false, { spaceTypes: ['*'] });
        factory.Register(BaseNeedsYouProvider, ThrowingNeedsYouProvider, 'cx9-test:bad-needs', 1, true, false, { spaceTypes: ['*'] });
        factory.Register(NeedsYouProvider, LegacyNeedsYouProvider, 'cx9-test:legacy-needs', 1, true, false, { spaceTypes: ['example-board'] });

        const errors: Error[] = [];
        const result = await collectSpaceNeedsYouItems({
            spaceId: SPACE_ID,
            viewerId: VIEWER_ID,
            spaceType: 'example-board',
            onError: (err) => errors.push(err),
        });

        assert.equal(errors.length, 1);
        assert.deepEqual(
            result.models.map((m) => [m.id, m.variant]),
            [
                ['critical-1', 'red'],
                ['vote-1', 'warn'],
                ['legacy-1', 'blue'],
            ],
        );
        assert.equal(result.models[0].isSpark, true);
        assert.equal(result.models[0].iconClass, 'fa-solid fa-shield-halved');
        assert.equal(result.models[1].iconClass, 'fa-solid fa-check-to-slot');
        assert.equal(result.rawById.get('vote-1')?.metadata?.['tab'], 'motions');
    });

    it('collectSpaceHeaderChips collects matching batch and legacy chip providers and filters non-matching types', async () => {
        factory.Register(BaseSpaceHeaderChipProvider, BoardChipProvider, 'cx9-test:board-chips', 1, true, false, { spaceTypes: ['example-board'] });
        factory.Register(BaseSpaceHeaderChipProvider, NonMatchingChipProvider, 'cx9-test:other-chips', 1, true, false, { spaceTypes: ['deal-room'] });
        factory.Register(SpaceHeaderChipProvider, LegacyChipProvider, 'cx9-test:legacy-chips', 1, true, false, { spaceTypes: ['*'] });

        const chips = await collectSpaceHeaderChips({
            spaceId: SPACE_ID,
            viewerId: VIEWER_ID,
            spaceType: 'example-board',
        });

        assert.deepEqual(
            chips.map((c) => ({ key: c.key, label: c.label, variant: c.variant })),
            [
                { key: 'term-chip', label: 'FY2026 term', variant: 'info' },
                { key: 'legacy-chip', label: 'Legacy badge', variant: 'plain' },
            ],
        );
    });

    it('normalizes chips, actions, and settings sections by key and sortKey', () => {
        const chips = normalizeHeaderChips([
            { key: 'B', label: 'Second', sortKey: 20 },
            { key: 'a', label: 'First', sortKey: 10 },
            { key: 'b', label: 'Override Second', sortKey: 15 },
        ]);
        assert.deepEqual(chips.map((c) => c.label), ['First', 'Override Second']);

        const noop = () => undefined;
        const actions = normalizeHeaderActions([
            { key: 'x', label: 'X', action: noop, sortKey: 30 },
            { key: 'y', label: 'Y', action: noop, sortKey: 5 },
        ]);
        assert.deepEqual(actions.map((a) => a.key), ['y', 'x']);

        const sections = normalizeSettingsSections([
            { key: 's2', title: 'Two', sortKey: 50 },
            { key: 's1', title: 'One', sortKey: 10 },
        ]);
        assert.deepEqual(sections.map((s) => s.key), ['s1', 's2']);
    });
});

describe('CX-12 Paused vs Closed terminal settingsAccess and buildSettingsModel', () => {
    const typeInfo: SettingsTypeInfo = { name: 'Workspace', icon: 'fa-solid fa-compass', color: '#0076b6' };
    const baseRow = (over: Partial<SettingsSpaceRow> = {}): SettingsSpaceRow => ({
        ID: SPACE_ID,
        Name: 'Board Space',
        SpaceTypeID: '44444444-4444-4444-8444-444444444444',
        ClosedAt: null,
        ...over,
    });

    it('marks Closed as terminal and Paused as non-terminal read-only in buildSettingsModel', () => {
        const closedModel = buildSettingsModel(baseRow({ StatusName: 'Closed', ClosedAt: new Date(), IsTerminal: true, IsReadOnly: true }), typeInfo);
        assert.equal(closedModel.status, 'Closed');
        assert.equal(closedModel.isTerminal, true);
        assert.equal(closedModel.isReadOnly, true);

        const pausedModel = buildSettingsModel(baseRow({ StatusName: 'Paused', IsTerminal: false, IsReadOnly: true }), typeInfo);
        assert.equal(pausedModel.status, 'Paused');
        assert.equal(pausedModel.isTerminal, false);
        assert.equal(pausedModel.isReadOnly, true);
    });

    it('offers Reopen on Paused spaces and hides Reopen on terminal Closed spaces in settingsAccess', () => {
        const pausedAccess = settingsAccess({
            isClosed: false,
            isPaused: true,
            isTerminal: false,
            canConfigure: true,
            canClose: false,
            canReopen: true,
        });
        assert.equal(pausedAccess.showTab, true);
        assert.equal(pausedAccess.canEdit, false);
        assert.equal(pausedAccess.canChangeLifecycle, true);
        assert.match(pausedAccess.readOnlyNote, /paused/i);

        const closedAccess = settingsAccess({
            isClosed: true,
            isPaused: false,
            isTerminal: true,
            canConfigure: true,
            canClose: false,
            canReopen: true,
        });
        assert.equal(closedAccess.showTab, true);
        assert.equal(closedAccess.canEdit, false);
        assert.equal(closedAccess.canChangeLifecycle, false);
        assert.match(closedAccess.readOnlyNote, /Closed moves forward only/);
    });
});
