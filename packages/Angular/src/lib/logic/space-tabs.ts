import type { Type } from '@angular/core';
import type { BaseSpaceTab, SpaceTabDescriptor, TabItem } from '@mj-biz-apps/collaboration-ng-widgets';

/** A tab the app itself provides, with the panel of the space type that switches it on. */
export interface BuiltInTab {
    id: string;
    label: string;
    iconClass: string;
    /** The type's panel flag this tab needs; undefined means always offered. */
    panel?: 'MessagingPanel' | 'LibraryPanel' | 'WorkPanel';
    sortKey: number;
}

export const BUILT_IN_TABS: readonly BuiltInTab[] = [
    { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high', sortKey: 10 },
    { id: 'Library', label: 'Library', iconClass: 'fa-solid fa-folder-open', panel: 'LibraryPanel', sortKey: 20 },
    { id: 'Work', label: 'Work', iconClass: 'fa-solid fa-list-check', panel: 'WorkPanel', sortKey: 30 },
    { id: 'Chat', label: 'Chat', iconClass: 'fa-solid fa-comments', panel: 'MessagingPanel', sortKey: 40 },
    { id: 'People', label: 'People', iconClass: 'fa-solid fa-user-group', sortKey: 50 },
    { id: 'Settings', label: 'Settings', iconClass: 'fa-solid fa-sliders', sortKey: 100 },
];

/** Deep links spelled another way for the same tab. */
const ALIASES: Readonly<Record<string, string>> = { discussions: 'chat' };

/** One key scheme everywhere: the section, the deep links, the drivers and Labels.Tabs compare without case or padding. */
export function tabKey(key: string): string {
    const normalized = key.trim().toLowerCase();
    return ALIASES[normalized] ?? normalized;
}

export interface SpaceTabModel {
    /** In display order. Settings is included here; the screen shows it only to those who may configure. */
    tabs: TabItem[];
    /** The component of each tab a type or another app contributed, by tab id. Built-in tabs are drawn by the section. */
    contributed: ReadonlyMap<string, Type<BaseSpaceTab>>;
}

export interface SpaceTabInputs {
    /** Which panels the space type switches on. */
    panels: { MessagingPanel: boolean; LibraryPanel: boolean; WorkPanel: boolean };
    /** The type's UI driver's word on the tabs, given the built-in ones plus what other apps contributed. */
    finalize: (defaults: SpaceTabDescriptor[]) => SpaceTabDescriptor[];
    /** The label a tab reads with, from the type's and the space's Labels.Tabs. */
    labelFor: (key: string, defaultLabel: string) => string;
    /** Told the key of a tab that was dropped because it names no built-in tab and brings no component. */
    onDropped?: (key: string) => void;
}

/**
 * The tabs of a space: the built-in ones the type's panels allow, plus the contributed ones, as the type's driver arranged them.
 * A tab keeps the built-in tab's id when its key names one ('overview' is 'Overview'), so the screen's comparisons still hold.
 */
export function buildSpaceTabs(input: SpaceTabInputs): SpaceTabModel {
    const builtIns = BUILT_IN_TABS.filter((tab) => !tab.panel || input.panels[tab.panel]);
    const defaults: SpaceTabDescriptor[] = builtIns.map((tab) => ({ key: tab.id, label: tab.label, icon: tab.iconClass, sortKey: tab.sortKey }));
    // Whatever order the driver returned, the tabs read by sortKey (the sort is stable)
    const finalDescriptors = [...input.finalize(defaults)].sort((a, b) => (a.sortKey ?? 100) - (b.sortKey ?? 100));

    const contributed = new Map<string, Type<BaseSpaceTab>>();
    const tabs: TabItem[] = [];
    const seen = new Set<string>();
    for (const descriptor of finalDescriptors) {
        const key = tabKey(descriptor.key);
        if (seen.has(key)) continue;
        const builtIn = BUILT_IN_TABS.find((tab) => tabKey(tab.id) === key);
        // A panel the type turns off stays off, whichever driver names the tab
        if (builtIn?.panel && !input.panels[builtIn.panel]) continue;
        seen.add(key);
        const id = builtIn?.id ?? descriptor.key;
        if (!builtIn && descriptor.component) contributed.set(id, descriptor.component);
        // A tab without a component that names no built-in tab has nothing to show
        if (!builtIn && !descriptor.component) {
            input.onDropped?.(descriptor.key);
            continue;
        }
        tabs.push({
            id,
            label: input.labelFor(descriptor.key, descriptor.label),
            iconClass: descriptor.icon ?? builtIn?.iconClass,
            count: descriptor.badgeCount,
        });
    }
    return { tabs, contributed };
}

/** The tab a deep link names, as this space's tab id, or null when the space has no such tab. */
export function resolveTabId(model: SpaceTabModel, key: string): string | null {
    const wanted = tabKey(key);
    return model.tabs.find((tab) => tabKey(tab.id) === wanted)?.id ?? null;
}

/**
 * `buildSpaceTabs`, for a driver that may throw: on a failure the error goes to `onError` and the space still gets its built-in
 * tabs (the ones its type's panels allow), so one faulty driver or contribution can't take a space down.
 */
export function buildSpaceTabsSafely(
    input: SpaceTabInputs,
    onError: (error: unknown) => void,
    fallbackLabelFor: (key: string, defaultLabel: string) => string = (_key, label) => label,
): SpaceTabModel {
    try {
        return buildSpaceTabs(input);
    } catch (error) {
        onError(error);
        return buildSpaceTabs({ panels: input.panels, finalize: (defaults) => defaults, labelFor: fallbackLabelFor });
    }
}
