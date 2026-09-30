import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
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
    ExampleRoomUIDriver,
    ExampleRoomDealSummaryCard,
} from './index.js';
import {
    ExampleBoardServerDriver,
    ExampleRoomServerDriver,
    ExampleDealRoomLifecycleSubscriber,
    ExampleDealRoomSignalProvider,
} from './server.js';
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
    type BeforeCreateChildSpaceEvent,
    type BeforeInviteEvent,
    type BeforePostMessageEvent,
} from '@mj-biz-apps/collaboration-ng-widgets';
import {
    BaseSpaceTypeServerDriver,
    type SpaceChangeContext,
    type ChildSpaceChangeContext,
    type MemberChangeContext,
    type AnchorContext,
    type MessageValidationContext,
    type AgentContextParams,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { type EffectiveSpaceRules } from '@mj-biz-apps/collaboration-core';
import {
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
    type mjBizAppsCollaborationSpaceMemberEntity,
} from '@mj-biz-apps/collaboration-entities';
import { type UserInfo, type IMetadataProvider } from '@memberjunction/core';
import { CollaborationEngine, evaluateCanStartSpaceConversation } from '@mj-biz-apps/collaboration-core-entities-server';
import type { mjBizAppsCollaborationSpaceRoleTypeEntity } from '@mj-biz-apps/collaboration-entities';

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

describe('ExampleBoardServerDriver', () => {
    let driver: ExampleBoardServerDriver;

    beforeEach(() => {
        driver = new ExampleBoardServerDriver();
    });

    it('is registered with ClassFactory under "example-board"', () => {
        const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseSpaceTypeServerDriver>(
            BaseSpaceTypeServerDriver,
            'example-board'
        );
        expect(instance).toBeInstanceOf(ExampleBoardServerDriver);
    });

    it('AdjustRules narrows who may start a conversation to owners, through the rule that decides it: a seat that can post but is not an owner is refused, and an owner may start', () => {
        const baseCtx = {
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            spaceType: createMockSpaceType(),
            effectiveRules: createMockRules(),
        };
        const anyone = createMockRules();
        expect(anyone.Chats.WhoCanStart).toBe('Anyone');
        const adjusted = driver.AdjustRules(baseCtx, anyone);
        expect(adjusted.Chats.WhoCanStart).toBe('Owners');
        expect(driver.AdjustRules(baseCtx, anyone).Chats.AgentReplyMode).toBe('MentionOrOneToOne');
        const contributor = { isOwnerRole: false, canContribute: true, canSeeTeamBand: true };
        const owner = { isOwnerRole: true, canContribute: true, canSeeTeamBand: true };
        // Without the board's narrowing the contributor may start; with it, only the owner may
        expect(evaluateCanStartSpaceConversation(false, anyone.Chats.WhoCanStart, contributor).canStartConversation).toBe(true);
        expect(evaluateCanStartSpaceConversation(false, adjusted.Chats.WhoCanStart, contributor).canStartConversation).toBe(false);
        expect(evaluateCanStartSpaceConversation(false, adjusted.Chats.WhoCanStart, owner).canStartConversation).toBe(true);
    });

    it('ValidateSpaceChange refuses closing a board whose configuration says motions are open, and allows it when none are', () => {
        const closeCtx = (openMotions: number): SpaceChangeContext => ({
            kind: 'Close',
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace('b-1', 'Audit Committee', null, JSON.stringify({ Extensions: { 'example-board': { OpenMotions: openMotions } } })),
            spaceType: createMockSpaceType(),
            effectiveRules: createMockRules(),
        });
        const refused = driver.ValidateSpaceChange(closeCtx(2));
        expect(refused.ok).toBe(false);
        expect(refused.message).toContain('motions are open');
        expect(driver.ValidateSpaceChange(closeCtx(0)).ok).toBe(true);
    });

    it("ValidateSpaceChange judges a change to the board's own columns from the old value it is handed and the new one on the board row: an open board's quorum may rise, not fall, and a closed board's may do either", () => {
        const update = (closedAt: Date | null, before: number, after: number): SpaceChangeContext => {
            const space = createMockSpace('b-1', 'Audit Committee', closedAt);
            (space as unknown as { LeafEntity: { QuorumPercentage: number } }).LeafEntity = { QuorumPercentage: after };
            return {
                kind: 'Update',
                actingUser: createMockUser(),
                provider: {} as unknown as IMetadataProvider,
                space,
                spaceType: createMockSpaceType(),
                effectiveRules: createMockRules(),
                subtypeEntityName: 'MJ_BizApps_Collaboration_Examples: Example Boards',
                oldValues: { QuorumPercentage: before },
            };
        };
        const lowered = driver.ValidateSpaceChange(update(null, 60, 50));
        expect(lowered.ok).toBe(false);
        expect(lowered.message).toContain('60% to 50%');
        expect(lowered.field).toBe('QuorumPercentage');
        expect(driver.ValidateSpaceChange(update(null, 60, 75)).ok).toBe(true);
        expect(driver.ValidateSpaceChange(update(new Date('2026-09-01T00:00:00Z'), 60, 50)).ok).toBe(true);
        // A change to other columns, or one with no old value to compare, is not this rule's business
        const other = update(null, 60, 50);
        other.oldValues = { TermName: 'Old' };
        expect(driver.ValidateSpaceChange(other).ok).toBe(true);
    });

    it('ValidateSpaceChange refuses deleting active board space', () => {
        const space = createMockSpace('b-1', 'Audit Committee', null);
        const ctx: SpaceChangeContext = {
            kind: 'Delete',
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space,
            spaceType: createMockSpaceType(),
            effectiveRules: createMockRules(),
        };
        const res = driver.ValidateSpaceChange(ctx);
        expect(res.ok).toBe(false);
        expect(res.message).toContain('Cannot delete an active Board');
    });

    it('ValidateSpaceChange permits deleting closed board space', () => {
        const space = createMockSpace('b-1', 'Audit Committee', new Date('2026-09-01T00:00:00Z'));
        const ctx: SpaceChangeContext = {
            kind: 'Delete',
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space,
            spaceType: createMockSpaceType(),
            effectiveRules: createMockRules(),
        };
        const res = driver.ValidateSpaceChange(ctx);
        expect(res.ok).toBe(true);
    });

    it("ValidateChildSpaceChange refuses a sealed sub-committee named in the type's configuration that inherits membership", () => {
        const type = createMockSpaceType('example-board', { SealedChildNames: ['Compensation'] });
        const child = (name: string, inherits: boolean) => ({ Name: name, InheritsMembership: inherits, SpaceTypeID: 'board-type' }) as unknown as mjBizAppsCollaborationSpaceEntity;
        const ctxFor = (childSpace: mjBizAppsCollaborationSpaceEntity, kind: ChildSpaceChangeContext['kind'] = 'CreateChild'): ChildSpaceChangeContext => ({
            kind,
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace('b-1', 'Full Board'),
            childSpace,
            spaceType: type,
            effectiveRules: createMockRules(),
        });
        const refused = driver.ValidateChildSpaceChange(ctxFor(child('Compensation Committee', true)));
        expect(refused.ok).toBe(false);
        expect(refused.field).toBe('InheritsMembership');
        expect(driver.ValidateChildSpaceChange(ctxFor(child('Compensation Committee', false))).ok).toBe(true);
        expect(driver.ValidateChildSpaceChange(ctxFor(child('Audit Committee', true))).ok).toBe(true);
        // A configuration that names nothing seals nothing
        const unconfigured = { ...ctxFor(child('Compensation Committee', true)), spaceType: createMockSpaceType('example-board') };
        expect(driver.ValidateChildSpaceChange(unconfigured).ok).toBe(true);
        // A move into the board is judged the same way as a create
        expect(driver.ValidateChildSpaceChange(ctxFor(child('Compensation Committee', true), 'MoveChildIn')).ok).toBe(false);
        expect(driver.ValidateChildSpaceChange(ctxFor(child('Compensation Committee', true), 'ReopenChild')).ok).toBe(false);
        expect(driver.ValidateChildSpaceChange(ctxFor(child('Compensation Committee', true), 'CloseChild')).ok).toBe(true);
        expect(driver.ValidateChildSpaceChange(ctxFor(child('Compensation Committee', true), 'MoveChildOut')).ok).toBe(true);
    });

    it('ValidateChildSpaceChange refuses a room under a board, by the child\'s type code', () => {
        const spy = vi.spyOn(CollaborationEngine.Instance, 'SpaceTypeById').mockReturnValue({ Code: 'example-room' } as unknown as ReturnType<typeof CollaborationEngine.Instance.SpaceTypeById>);
        try {
            const ctx: ChildSpaceChangeContext = {
                kind: 'CreateChild',
                actingUser: createMockUser(),
                provider: {} as unknown as IMetadataProvider,
                space: createMockSpace('b-1', 'Full Board'),
                childSpace: { Name: 'Acme deal', InheritsMembership: false, SpaceTypeID: 'room-type' } as unknown as mjBizAppsCollaborationSpaceEntity,
                spaceType: createMockSpaceType(),
                effectiveRules: createMockRules(),
            };
            const res = driver.ValidateChildSpaceChange(ctx);
            expect(res.ok).toBe(false);
            expect(res.message).toContain('Boards cannot contain Deal Rooms');
        } finally {
            spy.mockRestore();
        }
    });

    describe('the cap on outside directors', () => {
        class CountingBoard extends ExampleBoardServerDriver {
            public seated = 0;
            protected override async CountOtherOutsideDirectors(): Promise<number> { return this.seated; }
        }
        const ctxFor = (config: object | null, band: 'Team' | 'Shared', kind: MemberChangeContext['kind'] = 'Invite'): MemberChangeContext => ({
            kind,
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            member: { ID: 'seat-1', Band: band, SpaceRoleTypeID: 'role-1' } as unknown as mjBizAppsCollaborationSpaceMemberEntity,
            spaceType: { ...createMockSpaceType(), Configuration: config ? JSON.stringify({ Extensions: { 'example-board': config } }) : null } as mjBizAppsCollaborationSpaceTypeEntity,
            effectiveRules: createMockRules(),
        });

        it('refuses an outside director beyond the type\'s MaxOutsideDirectors, naming the cap', async () => {
            const board = new CountingBoard();
            board.seated = 1;
            const refused = await board.ValidateMemberChange(ctxFor({ MaxOutsideDirectors: 1 }, 'Shared'));
            expect(refused.ok).toBe(false);
            expect(refused.message).toBe('This board already has 1 other outside director, the most its type allows (1).');
            board.seated = 0;
            expect((await board.ValidateMemberChange(ctxFor({ MaxOutsideDirectors: 1 }, 'Shared'))).ok).toBe(true);
        });

        it('has no cap when the type sets none, and leaves a Team seat and a removal alone', async () => {
            const board = new CountingBoard();
            board.seated = 5;
            expect((await board.ValidateMemberChange(ctxFor(null, 'Shared'))).ok).toBe(true);
            expect((await board.ValidateMemberChange(ctxFor({ MaxOutsideDirectors: 1 }, 'Team'))).ok).toBe(true);
            expect((await board.ValidateMemberChange(ctxFor({ MaxOutsideDirectors: 1 }, 'Shared', 'Remove'))).ok).toBe(true);
        });

        it('judges a role change and a band change onto the Shared band as it judges an invitation', async () => {
            const board = new CountingBoard();
            board.seated = 1;
            for (const kind of ['Invite', 'RoleChange', 'BandChange'] as const) {
                const refused = await board.ValidateMemberChange(ctxFor({ MaxOutsideDirectors: 1 }, 'Shared', kind));
                expect([kind, refused.ok]).toEqual([kind, false]);
            }
        });

        it('passes a seat that is already an outside director on a full board: it is not one of the others', async () => {
            const board = new CountingBoard();
            board.seated = 0;
            // The only outside director changes between two outside roles: the count of the others is 0
            expect((await board.ValidateMemberChange(ctxFor({ MaxOutsideDirectors: 1 }, 'Shared', 'RoleChange'))).ok).toBe(true);
        });

        it('throws on a cap that is not a whole number, rather than reading it as none', async () => {
            const board = new CountingBoard();
            await expect(board.ValidateMemberChange(ctxFor({ MaxOutsideDirectors: 'two' }, 'Shared'))).rejects.toThrow(/MaxOutsideDirectors/);
        });
    });

    it('BuildAgentContext returns governance instructions and context data', () => {
        const ctx: AgentContextParams = {
            chatId: 'chat-1',
            viewerBands: { 'user-1': 'Shared', 'user-2': 'Team' },
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            spaceType: createMockSpaceType(),
            effectiveRules: createMockRules(),
        };
        const result = driver.BuildAgentContext(ctx);
        expect(result.instructions?.some((i) => i.includes('Audit Committee'))).toBe(true);
        expect(result.contextData?.['term']).toBe('FY2026');
        expect(result.contextData?.['quorumPercent']).toBe(50);
    });
});

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

    it('BeforeCreateChildSpace prevents adding deal rooms under a board', () => {
        const event: BeforeCreateChildSpaceEvent = {
            cancel: false,
            parentSpaceId: 'board-1',
            childTypeCode: 'example-room',
            name: 'Acme Deal',
        };
        uiDriver.BeforeCreateChildSpace(event);
        expect(event.cancel).toBe(true);
        expect(event.cancelReason).toContain('Boards cannot contain Deal Rooms');
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
        expect(new ExampleRoomUIDriver().GetTabLabel(uiCtx, 'Library', 'Library')).toBe('Documents');
        expect(new ExampleRoomUIDriver().GetTabLabel(uiCtx, 'People', 'People')).toBe('People');
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

describe('ExampleRoomServerDriver', () => {
    let driver: ExampleRoomServerDriver;

    beforeEach(() => {
        driver = new ExampleRoomServerDriver();
    });

    it("ValidateAnchor takes the record and an entity from the type's configuration", () => {
        const user = createMockUser();
        const provider = {} as unknown as IMetadataProvider;
        const configured = createMockSpaceType('example-room', { AnchorEntities: ['Deals', 'Opportunities'] });
        const ctxFor = (entityName: string, recordId: string, type = configured): AnchorContext => ({ actingUser: user, provider, spaceType: type, entityName, recordId });

        expect(driver.ValidateAnchor(ctxFor('Deals', '')).ok).toBe(false);
        expect(driver.ValidateAnchor(ctxFor('UnrelatedEntity', 'deal-123')).ok).toBe(false);
        expect(driver.ValidateAnchor(ctxFor('deals', 'deal-123')).ok).toBe(true);
        expect(driver.ValidateAnchor(ctxFor('Opportunities', 'opp-1')).ok).toBe(true);
        // A type that lists no anchor entity accepts none, and says so
        const refused = driver.ValidateAnchor(ctxFor('Deals', 'deal-123', createMockSpaceType('example-room')));
        expect(refused.ok).toBe(false);
        expect(refused.message).toContain('none is configured');
    });

    it("ValidateMemberChange refuses seating a contact the room's configuration lists as opted out", () => {
        const optedOut = createMockSpace('room-1', 'Acme Deal Room', null, JSON.stringify({ Extensions: { 'example-room': { OptedOutUserIds: ['USER-OPTED-OUT'] } } }));
        const ctxFor = (userId: string, kind: MemberChangeContext['kind'] = 'Invite'): MemberChangeContext => ({
            kind,
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: optedOut,
            member: { UserID: userId } as unknown as mjBizAppsCollaborationSpaceMemberEntity,
            spaceType: createMockSpaceType('example-room'),
            effectiveRules: createMockRules(),
        });
        const refused = driver.ValidateMemberChange(ctxFor('user-opted-out'));
        expect(refused.ok).toBe(false);
        expect(refused.field).toBe('UserID');
        expect(driver.ValidateMemberChange(ctxFor('someone-else')).ok).toBe(true);
        expect(driver.ValidateMemberChange(ctxFor('user-opted-out', 'Remove')).ok).toBe(true);
    });

    it('ValidateChildSpaceChange refuses creating sub-spaces in a Deal Room', () => {
        const parentSpace = createMockSpace('deal-room-1', 'Acme Deal Room');
        const child = createMockSpace('child-1', 'Sub Workstream');
        const ctx: ChildSpaceChangeContext = {
            kind: 'CreateChild',
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: parentSpace,
            childSpace: child,
            spaceType: createMockSpaceType('example-room'),
            effectiveRules: createMockRules(),
        };
        const res = driver.ValidateChildSpaceChange(ctx);
        expect(res.ok).toBe(false);
        expect(res.message).toContain('Deal Rooms cannot contain child spaces');
    });

    it("ValidateMessage refuses the phrases the type's configuration blocks", () => {
        const baseCtx: MessageValidationContext = {
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            spaceType: createMockSpaceType('example-room', { BlockedPhrases: ['confidential deal floor', 'Internal margin target'] }),
            effectiveRules: createMockRules(),
            chatId: 'chat-1',
            messageText: 'Hello team, the confidential deal floor is 100k.',
        };
        const res1 = driver.ValidateMessage(baseCtx);
        expect(res1.ok).toBe(false);
        expect(res1.message).toContain('Cannot post confidential margin');
        expect(driver.ValidateMessage({ ...baseCtx, messageText: 'The INTERNAL MARGIN TARGET moved.' }).ok).toBe(false);
        expect(driver.ValidateMessage({ ...baseCtx, messageText: 'Please review the updated deliverables proposal.' }).ok).toBe(true);
        expect(driver.ValidateMessage({ ...baseCtx, spaceType: createMockSpaceType('example-room'), messageText: 'the confidential deal floor' }).ok).toBe(true);
    });

    it('BuildAgentContext omits win probability and margins when buyer contact (Shared band) is in chat', () => {
        const sharedCtx: AgentContextParams = {
            chatId: 'chat-shared',
            viewerBands: {
                'sales-rep-1': 'Team',
                'buyer-rep-1': 'Shared',
            },
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            spaceType: createMockSpaceType('example-room'),
            effectiveRules: createMockRules(),
        };
        const sharedResult = driver.BuildAgentContext(sharedCtx);
        expect(sharedResult.instructions?.some((i) => i.includes('buyer contacts present'))).toBe(true);
        expect(sharedResult.contextData?.['winProbability']).toBeUndefined();
        expect(sharedResult.contextData?.['marginTargetPercent']).toBeUndefined();
        expect(sharedResult.contextData?.['isSharedAudience']).toBe(true);

        const teamCtx: AgentContextParams = {
            chatId: 'chat-team',
            viewerBands: {
                'sales-rep-1': 'Team',
                'sales-rep-2': 'Team',
            },
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            spaceType: createMockSpaceType('example-room'),
            effectiveRules: createMockRules(),
        };
        const teamResult = driver.BuildAgentContext(teamCtx);
        expect(teamResult.instructions?.some((i) => i.includes('internal Deal Room chat'))).toBe(true);
        expect(teamResult.contextData?.['winProbability']).toBe(75);
        expect(teamResult.contextData?.['marginTargetPercent']).toBe(42);
        expect(teamResult.contextData?.['isSharedAudience']).toBe(false);
    });

    it("SyncSeats hands the base only the contacts the room's configuration does not list as opted out", async () => {
        const space = createMockSpace('deal-space-1', 'Deal', null, JSON.stringify({ Extensions: { 'example-room': { OptedOutEmails: ['Unsubscribed.Contact@acme.com'] } } }));
        const people = [
            { Email: 'buyer.lead@acme.com', RoleTypeName: 'Buyer Contact' },
            { Email: 'unsubscribed.contact@acme.com', RoleTypeName: 'Buyer Contact' },
            { Email: 'sales.exec@ourfirm.com', RoleTypeName: 'Deal Lead' },
        ];
        const base = vi.spyOn(BaseSpaceTypeServerDriver.prototype, 'SyncSeats').mockResolvedValue({ added: 0, updated: 0, removed: 0, invited: 0, errors: [] });
        try {
            await driver.SyncSeats(space, 'crm:roster', people, createMockUser(), {} as unknown as IMetadataProvider);
            const handed = base.mock.calls[0][2].map((p) => p.Email);
            expect(handed).toEqual(['buyer.lead@acme.com', 'sales.exec@ourfirm.com']);
        } finally {
            base.mockRestore();
        }
    });
});

describe('ExampleRoomUIDriver', () => {
    let uiDriver: ExampleRoomUIDriver;
    let uiCtx: SpaceUIContext;

    beforeEach(() => {
        uiDriver = new ExampleRoomUIDriver();
        uiCtx = {
            spaceTypeCode: 'example-room',
            rules: createMockRules(),
            space: createMockSpace('room-1', 'Acme Deal Room'),
            type: createMockSpaceType('example-room'),
            viewer: createMockUser(),
        };
    });

    it('draws the deal card once when the real contributions are assembled, as the section does', () => {
        const assembled = assembleSpaceContributions<SpaceOverviewCardDescriptor>(
            BaseSpaceOverviewCard,
            'example-room',
            [],
            (reg, meta) => ({ key: meta.contributionKey, title: meta.title ?? meta.contributionKey, sortKey: meta.sortKey, component: reg.SubClass as Type<BaseSpaceOverviewCard> }),
        );
        const cards = uiDriver.GetOverviewCards(uiCtx, assembled);
        expect(cards.filter((c) => normalizeContributionKey(c.key) === 'deal-summary')).toHaveLength(1);
        expect(cards.find((c) => c.key === 'deal-summary')?.component).toBe(ExampleRoomDealSummaryCard);
    });

    it('GetOverviewCards includes Deal Overview card', () => {
        const cards = uiDriver.GetOverviewCards(uiCtx, []);
        expect(cards.some((c) => c.key === 'deal-summary')).toBe(true);
        expect(cards.find((c) => c.key === 'deal-summary')?.component).toBe(ExampleRoomDealSummaryCard);
    });

    it('BeforeInvite cancels invite for opt-out contacts', () => {
        const event: BeforeInviteEvent = {
            cancel: false,
            spaceId: 'room-1',
            email: 'client-optout@example.com',
            role: 'Buyer',
            band: 'Shared',
        };
        uiDriver.BeforeInvite(event);
        expect(event.cancel).toBe(true);
        expect(event.cancelReason).toContain('opted out');
    });

    it('BeforePostMessage cancels if message contains confidential deal floor', () => {
        const event: BeforePostMessageEvent = {
            cancel: false,
            spaceId: 'room-1',
            chatId: 'chat-1',
            messageText: 'Note: internal margin target is confidential.',
        };
        uiDriver.BeforePostMessage(event);
        expect(event.cancel).toBe(true);
        expect(event.cancelReason).toContain('Cannot post confidential margin');
    });
});

describe('ExampleDealRoomLifecycleSubscriber', () => {
    beforeEach(() => {
        ExampleDealRoomLifecycleSubscriber.clearEvents();
    });

    it('records and processes space lifecycle events', () => {
        const subscriber = new ExampleDealRoomLifecycleSubscriber();
        subscriber.OnEvent({
            event: 'AfterSpaceClosed',
            spaceId: 'deal-space-1',
            actingUserId: 'user-1',
            timestamp: new Date('2026-09-27T02:00:00Z'),
            data: { dealOutcome: 'Won' },
        });

        subscriber.OnEvent({
            event: 'AfterMemberAdded',
            spaceId: 'deal-space-1',
            actingUserId: 'user-1',
            timestamp: new Date('2026-09-27T02:05:00Z'),
            data: { memberRole: 'Buyer Contact' },
        });

        const events = ExampleDealRoomLifecycleSubscriber.ReceivedEvents;
        expect(events.length).toBe(2);
        expect(events[0].event).toBe('AfterSpaceClosed');
        expect(events[0].spaceId).toBe('deal-space-1');
        expect(events[1].event).toBe('AfterMemberAdded');
    });
});

describe('ExampleDealRoomSignalProvider', () => {
    it('produces dated observations for 10-Q filing and stage advancement', async () => {
        const provider = new ExampleDealRoomSignalProvider();
        const space = createMockSpace('deal-space-1', 'Northwind Deal');
        const signals = await provider.GetSignals(
            space,
            createMockUser(),
            {} as unknown as IMetadataProvider
        );

        expect(signals.length).toBe(2);
        expect(signals.some((s) => s.title.includes('Quarterly 10-Q filing'))).toBe(true);
        expect(signals.some((s) => s.title.includes('Proposal Review'))).toBe(true);
        expect(signals[0].observedAt).toBeInstanceOf(Date);
    });
});

describe('a setting that does not parse is refused, not read as empty', () => {
    it('throws on an unparseable configuration and on a list of the wrong shape', () => {
        const badJson = { ...createMockSpaceType('example-room'), Configuration: '{ not json' } as unknown as mjBizAppsCollaborationSpaceTypeEntity;
        const driver = new ExampleRoomServerDriver();
        const ctx = (type: mjBizAppsCollaborationSpaceTypeEntity): MessageValidationContext => ({
            actingUser: createMockUser(), provider: {} as unknown as IMetadataProvider, space: createMockSpace(), spaceType: type,
            effectiveRules: createMockRules(), chatId: 'c', messageText: 'hello',
        });
        expect(() => driver.ValidateMessage(ctx(badJson))).toThrow(/does not parse/);
        const wrongShape = createMockSpaceType('example-room', { BlockedPhrases: 'confidential' });
        expect(() => driver.ValidateMessage(ctx(wrongShape))).toThrow(/BlockedPhrases must be a list of strings/);
    });
});
