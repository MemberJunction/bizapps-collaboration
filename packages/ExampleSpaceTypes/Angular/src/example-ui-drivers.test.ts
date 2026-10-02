import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    ExampleBoardUIDriver,
    ExampleBoardAgendaProvider,
    ExampleBoardNeedsYouProvider,
    ExampleBoardHeaderChipProvider,
    ExampleBoardMeetingsTab,
    ExampleBoardMotionsTab,
    ExampleBoardPapersTab,
    ExampleBoardNextMeetingCard,
    ExampleBoardAgendaCard,
    ExampleBoardVoteCard,
    ExampleBoardMembersCard,
} from './index.js';
import type { Type } from '@angular/core';
import { normalizeContributionKey } from '@mj-biz-apps/collaboration-core';
import {
    assembleSpaceContributions,
    overlayDescriptors,
    BaseSpaceTab,
    BaseSpaceOverviewCard,
    type SpaceUIContext,
    type SpaceTabDescriptor,
    type SpaceOverviewCardDescriptor,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { type EffectiveSpaceRules } from '@mj-biz-apps/collaboration-core';
import { type mjBizAppsCollaborationSpaceEntity, type mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { type UserInfo } from '@memberjunction/core';

// Mock context factory helpers
function createMockUser(id: string = 'user-1', name: string = 'Test User'): UserInfo {
    return {
        ID: id,
        Name: name,
        Email: 'user@example.com',
        UserRoles: [],
    } as unknown as UserInfo;
}

function createMockSpace(id: string = 'space-1', name: string = 'Audit Committee', closedAt: Date | null = null, configuration: string | null = null): mjBizAppsCollaborationSpaceEntity {
    return {
        ID: id,
        Name: name,
        ClosedAt: closedAt,
        InheritsMembership: true,
        Configuration: configuration,
    } as unknown as mjBizAppsCollaborationSpaceEntity;
}

function createMockSpaceType(code: string = 'example-board', extensions: Record<string, unknown> = {}): mjBizAppsCollaborationSpaceTypeEntity {
    return {
        Code: code,
        Name: 'Board',
        Configuration: JSON.stringify({ Extensions: { [code]: extensions } }),
    } as unknown as mjBizAppsCollaborationSpaceTypeEntity;
}

function createMockRules(): EffectiveSpaceRules {
    return {
        Chats: {
            WhoCanStart: 'Anyone',
            AgentReplyMode: 'MentionOrOneToOne',
            HistoryOnAdd: 'None',
        },
        Agents: { ListMode: 'Extend' },
        Extensions: {},
    };
}

describe('ExampleBoardUIDriver and Contributions', () => {
    let uiDriver: ExampleBoardUIDriver;
    let uiCtx: SpaceUIContext;

    beforeEach(() => {
        uiDriver = new ExampleBoardUIDriver();
        uiCtx = {
            spaceTypeCode: 'example-board',
            rules: createMockRules(),
            space: createMockSpace(),
            type: createMockSpaceType(),
            viewer: createMockUser(),
        };
    });

    it('GetTabs returns Overview, Meetings, Papers, Motions, Members, Chat', () => {
        const tabs = uiDriver.GetTabs(uiCtx, []);
        expect(tabs.map((t) => t.key)).toEqual([
            'overview',
            'meetings',
            'papers',
            'motions',
            'people',
            'chat',
        ]);
        expect(tabs.find((t) => t.key === 'meetings')?.component).toBe(ExampleBoardMeetingsTab);
        expect(tabs.find((t) => t.key === 'papers')?.component).toBe(ExampleBoardPapersTab);
        expect(tabs.find((t) => t.key === 'motions')?.component).toBe(ExampleBoardMotionsTab);
    });

    it("keeps the built-in tabs it doesn't name, replaces the ones it does by key, and leaves no two tabs tied", () => {
        const builtIn: SpaceTabDescriptor[] = [
            { key: 'Overview', label: 'Overview', sortKey: 10 },
            { key: 'Library', label: 'Library', sortKey: 20 },
            { key: 'Work', label: 'Work', sortKey: 30 },
            { key: 'Chat', label: 'Chat', sortKey: 40 },
            { key: 'People', label: 'People', sortKey: 50 },
            { key: 'Settings', label: 'Settings', sortKey: 100 },
        ];
        const tabs = uiDriver.GetTabs(uiCtx, builtIn);
        expect(tabs.map((t) => normalizeContributionKey(t.key))).toEqual(['overview', 'meetings', 'papers', 'motions', 'library', 'work', 'people', 'chat', 'settings']);
        expect(tabs.find((t) => normalizeContributionKey(t.key) === 'people')?.label).toBe('Members');
        expect(new Set(tabs.map((t) => t.sortKey)).size).toBe(tabs.length);
    });

    it("assembles the real contributions with the built-in tabs, then the board's own tabs: each key once, Members carries no fixed count", () => {
        const builtIn: SpaceTabDescriptor[] = [
            { key: 'Overview', label: 'Overview', sortKey: 10 },
            { key: 'Library', label: 'Library', sortKey: 20 },
            { key: 'Work', label: 'Work', sortKey: 30 },
            { key: 'Chat', label: 'Chat', sortKey: 40 },
            { key: 'People', label: 'People', sortKey: 50 },
            { key: 'Settings', label: 'Settings', sortKey: 100 },
        ];
        const assembled = assembleSpaceContributions<SpaceTabDescriptor>(
            BaseSpaceTab,
            'example-board',
            builtIn,
            (reg, meta) => ({ key: meta.contributionKey, label: meta.label ?? meta.contributionKey, sortKey: meta.sortKey, component: reg.SubClass as Type<BaseSpaceTab> }),
        );
        const tabs = uiDriver.GetTabs(uiCtx, assembled);
        const keys = tabs.map((t) => normalizeContributionKey(t.key));
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toEqual(expect.arrayContaining(['overview', 'meetings', 'papers', 'motions', 'library', 'work', 'people', 'chat', 'settings']));
        expect(tabs.find((t) => normalizeContributionKey(t.key) === 'people')?.badgeCount).toBeUndefined();
    });

    it('keys a tab spelled discussions as the Chat tab, so a label for either reaches it', () => {
        expect(normalizeContributionKey('Discussions')).toBe('chat');
        const ctx = { ...uiCtx, rules: { ...createMockRules(), Labels: { Tabs: { Discussions: 'Threads' } } } } as SpaceUIContext;
        expect(uiDriver.GetTabLabel(ctx, 'chat', 'Chat')).toBe('Threads');
    });

    it("declares every card a Shared card: Frame 08 is an outside director's view, on the Shared band", () => {
        const cards = uiDriver.GetOverviewCards(uiCtx, []);
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.map((c) => c.side)).toEqual(cards.map(() => 'Shared'));
    });

    it('GetOverviewCards returns Frame 08 overview cards', () => {
        const cards = uiDriver.GetOverviewCards(uiCtx, []);
        expect(cards.map((c) => c.key)).toEqual([
            'next-meeting',
            'agenda',
            'vote',
            'members',
        ]);
        expect(cards.find((c) => c.key === 'next-meeting')?.component).toBe(ExampleBoardNextMeetingCard);
        expect(cards.find((c) => c.key === 'agenda')?.component).toBe(ExampleBoardAgendaCard);
        expect(cards.find((c) => c.key === 'vote')?.component).toBe(ExampleBoardVoteCard);
        expect(cards.find((c) => c.key === 'members')?.component).toBe(ExampleBoardMembersCard);
    });

    it('GetHeaderChips adds Committee and FY2026 term chips', () => {
        const chips = uiDriver.GetHeaderChips(uiCtx, []);
        expect(chips.map((c) => c.label)).toEqual(['Committee', 'FY2026 term']);
    });

    it('GetHeaderActions includes Add to Calendar and Download Pack', () => {
        const actions = uiDriver.GetHeaderActions(uiCtx, []);
        expect(actions.some((a) => a.key === 'add-calendar')).toBe(true);
        expect(actions.some((a) => a.key === 'download-pack')).toBe(true);
    });

    it('assembleSpaceContributions discovers and orders example-board tabs and cards', () => {
        const defaultTabs: SpaceTabDescriptor[] = [
            { key: 'overview', label: 'Overview', sortKey: 10 },
        ];
        const assembledTabs = assembleSpaceContributions(
            BaseSpaceTab,
            'example-board',
            defaultTabs,
            (reg, meta) => ({
                key: meta.contributionKey,
                label: meta.label ?? meta.contributionKey,
                sortKey: meta.sortKey,
                component: reg.SubClass as Type<BaseSpaceTab>,
            })
        );
        expect(assembledTabs.some((t) => t.key === 'meetings')).toBe(true);
        expect(assembledTabs.some((t) => t.key === 'papers')).toBe(true);

        const defaultCards: SpaceOverviewCardDescriptor[] = [];
        const assembledCards = assembleSpaceContributions(
            BaseSpaceOverviewCard,
            'example-board',
            defaultCards,
            (reg, meta) => ({
                key: meta.contributionKey,
                title: meta.title ?? meta.contributionKey,
                sortKey: meta.sortKey,
                component: reg.SubClass as Type<BaseSpaceOverviewCard>,
            })
        );
        expect(assembledCards.some((c) => c.key === 'next-meeting')).toBe(true);
        expect(assembledCards.some((c) => c.key === 'agenda')).toBe(true);
    });
});

describe('cross-app contributions and their rules', () => {
    const cardFor = (typeCode: string, defaults: SpaceOverviewCardDescriptor[] = []) => assembleSpaceContributions(
        BaseSpaceOverviewCard,
        typeCode,
        defaults,
        (reg, meta) => ({ key: meta.contributionKey, title: meta.title ?? meta.contributionKey, sortKey: meta.sortKey, component: reg.SubClass as Type<BaseSpaceOverviewCard> }),
    );

    it("shows another app's '*' card in an example-board space and in a workspace", () => {
        expect(cardFor('example-board').some((c) => c.key === 'example-notice')).toBe(true);
        expect(cardFor('workspace').some((c) => c.key === 'example-notice')).toBe(true);
        expect(cardFor('workspace').some((c) => c.key === 'next-meeting')).toBe(false);
    });

    it("keeps that card when the board's own driver names its parts: it replaces its own keys and keeps the rest", () => {
        const uiCtx = { spaceTypeCode: 'example-board', rules: createMockRules(), space: createMockSpace(), type: createMockSpaceType(), viewer: createMockUser() };
        const assembled = cardFor('example-board');
        const cards = new ExampleBoardUIDriver().GetOverviewCards(uiCtx, assembled);
        expect(cards.map((c) => c.key)).toEqual(expect.arrayContaining(['next-meeting', 'agenda', 'vote', 'members', 'example-notice']));
    });

    it('refuses a contribution whose key clashes with a built-in part, and logs it', () => {
        const builtIn: SpaceOverviewCardDescriptor[] = [{ key: 'Example-Notice', title: 'Built-in', sortKey: 1 }];
        const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const cards = cardFor('workspace', builtIn);
            expect(cards.filter((c) => normalizeContributionKey(c.key) === 'example-notice')).toEqual(builtIn);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('was refused'));
        } finally {
            warn.mockRestore();
        }
    });

    it("lets the type's own driver replace a built-in part: the board's 'overview' replaces the built-in 'Overview'", () => {
        const builtIn: SpaceTabDescriptor[] = [{ key: 'Overview', label: 'Built-in overview', sortKey: 10 }, { key: 'Library', label: 'Library', sortKey: 20 }];
        const uiCtx = { spaceTypeCode: 'example-board', rules: createMockRules(), space: createMockSpace(), type: createMockSpaceType(), viewer: createMockUser() };
        const tabs = new ExampleBoardUIDriver().GetTabs(uiCtx, builtIn);
        expect(tabs.filter((t) => normalizeContributionKey(t.key) === 'overview')).toHaveLength(1);
        expect(tabs.find((t) => normalizeContributionKey(t.key) === 'overview')?.label).toBe('Overview');
        expect(tabs.some((t) => t.key === 'Library')).toBe(true);
    });

    it('relabels a tab by its key without regard to case', () => {
        const uiCtx: SpaceUIContext = { spaceTypeCode: 'workspace', rules: { ...createMockRules(), Labels: { Tabs: { library: 'Documents' } } }, space: createMockSpace(), type: createMockSpaceType('workspace'), viewer: createMockUser() };
        expect(new ExampleBoardUIDriver().GetTabLabel(uiCtx, 'Library', 'Library')).toBe('Documents');
        expect(new ExampleBoardUIDriver().GetTabLabel(uiCtx, 'People', 'People')).toBe('People');
    });

    it('overlayDescriptors sorts by sortKey', () => {
        const merged = overlayDescriptors([{ key: 'b', sortKey: 20 }], [{ key: 'a', sortKey: 10 }]);
        expect(merged.map((d) => d.key)).toEqual(['a', 'b']);
    });
});

describe('ExampleBoard Providers', () => {
    it('ExampleBoardAgendaProvider returns meeting item', async () => {
        const provider = new ExampleBoardAgendaProvider();
        const items = await provider.getItemsForSpaces({
            spaceIds: ['board-space-1'],
            viewerId: 'user-1',
        });
        expect(items.length).toBe(1);
        expect(items[0].title).toBe('Q3 Audit Committee Meeting');
        expect(items[0].date.toISOString()).toBe('2026-10-02T16:00:00.000Z');
    });

    it('ExampleBoardNeedsYouProvider returns active vote item', async () => {
        const provider = new ExampleBoardNeedsYouProvider();
        const items = await provider.getItemsForSpaces({
            spaceIds: ['board-space-1'],
            viewerId: 'user-1',
        });
        expect(items.length).toBe(1);
        expect(items[0].title).toContain('Motion 2026-14');
        expect(items[0].actionType).toBe('vote');
        expect(items[0].urgency).toBe('high');
    });

    it('ExampleBoardHeaderChipProvider returns term and cadence chips', async () => {
        const provider = new ExampleBoardHeaderChipProvider();
        const chipsMap = await provider.getChipsForSpaces({
            spaceIds: ['board-space-1'],
            viewerId: 'user-1',
        });
        const chips = chipsMap.get('board-space-1') ?? [];
        expect(chips.length).toBe(2);
        expect(chips[0].label).toBe('FY2026 term');
        expect(chips[1].label).toBe('Meets quarterly');
    });
});
