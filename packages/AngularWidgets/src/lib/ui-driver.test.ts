import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Type } from '@angular/core';
import { MJGlobal } from '@memberjunction/global';
import {
    BaseSpaceTypeUIDriver,
    UIDriverRegistry,
    assembleSpaceContributions,
    type SpaceUIContext,
    type SpaceTabDescriptor,
    type SpaceOverviewCardDescriptor,
    type SpaceHeaderChipDescriptor,
    type SpaceHeaderActionDescriptor,
    type SpaceSettingsSectionDescriptor,
    type SpaceNewStepDescriptor,
    type BeforeInviteEvent,
    type BeforeCreateChildSpaceEvent,
    type BeforeStartChatEvent,
    type BeforeCloseSpaceEvent,
} from './base-space-type-ui-driver';
import { BaseSpaceTab } from './base-space-tab';
import { BaseSpaceOverviewCard } from './base-space-overview-card';
import { DEFAULT_SPACE_RULES } from '@mj-biz-apps/collaboration-core';

class CustomTestUIDriver extends BaseSpaceTypeUIDriver {
    public override GetTabs(ctx: SpaceUIContext, defaultTabs: SpaceTabDescriptor[]): SpaceTabDescriptor[] {
        // Filter out work tab, add custom tab
        return defaultTabs
            .filter((t) => t.key !== 'work')
            .concat([{ key: 'custom', label: 'Custom Tab', sortKey: 99 }]);
    }

    public override BeforeInvite(event: BeforeInviteEvent): void {
        if (event.email?.endsWith('@refused.com')) {
            event.cancel = true;
            event.cancelReason = 'Domain refused';
        }
    }

    public override BeforeCloseSpace(event: BeforeCloseSpaceEvent): void {
        event.cancel = true;
        event.cancelReason = 'Closing is disallowed by policy';
    }
}

class TestTabA extends BaseSpaceTab {}
class TestTabB extends BaseSpaceTab {}
class TestTabSuperseded extends BaseSpaceTab {}
class TestOverviewCardX extends BaseSpaceOverviewCard {}

describe('UI Driver & Extensibility Contributions', () => {
    beforeEach(() => {
        UIDriverRegistry.Instance.ClearCache();
    });

    describe('UIDriverRegistry', () => {
        it('returns singleton instance', () => {
            const i1 = UIDriverRegistry.Instance;
            const i2 = UIDriverRegistry.Instance;
            expect(i1).toBe(i2);
        });

        it('returns default driver when class name is empty, null, or whitespace', () => {
            const d1 = UIDriverRegistry.Instance.ResolveDriver();
            const d2 = UIDriverRegistry.Instance.ResolveDriver('');
            const d3 = UIDriverRegistry.Instance.ResolveDriver('   ');
            const d4 = UIDriverRegistry.Instance.ResolveDriver(null);

            expect(d1).toBeInstanceOf(BaseSpaceTypeUIDriver);
            expect(d2).toBe(d1);
            expect(d3).toBe(d1);
            expect(d4).toBe(d1);
        });

        it('warns and returns fallback default driver for unregistered class', () => {
            const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const driver = UIDriverRegistry.Instance.ResolveDriver('NonExistentUIDriver');
            expect(driver).toBeInstanceOf(BaseSpaceTypeUIDriver);
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("UI driver 'NonExistentUIDriver' not registered")
            );
            warnSpy.mockRestore();
        });

        it('resolves registered custom driver and caches instance', () => {
            MJGlobal.Instance.ClassFactory.Register(
                BaseSpaceTypeUIDriver,
                CustomTestUIDriver,
                'CustomTestUIDriver',
                1
            );

            const driver1 = UIDriverRegistry.Instance.ResolveDriver('CustomTestUIDriver');
            expect(driver1).toBeInstanceOf(CustomTestUIDriver);

            const driver2 = UIDriverRegistry.Instance.ResolveDriver('CustomTestUIDriver');
            expect(driver2).toBe(driver1);
        });
    });

    describe('BaseSpaceTypeUIDriver Default Behavior', () => {
        const dummyCtx: SpaceUIContext = {
            spaceTypeCode: 'project',
            rules: {
                ...DEFAULT_SPACE_RULES,
                Labels: {
                    Tabs: {
                        library: 'Vault',
                    },
                },
            },
        };

        it('returns default descriptors unchanged in base driver', () => {
            const driver = new BaseSpaceTypeUIDriver();

            const tabs: SpaceTabDescriptor[] = [{ key: 'overview', label: 'Overview' }];
            expect(driver.GetTabs(dummyCtx, tabs)).toBe(tabs);

            const cards: SpaceOverviewCardDescriptor[] = [{ key: 'summary', title: 'Summary' }];
            expect(driver.GetOverviewCards(dummyCtx, cards)).toBe(cards);

            const chips: SpaceHeaderChipDescriptor[] = [{ key: 'status', label: 'Active' }];
            expect(driver.GetHeaderChips(dummyCtx, chips)).toBe(chips);

            const actions: SpaceHeaderActionDescriptor[] = [{ key: 'edit', label: 'Edit', action: () => {} }];
            expect(driver.GetHeaderActions(dummyCtx, actions)).toBe(actions);

            const sections: SpaceSettingsSectionDescriptor[] = [{ key: 'general', title: 'General' }];
            expect(driver.GetSettingsSections(dummyCtx, sections)).toBe(sections);

            const steps: SpaceNewStepDescriptor[] = [{ key: 'basics', title: 'Basics', stepNumber: 1 }];
            expect(driver.GetNewSpaceSteps(dummyCtx, steps)).toBe(steps);

            expect(driver.GetDetailsForm(dummyCtx)).toBeUndefined();
            expect(driver.GetVocabulary(dummyCtx)).toBe('Space');
        });

        it('respects vocabulary and tab label overrides from rules', () => {
            const driver = new BaseSpaceTypeUIDriver();
            expect(driver.GetTabLabel(dummyCtx, 'library', 'Library')).toBe('Vault');
            expect(driver.GetTabLabel(dummyCtx, 'people', 'People')).toBe('People');
        });
    });

    describe('Custom UIDriver Overrides & Cancellable Events', () => {
        const dummyCtx: SpaceUIContext = {
            spaceTypeCode: 'board',
            rules: DEFAULT_SPACE_RULES,
        };

        it('allows custom driver to filter and augment tabs', () => {
            const driver = new CustomTestUIDriver();
            const initialTabs: SpaceTabDescriptor[] = [
                { key: 'overview', label: 'Overview', sortKey: 10 },
                { key: 'work', label: 'Tasks', sortKey: 20 },
                { key: 'people', label: 'People', sortKey: 30 },
            ];

            const result = driver.GetTabs(dummyCtx, initialTabs);
            expect(result.map((t) => t.key)).toEqual(['overview', 'people', 'custom']);
        });

        it('vetoes events via cancel and cancelReason', () => {
            const driver = new CustomTestUIDriver();

            const inviteAllowed: BeforeInviteEvent = {
                cancel: false,
                spaceId: 'sp-1',
                email: 'alice@allowed.com',
            };
            driver.BeforeInvite(inviteAllowed);
            expect(inviteAllowed.cancel).toBe(false);

            const inviteRefused: BeforeInviteEvent = {
                cancel: false,
                spaceId: 'sp-1',
                email: 'malicious@refused.com',
            };
            driver.BeforeInvite(inviteRefused);
            expect(inviteRefused.cancel).toBe(true);
            expect(inviteRefused.cancelReason).toBe('Domain refused');

            const closeEvent: BeforeCloseSpaceEvent = {
                cancel: false,
                spaceId: 'sp-1',
            };
            driver.BeforeCloseSpace(closeEvent);
            expect(closeEvent.cancel).toBe(true);
            expect(closeEvent.cancelReason).toBe('Closing is disallowed by policy');
        });
    });

    describe('assembleSpaceContributions', () => {
        it('discovers contributions, deduplicates by contributionKey with highest priority, and sorts by sortKey', () => {
            // Register contributions with metadata
            MJGlobal.Instance.ClassFactory.Register(
                BaseSpaceTab,
                TestTabSuperseded,
                'committees:meetings-low',
                1,
                true,
                false,
                {
                    spaceTypes: ['committee'],
                    contributionKey: 'meetings',
                    slot: 'tab',
                    sortKey: 40,
                    label: 'Old Meetings',
                }
            );

            MJGlobal.Instance.ClassFactory.Register(
                BaseSpaceTab,
                TestTabA,
                'committees:meetings-high',
                5,
                true,
                false,
                {
                    spaceTypes: ['committee'],
                    contributionKey: 'meetings',
                    slot: 'tab',
                    sortKey: 40,
                    label: 'Meetings',
                }
            );

            MJGlobal.Instance.ClassFactory.Register(
                BaseSpaceTab,
                TestTabB,
                'common:announcements',
                1,
                true,
                false,
                {
                    spaceTypes: ['*'], // wildcard for all space types
                    contributionKey: 'announcements',
                    slot: 'tab',
                    sortKey: 15,
                    label: 'Announcements',
                }
            );

            const defaultTabs: SpaceTabDescriptor[] = [
                { key: 'overview', label: 'Overview', sortKey: 10 },
                { key: 'library', label: 'Library', sortKey: 20 },
            ];

            const assembled = assembleSpaceContributions(
                BaseSpaceTab,
                'committee',
                defaultTabs,
                (reg, meta) => ({
                    key: meta.contributionKey,
                    label: meta.label ?? meta.contributionKey,
                    sortKey: meta.sortKey,
                    component: reg.SubClass as Type<BaseSpaceTab>,
                })
            );

            expect(assembled.map((t) => t.key)).toEqual([
                'overview',
                'announcements',
                'library',
                'meetings',
            ]);

            // Verify highest priority won for 'meetings'
            const meetingsTab = assembled.find((t) => t.key === 'meetings');
            expect(meetingsTab?.label).toBe('Meetings');
            expect(meetingsTab?.component).toBe(TestTabA);
        });

        it('ignores contributions registered for other space types', () => {
            MJGlobal.Instance.ClassFactory.Register(
                BaseSpaceOverviewCard,
                TestOverviewCardX,
                'deal:financials',
                1,
                true,
                false,
                {
                    spaceTypes: ['deal'],
                    contributionKey: 'financials',
                    slot: 'overview-card',
                    sortKey: 50,
                    title: 'Deal Financials',
                }
            );

            const defaultCards: SpaceOverviewCardDescriptor[] = [
                { key: 'welcome', title: 'Welcome', sortKey: 10 },
            ];

            const assembled = assembleSpaceContributions(
                BaseSpaceOverviewCard,
                'committee', // not 'deal'
                defaultCards,
                (reg, meta) => ({
                    key: meta.contributionKey,
                    title: meta.title ?? meta.contributionKey,
                    sortKey: meta.sortKey,
                    component: reg.SubClass as Type<BaseSpaceOverviewCard>,
                })
            );

            expect(assembled.map((c) => c.key)).toEqual(['welcome']);
        });
    });
});
