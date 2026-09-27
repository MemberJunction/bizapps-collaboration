import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
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
import {
    assembleSpaceContributions,
    BaseSpaceTab,
    BaseSpaceOverviewCard,
    type SpaceUIContext,
    type SpaceTabDescriptor,
    type SpaceOverviewCardDescriptor,
    type BeforeCloseSpaceEvent,
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

// Mock context factory helpers
function createMockUser(id: string = 'user-1', name: string = 'Test User'): UserInfo {
    return {
        ID: id,
        Name: name,
        Email: 'user@example.com',
        UserRoles: [],
    } as unknown as UserInfo;
}

function createMockSpace(id: string = 'space-1', name: string = 'Audit Committee', closedAt: Date | null = null): mjBizAppsCollaborationSpaceEntity {
    return {
        ID: id,
        Name: name,
        ClosedAt: closedAt,
        InheritsMembership: true,
    } as unknown as mjBizAppsCollaborationSpaceEntity;
}

function createMockSpaceType(code: string = 'example-board'): mjBizAppsCollaborationSpaceTypeEntity {
    return {
        Code: code,
        Name: 'Board',
    } as unknown as mjBizAppsCollaborationSpaceTypeEntity;
}

function createMockRules(): EffectiveSpaceRules {
    return {
        spaceTypeCode: 'example-board',
        vocabulary: 'committee',
        discoverability: 'Hidden',
        joinMode: 'InviteOnly',
        defaultBand: 'Team',
        inviteApproval: 'Approve',
        memberCap: null,
        messagingPanel: true,
        libraryPanel: true,
        workPanel: true,
        governancePanel: false,
        defaultRetention: 'Indefinite',
        defaultAgentRetrieval: 'Included',
        defaultAllowParentAssignees: true,
        inheritsMembership: false,
        postCloseAccess: 'ReadOnly',
        postCloseAccessDays: null,
        Chats: {
            WhoCanStart: 'Anyone',
            AgentReplyMode: 'MentionOrOneToOne',
            HistoryOnAdd: 'None',
        },
        SpaceOverridable: [],
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

    it('AdjustRules preserves and populates board chat rules', () => {
        const rules = createMockRules();
        const baseCtx = {
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            spaceType: createMockSpaceType(),
            effectiveRules: rules,
        };
        const adjusted = driver.AdjustRules(baseCtx, rules);
        expect(adjusted.Chats.WhoCanStart).toBe('Anyone');
        expect(adjusted.Chats.AgentReplyMode).toBe('MentionOrOneToOne');
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

    it('ValidateChildSpaceChange enforces InheritsMembership=false for sealed Compensation sub-committees', () => {
        const parentSpace = createMockSpace('b-1', 'Full Board');
        const childCompInheriting = {
            Name: 'Compensation Committee',
            InheritsMembership: true,
        } as unknown as mjBizAppsCollaborationSpaceEntity;

        const ctxRefused: ChildSpaceChangeContext = {
            kind: 'CreateChild',
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: parentSpace,
            childSpace: childCompInheriting,
            spaceType: createMockSpaceType(),
            effectiveRules: createMockRules(),
        };
        const res1 = driver.ValidateChildSpaceChange(ctxRefused);
        expect(res1.ok).toBe(false);
        expect(res1.field).toBe('InheritsMembership');

        const childCompSealed = {
            Name: 'Compensation Committee',
            InheritsMembership: false,
        } as unknown as mjBizAppsCollaborationSpaceEntity;
        const ctxAllowed: ChildSpaceChangeContext = {
            ...ctxRefused,
            childSpace: childCompSealed,
        };
        const res2 = driver.ValidateChildSpaceChange(ctxAllowed);
        expect(res2.ok).toBe(true);
    });

    it('ValidateMemberChange refuses assigning Outside Director to Team band', () => {
        const memberRefused = {
            Band: 'Team',
        } as unknown as mjBizAppsCollaborationSpaceMemberEntity;

        const ctxRefused: MemberChangeContext = {
            kind: 'Invite',
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            member: memberRefused,
            oldValues: { RoleTypeName: 'Outside Director' },
            spaceType: createMockSpaceType(),
            effectiveRules: createMockRules(),
        };
        const res1 = driver.ValidateMemberChange(ctxRefused);
        expect(res1.ok).toBe(false);
        expect(res1.field).toBe('Band');

        const memberAllowed = {
            Band: 'Shared',
        } as unknown as mjBizAppsCollaborationSpaceMemberEntity;
        const ctxAllowed: MemberChangeContext = {
            ...ctxRefused,
            member: memberAllowed,
        };
        const res2 = driver.ValidateMemberChange(ctxAllowed);
        expect(res2.ok).toBe(true);
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
            'members',
            'chat',
        ]);
        expect(tabs.find((t) => t.key === 'meetings')?.component).toBe(ExampleBoardMeetingsTab);
        expect(tabs.find((t) => t.key === 'papers')?.component).toBe(ExampleBoardPapersTab);
        expect(tabs.find((t) => t.key === 'motions')?.component).toBe(ExampleBoardMotionsTab);
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

    it('BeforeCloseSpace cancels when space has active votes', () => {
        const event: BeforeCloseSpaceEvent = {
            cancel: false,
            spaceId: 'space-with-active-vote',
        };
        uiDriver.BeforeCloseSpace(event);
        expect(event.cancel).toBe(true);
        expect(event.cancelReason).toContain('motions are open for voting');
    });

    it('BeforeCreateChildSpace prevents adding deal rooms under a board', () => {
        const event = {
            cancel: false,
            parentSpaceId: 'board-1',
            childTypeCode: 'deal-room',
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

    it('ValidateAnchor enforces valid Deal recordId and entityName', () => {
        const user = createMockUser();
        const provider = {} as unknown as IMetadataProvider;
        const type = createMockSpaceType('example-room');

        const noRecordCtx: AnchorContext = {
            actingUser: user,
            provider,
            spaceType: type,
            entityName: 'Deals',
            recordId: '',
        };
        expect(driver.ValidateAnchor(noRecordCtx).ok).toBe(false);

        const badEntityCtx: AnchorContext = {
            actingUser: user,
            provider,
            spaceType: type,
            entityName: 'UnrelatedEntity',
            recordId: 'deal-123',
        };
        expect(driver.ValidateAnchor(badEntityCtx).ok).toBe(false);

        const validCtx: AnchorContext = {
            actingUser: user,
            provider,
            spaceType: type,
            entityName: 'Deals',
            recordId: 'deal-123',
        };
        expect(driver.ValidateAnchor(validCtx).ok).toBe(true);
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

    it('ValidateMessage refuses confidential pricing floor codes in messages', () => {
        const baseCtx: MessageValidationContext = {
            actingUser: createMockUser(),
            provider: {} as unknown as IMetadataProvider,
            space: createMockSpace(),
            spaceType: createMockSpaceType('example-room'),
            effectiveRules: createMockRules(),
            chatId: 'chat-1',
            messageText: 'Hello team, the confidential deal floor is 100k.',
        };
        const res1 = driver.ValidateMessage(baseCtx);
        expect(res1.ok).toBe(false);
        expect(res1.message).toContain('Cannot post confidential margin');

        const res2 = driver.ValidateMessage({
            ...baseCtx,
            messageText: 'Please review the updated deliverables proposal.',
        });
        expect(res2.ok).toBe(true);
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

    it('SyncSeats filters out contacts who opted out of outreach', async () => {
        const space = createMockSpace('deal-space-1');
        const user = createMockUser();
        const provider = {} as unknown as IMetadataProvider;

        const people = [
            { Email: 'buyer.lead@acme.com', RoleTypeName: 'Buyer Contact' },
            { Email: 'unsubscribed.contact@acme.com-optout', RoleTypeName: 'Buyer Contact' },
            { Email: 'sales.exec@ourfirm.com', RoleTypeName: 'Deal Lead' },
        ];

        const res = await driver.SyncSeats(space, 'crm:roster', people, user, provider);
        expect(res).toBeDefined();
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
