/**
 * SPDX-License-Identifier: BUSL-1.1
 *
 * Render & interaction tests for `<mjc-artifact-slideover>` and `<mjc-space-chat>` artifact handoff.
 */
// @vitest-environment jsdom
import '@angular/compiler';
import { Component, ContentChildren, EventEmitter, QueryList, type TemplateRef, type Type } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { CompositeKey, UserInfo } from '@memberjunction/core';
import {
  BeforeArtifactPanelOpenEventArgs,
  ChatSlotDirective,
  ConversationStreamingService,
} from '@memberjunction/ng-conversations';
import {
  MJButtonDirective,
  MJMenuComponent,
  MJMenuItemComponent,
  MJMenuTriggerDirective,
} from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import {
  CollabArtifactSlideoverComponent,
  normalizeArtifactOpenRequest,
  type SpaceArtifactOpenRequest,
} from './artifact-slideover.component.ts';
import { CollabAnswerSourceReceiptsComponent } from './answer-source-receipts.component.ts';
import { CollabAvatarComponent } from './avatar.component.ts';
import { CollabBandChipComponent } from './band-chip.component.ts';
import { CollabChatScopeBarComponent, CollabSpaceChatComponent } from './space-chat.component.ts';

beforeAll(() => {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

function declareComponent(target: Type<object>, metadata: Component): void {
  Component({ standalone: true, ...metadata })(target);
}

class ArtifactViewerPanelStub {
  public artifactId = '';
  public CurrentUser: UserInfo | null = null;
  public EnvironmentId = '';
  public VersionNumber?: number;
  public ShowHeader = true;
  public ShowTabs = true;
  public ShowCloseButton = true;
  public ShowMaximizeButton = true;
  public ShowSaveToCollection = false;
  public CanEdit = false;
  public canShare = false;
  public IsMaximized = false;

  public Closed = new EventEmitter<void>();
  public MaximizeToggled = new EventEmitter<void>();
  public OpenArtifactRequested = new EventEmitter<string>();
  public OpenEntityRecord = new EventEmitter<{ entityName: string; compositeKey: CompositeKey }>();
  public VersionSaved = new EventEmitter<object>();
}
declareComponent(ArtifactViewerPanelStub, {
  selector: 'mj-artifact-viewer-panel',
  template: `<div data-testid="stub-artifact-viewer" [attr.data-artifact-id]="artifactId" [attr.data-version]="VersionNumber ?? ''" [attr.data-maximized]="IsMaximized"></div>`,
  inputs: [
    'artifactId',
    'CurrentUser',
    'EnvironmentId',
    'VersionNumber',
    'ShowHeader',
    'ShowTabs',
    'ShowCloseButton',
    'ShowMaximizeButton',
    'ShowSaveToCollection',
    'CanEdit',
    'canShare',
    'IsMaximized',
  ],
  outputs: ['Closed', 'MaximizeToggled', 'OpenArtifactRequested', 'OpenEntityRecord', 'VersionSaved'],
});

class ChatAreaArtifactStub {
  @ContentChildren(ChatSlotDirective) public slots?: QueryList<ChatSlotDirective>;
  public get header(): TemplateRef<object> | null {
    return this.slots?.find((slot) => slot.SlotName === 'header')?.Template ?? null;
  }
  public get messageExtra(): TemplateRef<object> | null {
    return this.slots?.find((slot) => slot.SlotName === 'messageExtra')?.Template ?? null;
  }
  public DisplayMessages: Array<Record<string, string | number | boolean | object | null | undefined>> = [];
  public BeforeAgentTurn = new EventEmitter<object>();
  public AfterAgentTurn = new EventEmitter<object>();
  public OpenEntityRecord = new EventEmitter<{ entityName: string; compositeKey: CompositeKey }>();
  public BeforeArtifactPanelOpen = new EventEmitter<BeforeArtifactPanelOpenEventArgs>();
  public ComposerDraftConsumed = new EventEmitter<void>();
  public PendingMessageConsumed = new EventEmitter<void>();
}
declareComponent(ChatAreaArtifactStub, {
  selector: 'mj-conversation-chat-area',
  imports: [NgTemplateOutlet],
  template: `<ng-content></ng-content><ng-container *ngTemplateOutlet="header"></ng-container>`,
  inputs: [
    'EnvironmentId', 'CurrentUser', 'ConversationId', 'ApplicationScope', 'ApplicationId', 'LinkedEntityId', 'LinkedRecordId', 'DefaultAgentId',
    'assistantDisplayName', 'ReadOnly', 'ReadOnlyMessage', 'AllowMentions', 'AllowEntityMentions', 'AllowSkillCommands', 'AllowAttachments', 'AllowRealtime',
    'CollapseThreadReplies', 'ShowAgentCharacter', 'AgentReplyMode', 'AllowedAgentIDs', 'EnableDecisionRouting', 'MentionPeople', 'AgentHistoryFrom',
    'AgentTurnHandler', 'AutoNameConversation', 'ComposerDraft', 'PendingMessage', 'PendingMessageConversationId',
  ],
  outputs: ['BeforeAgentTurn', 'AfterAgentTurn', 'OpenEntityRecord', 'BeforeArtifactPanelOpen', 'ComposerDraftConsumed', 'PendingMessageConsumed'],
});

describe('CollabArtifactSlideoverComponent', () => {
  const testUser = Object.assign(new UserInfo(), { ID: 'user-1', Name: 'Alex Rivera' });

  function renderSlideover(inputs: Record<string, string | number | boolean | UserInfo | null | undefined>) {
    TestBed.overrideComponent(CollabArtifactSlideoverComponent, {
      set: { imports: [ArtifactViewerPanelStub] },
    });
    const fixture = TestBed.createComponent(CollabArtifactSlideoverComponent);
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('normalizes string and object open requests', () => {
    expect(normalizeArtifactOpenRequest('  art-1  ')).toEqual({ artifactId: 'art-1' });
    expect(normalizeArtifactOpenRequest({ artifactId: 'art-2', versionNumber: 3, title: 'Deck' })).toEqual({
      artifactId: 'art-2',
      versionNumber: 3,
      title: 'Deck',
    });
    expect(normalizeArtifactOpenRequest('   ')).toBeNull();
    expect(normalizeArtifactOpenRequest(null)).toBeNull();
  });

  it('renders an accessible right-hand dialog with <mj-artifact-viewer-panel> when open, and hides when closed', () => {
    const fixture = renderSlideover({
      IsOpen: true,
      ArtifactId: 'art-111',
      VersionNumber: 2,
      Title: 'Q3 Roadmap',
      CurrentUser: testUser,
    });

    const host = fixture.nativeElement as HTMLElement;
    const sheet = host.querySelector('[data-testid="artifact-slideover-sheet"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');
    expect(sheet?.getAttribute('aria-label')).toBe('Q3 Roadmap');

    const viewerEl = host.querySelector('[data-testid="stub-artifact-viewer"]');
    expect(viewerEl?.getAttribute('data-artifact-id')).toBe('art-111');
    expect(viewerEl?.getAttribute('data-version')).toBe('2');

    fixture.componentRef.setInput('IsOpen', false);
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="artifact-slideover-sheet"]')).toBeNull();
  });

  it('closes on Escape key and backdrop click, and ignores clicks inside the sheet', () => {
    const fixture = renderSlideover({
      IsOpen: true,
      ArtifactId: 'art-222',
      CurrentUser: testUser,
    });
    const closed = vi.fn();
    fixture.componentInstance.Closed.subscribe(closed);

    const host = fixture.nativeElement as HTMLElement;
    const sheet = host.querySelector<HTMLElement>('[data-testid="artifact-slideover-sheet"]')!;
    sheet.click();
    expect(closed).toHaveBeenCalledTimes(0);

    const backdrop = host.querySelector<HTMLElement>('[data-testid="artifact-slideover-backdrop"]')!;
    backdrop.click();
    expect(closed).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toHaveBeenCalledTimes(2);
  });

  it('switches artifacts in-place on related artifact & MJ: Artifacts record link clicks, toggles maximize, and forwards non-artifact records', () => {
    const fixture = renderSlideover({
      IsOpen: true,
      ArtifactId: 'art-1',
      CurrentUser: testUser,
    });
    const selected: string[] = [];
    const openedRecords: Array<{ entityName: string; compositeKey: CompositeKey }> = [];
    fixture.componentInstance.ArtifactSelected.subscribe((id) => selected.push(id));
    fixture.componentInstance.OpenEntityRecordRequested.subscribe((ev) => openedRecords.push(ev));

    const stub = fixture.debugElement.query((n) => n.name === 'mj-artifact-viewer-panel').injector.get(ArtifactViewerPanelStub);

    stub.MaximizeToggled.emit();
    fixture.detectChanges();
    expect(fixture.componentInstance.isMaximized).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="artifact-slideover-sheet"]')?.classList.contains('is-maximized'),
    ).toBe(true);

    stub.OpenArtifactRequested.emit('art-related-2');
    fixture.detectChanges();
    expect(selected).toEqual(['art-related-2']);
    expect(fixture.componentInstance.activeArtifactId).toBe('art-related-2');

    stub.OpenEntityRecord.emit({ entityName: 'MJ: Artifacts', compositeKey: CompositeKey.FromID('art-linked-3') });
    fixture.detectChanges();
    expect(selected).toEqual(['art-related-2', 'art-linked-3']);
    expect(openedRecords).toHaveLength(0);

    stub.OpenEntityRecord.emit({ entityName: 'MJ: Tasks', compositeKey: CompositeKey.FromID('task-9') });
    expect(openedRecords).toHaveLength(1);
    expect(openedRecords[0]?.entityName).toBe('MJ: Tasks');
  });

  it('cancels built-in chat artifact panel and forwards MJ: Artifacts clicks to ArtifactOpenRequested in CollabSpaceChatComponent', () => {
    TestBed.overrideProvider(ConversationStreamingService, { useValue: { initialize: vi.fn() } });
    TestBed.overrideComponent(CollabSpaceChatComponent, {
      set: {
        imports: [
          CollabAnswerSourceReceiptsComponent,
          CollabAvatarComponent,
          CollabBandChipComponent,
          CollabChatScopeBarComponent,
          MJButtonDirective,
          MJMenuComponent,
          MJMenuItemComponent,
          MJMenuTriggerDirective,
          SharedGenericModule,
          ChatSlotDirective,
          ChatAreaArtifactStub,
        ],
      },
    });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    const openedArtifacts: SpaceArtifactOpenRequest[] = [];
    fixture.componentInstance.ArtifactOpenRequested.subscribe((req) => openedArtifacts.push(req));

    fixture.componentRef.setInput('ConversationId', 'conv-1');
    fixture.componentRef.setInput('SpaceId', 'space-1');
    fixture.componentRef.setInput('CurrentUser', testUser);
    fixture.detectChanges();

    const chatStub = fixture.debugElement.query((n) => n.name === 'mj-conversation-chat-area').injector.get(ChatAreaArtifactStub);

    const beforeArgs = new BeforeArtifactPanelOpenEventArgs('art-card-1', 4);
    chatStub.BeforeArtifactPanelOpen.emit(beforeArgs);
    expect(beforeArgs.Cancel).toBe(true);
    expect(openedArtifacts).toEqual([{ artifactId: 'art-card-1', versionNumber: 4 }]);

    chatStub.OpenEntityRecord.emit({ entityName: 'MJ: Artifacts', compositeKey: CompositeKey.FromID('art-link-2') });
    expect(openedArtifacts).toEqual([
      { artifactId: 'art-card-1', versionNumber: 4 },
      { artifactId: 'art-link-2' },
    ]);
  });
});
