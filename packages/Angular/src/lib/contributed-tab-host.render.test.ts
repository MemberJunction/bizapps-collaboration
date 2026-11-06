// @vitest-environment jsdom
import '@angular/compiler';
import { Component, EventEmitter, type Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { NewSpaceMeetingDraft, SpaceMeetingCardItem } from '@mj-biz-apps/collaboration-ng-widgets';
import { CollabContributedTabHostDirective, type CreateSpaceMeetingEvent } from './contributed-tab-host.directive.ts';

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
});

function declareComponent(target: Type<unknown>, metadata: Component): void {
    Component({ standalone: true, ...metadata })(target);
}

class MeetingTabStub {
    public static latest: MeetingTabStub | null = null;
    public SpaceId = '';
    public SpaceTypeCode = '';
    public SpaceName = '';
    public CanSchedule = false;

    public CreateMeetingRequested = new EventEmitter<NewSpaceMeetingDraft>();
    public OpenMeetingChatRequested = new EventEmitter<SpaceMeetingCardItem>();
    public OpenMeetingRequested = new EventEmitter<SpaceMeetingCardItem>();

    public completed = false;
    public failedReason = '';

    constructor() {
        MeetingTabStub.latest = this;
    }

    public completeSchedule(): void {
        this.completed = true;
    }

    public failSchedule(reason: string): void {
        this.failedReason = reason;
    }
}
declareComponent(MeetingTabStub, {
    selector: 'meeting-tab-stub',
    template: '<div class="meeting-tab-stub">{{ SpaceName }}|{{ CanSchedule ? "can" : "cannot" }}|{{ CreateMeetingRequested.observed ? "observed" : "unobserved" }}</div>',
    inputs: ['SpaceId', 'SpaceTypeCode', 'SpaceName', 'CanSchedule'],
    outputs: ['CreateMeetingRequested', 'OpenMeetingChatRequested', 'OpenMeetingRequested'],
});

class MinimalTabStub {
    public SpaceId = '';
    public SpaceTypeCode = '';
}
declareComponent(MinimalTabStub, {
    selector: 'minimal-tab-stub',
    template: '<div class="minimal-tab-stub">{{ SpaceId }}:{{ SpaceTypeCode }}</div>',
    inputs: ['SpaceId', 'SpaceTypeCode'],
});

class HostShell {
    public ComponentType: Type<unknown> | null = MeetingTabStub;
    public TabInputs: Record<string, unknown> = {
        SpaceId: 'space-1',
        SpaceTypeCode: 'project',
        SpaceName: 'Northwind Rebrand',
        CanSchedule: true,
    };
    public created: CreateSpaceMeetingEvent[] = [];
    public chats: SpaceMeetingCardItem[] = [];
    public opened: SpaceMeetingCardItem[] = [];

    public onCreate(event: CreateSpaceMeetingEvent): void {
        this.created.push(event);
    }
    public onChat(item: SpaceMeetingCardItem): void {
        this.chats.push(item);
    }
    public onOpen(item: SpaceMeetingCardItem): void {
        this.opened.push(item);
    }
}
declareComponent(HostShell, {
    selector: 'host-shell',
    imports: [CommonModule, CollabContributedTabHostDirective],
    template: `
        <ng-container
            [mjcContributedTabHost]="ComponentType"
            [TabInputs]="TabInputs"
            (CreateMeetingRequested)="onCreate($event)"
            (OpenMeetingChatRequested)="onChat($event)"
            (OpenMeetingRequested)="onOpen($event)"
        ></ng-container>
    `,
});

describe('CollabContributedTabHostDirective', () => {
    it('forwards declared inputs and subscribes to CreateMeetingRequested, OpenMeetingChatRequested, and OpenMeetingRequested', async () => {
        const fixture = TestBed.createComponent(HostShell);
        fixture.detectChanges();
        await fixture.whenStable();

        const root = fixture.nativeElement as HTMLElement;
        expect(root.querySelector('.meeting-tab-stub')?.textContent).toBe('Northwind Rebrand|can|observed');

        const stub = MeetingTabStub.latest!;
        expect(stub).not.toBeNull();

        const draft: NewSpaceMeetingDraft = {
            Name: 'Q4 Audit Review',
            Description: 'Walkthrough',
            StartsAt: '2026-11-06T15:00:00.000Z',
            EndsAt: '2026-11-06T16:00:00.000Z',
            TimeZone: 'America/Chicago',
            LocationType: 'Virtual',
            Location: '',
            VideoJoinURL: 'https://meet.example.com/q4',
            Visibility: 'Standard',
        };
        stub.CreateMeetingRequested.emit(draft);
        expect(fixture.componentInstance.created).toHaveLength(1);
        expect(fixture.componentInstance.created[0].draft.Name).toBe('Q4 Audit Review');
        fixture.componentInstance.created[0].instance?.completeSchedule?.();
        expect(stub.completed).toBe(true);

        const meeting: SpaceMeetingCardItem = {
            ID: 'meeting-9',
            Name: 'Q4 Audit Review',
            StartsAt: '2026-11-06T15:00:00.000Z',
            EndsAt: '2026-11-06T16:00:00.000Z',
            TimeZone: 'America/Chicago',
            Status: 'Scheduled',
            LocationType: 'Virtual',
            Location: null,
            VideoJoinURL: null,
            Visibility: 'Standard',
        };
        stub.OpenMeetingChatRequested.emit(meeting);
        stub.OpenMeetingRequested.emit(meeting);
        expect(fixture.componentInstance.chats).toEqual([meeting]);
        expect(fixture.componentInstance.opened).toEqual([meeting]);
    });

    it('ignores undeclared inputs when mounting a minimal contributed tab component', async () => {
        const fixture = TestBed.createComponent(HostShell);
        fixture.componentInstance.ComponentType = MinimalTabStub;
        fixture.detectChanges();
        await fixture.whenStable();

        const root = fixture.nativeElement as HTMLElement;
        expect(root.querySelector('.minimal-tab-stub')?.textContent).toBe('space-1:project');
    });
});
