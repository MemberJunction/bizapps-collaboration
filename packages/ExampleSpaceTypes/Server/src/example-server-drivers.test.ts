import { describe, it, expect, beforeEach } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import { ExampleBoardServerDriver } from './index.js';
import {
    BaseSpaceTypeServerDriver,
    type SpaceChangeContext,
    type ChildSpaceChangeContext,
    type MemberChangeContext,
    type AgentContextParams,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { DEFAULT_COLLABORATION_SETTINGS, type EffectiveSpaceConfiguration, type EffectiveSpaceRules, ResolveSpaceConfiguration } from '@mj-biz-apps/collaboration-core';
import {
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
    type mjBizAppsCollaborationSpaceMemberEntity,
} from '@mj-biz-apps/collaboration-entities';
import { type UserInfo, type IMetadataProvider } from '@memberjunction/core';
import { CollaborationEngine, evaluateCanStartSpaceConversation } from '@mj-biz-apps/collaboration-core-entities-server';

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

/** The one configuration (B16) with the app's defaults and no grants, as a board with nothing configured resolves to. */
function createMockConfiguration(): EffectiveSpaceConfiguration {
    return ResolveSpaceConfiguration({ App: { Settings: DEFAULT_COLLABORATION_SETTINGS, Grants: [] }, Type: null, Spaces: [{ ID: 'space-1', TypeID: null, Settings: null, Grants: [] }] });
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
            configuration: createMockConfiguration(),
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
            configuration: createMockConfiguration(),
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
                configuration: createMockConfiguration(),
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
        // A quorum change whose new value can't be read is refused, not passed: the rule has nothing to compare
        const unreadable = update(null, 60, 50);
        (unreadable.space as unknown as { LeafEntity: { QuorumPercentage: unknown } }).LeafEntity = { QuorumPercentage: undefined };
        const refused = driver.ValidateSpaceChange(unreadable);
        expect(refused.ok).toBe(false);
        expect(refused.message).toContain("can't be judged");
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
            configuration: createMockConfiguration(),
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
            configuration: createMockConfiguration(),
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
            configuration: createMockConfiguration(),
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
            configuration: createMockConfiguration(),
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
            configuration: createMockConfiguration(),
        };
        const result = driver.BuildAgentContext(ctx);
        expect(result.instructions?.some((i) => i.includes('Audit Committee'))).toBe(true);
        expect(result.contextData?.['term']).toBe('FY2026');
        expect(result.contextData?.['quorumPercent']).toBe(50);
    });
});
