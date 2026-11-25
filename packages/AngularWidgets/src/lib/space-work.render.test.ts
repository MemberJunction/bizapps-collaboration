// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { CollabSpaceWorkComponent } from './space-work.component.ts';
import type { TaskItemModel } from './types';

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
});

const HIERARCHICAL_TASKS: TaskItemModel[] = [
    {
        id: 'phase-1',
        name: 'Discovery Phase',
        status: 'InProgress',
        priority: 'High',
        band: 'Shared',
        kindLabel: 'Phase',
        sequence: 1,
        percentComplete: null,
    },
    {
        id: 'task-1',
        name: 'Publish charter',
        parentId: 'phase-1',
        status: 'Completed',
        priority: 'Medium',
        band: 'Shared',
        assigneeNames: ['Ada Lovelace'],
        sequence: 1,
        percentComplete: 100,
    },
    {
        id: 'task-2',
        name: 'Internal staffing plan',
        parentId: 'phase-1',
        status: 'Blocked',
        priority: 'Critical',
        band: 'Team',
        blockedReason: 'Pending budget approval',
        sequence: 2,
        percentComplete: 20,
    },
];

describe('CollabSpaceWorkComponent (rendered with WBS tree)', () => {
    it('renders hierarchical WBS codes, band chips, and blocked callout for Team viewers', async () => {
        const fixture = TestBed.createComponent(CollabSpaceWorkComponent);
        fixture.componentRef.setInput('Tasks', HIERARCHICAL_TASKS);
        fixture.componentRef.setInput('CanSeeTeamSide', true);
        fixture.componentRef.setInput('ReadOnly', false);
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('mjt-wbs-tree')).not.toBeNull();

        const codes = Array.from(host.querySelectorAll('.mjt-wbs-code')).map((el) => el.textContent?.trim());
        expect(codes).toEqual(['1', '1.1', '1.2']);

        const chips = Array.from(host.querySelectorAll('mjc-band-chip')).map((el) => el.textContent?.trim());
        expect(chips).toEqual(['Shared', 'Shared', 'Team']);

        expect(host.textContent).toContain('Pending budget approval');
        expect(host.textContent).toContain('Team');
    });

    it('strips Team tasks and hides the Team filter chip when CanSeeTeamSide is false', async () => {
        const fixture = TestBed.createComponent(CollabSpaceWorkComponent);
        fixture.componentRef.setInput('Tasks', HIERARCHICAL_TASKS);
        fixture.componentRef.setInput('CanSeeTeamSide', false);
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.textContent).toContain('Discovery Phase');
        expect(host.textContent).toContain('Publish charter');
        expect(host.textContent).not.toContain('Internal staffing plan');
        expect(host.textContent).not.toContain('Pending budget approval');

        const audienceGroup = host.querySelector('[aria-label="Audience"]');
        expect(audienceGroup?.textContent).toContain('Shared');
        expect(audienceGroup?.textContent).not.toContain('Team');
    });

    it('emits TaskSelectRequested when clicking a WBS row and respects ReadOnly', async () => {
        const fixture = TestBed.createComponent(CollabSpaceWorkComponent);
        fixture.componentRef.setInput('Tasks', HIERARCHICAL_TASKS);
        fixture.componentRef.setInput('CanSeeTeamSide', true);
        fixture.componentRef.setInput('ReadOnly', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const selected = vi.fn();
        fixture.componentInstance.TaskSelectRequested.subscribe(selected);

        const firstRow = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.mjt-wbs-row');
        expect(firstRow).not.toBeNull();
        firstRow?.click();
        expect(selected).toHaveBeenCalledWith(HIERARCHICAL_TASKS[0]);

        // ReadOnly hides completion rings
        expect((fixture.nativeElement as HTMLElement).querySelector('mjt-completion-ring')).toBeNull();
    });
});
