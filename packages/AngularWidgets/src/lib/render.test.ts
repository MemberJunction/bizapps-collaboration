// @vitest-environment jsdom
import '@angular/compiler';
import { Component, ContentChildren, EventEmitter, QueryList, type TemplateRef, type Type } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { MJButtonDirective, MJConfirmService, MJDialogComponent } from '@memberjunction/ng-ui-components';
import type { UserInfo } from '@memberjunction/core';
import { ChatSlotDirective, ConversationStreamingService } from '@memberjunction/ng-conversations';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { CollabBandChipComponent } from './band-chip.component.ts';
import { CollabItemRowComponent } from './item-row.component.ts';
import { CollabSpaceChatComponent } from './space-chat.component.ts';
import { CollabNewConversationDialogComponent } from './new-conversation-dialog.component.ts';
import { CollabHomeListComponent, type HomeListRow } from './home-list.component.ts';
import { CollabNewSpaceDialogComponent, type NewSpaceTypeOption } from './new-space-dialog.component.ts';
import { CollabShareCheckDialogComponent } from './share-check-dialog.component.ts';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpacePageBlock } from './base-space-page-block.ts';
import { CollabSpaceHeaderComponent } from './space-header.component.ts';
import { CollabSpaceOverviewComponent } from './space-overview.component.ts';
import { CollabSpacePagesComponent } from './space-pages.component.ts';
import { CollabSpaceRailComponent } from './space-rail.component.ts';
import { CollabSpaceSettingsComponent } from './space-settings.component.ts';
import { CollabUploadDialogComponent } from './upload-dialog.component.ts';
import type { CollabPageModel, SpaceSettingsModel } from './types';

const settings: SpaceSettingsModel = {
  id: 's1', name: 'Northwind', description: '', spaceType: 'Workspace', spaceTypeId: 't1', iconClass: 'fa-solid fa-briefcase', color: '#0076b6',
  backgroundImageUrl: '', inheritsMembership: true, agentRetrieval: 'Included', status: 'Active',
};

beforeAll(() => {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const escape = (): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
};

describe('Settings, rendered', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(CollabSpaceSettingsComponent);
    fixture.componentRef.setInput('Settings', settings);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    return fixture;
  }

  it('shows read-only Settings with the note and Close, and no form, to someone who may only close', async () => {
    const fixture = render({ CanEdit: false, ReadOnlyNote: "You can close this space, but you can't change its settings." });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain("You can close this space, but you can't change its settings.");
    expect(host.textContent).toContain('Close…');
    expect(host.querySelector('input')).toBeNull();
    expect(host.textContent).not.toContain('Save changes');
  });

  it('shows the form and Save, without a close button, to an owner who may configure but not close', async () => {
    const fixture = render({ CanEdit: true, CanChangeLifecycle: false });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('input')).not.toBeNull();
    expect(host.textContent).toContain('Save changes');
    expect(host.textContent).not.toContain('Close…');
  });

  it('asks before closing, and emits once when confirmed', async () => {
    const fixture = render({ CanEdit: true, CloseConsequence: 'It disappears for everyone but Ada Owner, who can reopen it.' });
    const closed = vi.fn();
    fixture.componentInstance.CloseSpaceRequested.subscribe(closed);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Close…'))!.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Close this space? It disappears for everyone but Ada Owner, who can reopen it.');
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Close space'))!.click();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('disables Close and Reopen while a change is with the server', async () => {
    const fixture = render({ CanEdit: true, IsBusy: true });
    await fixture.whenStable();
    const ask = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Close…'))!;
    expect(ask.disabled).toBe(true);
  });
});

describe('agent retrieval in Settings, rendered', () => {
  const radios = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLInputElement>('input[name="agentRetrieval"]'));

  it("is offered only to someone who holds the Administer Spaces authorization: the rest see it off, with the reason", async () => {
    const without = TestBed.createComponent(CollabSpaceSettingsComponent);
    without.componentRef.setInput('Settings', settings);
    without.componentRef.setInput('CanEdit', true);
    await without.whenStable();
    const host = without.nativeElement as HTMLElement;
    expect(radios(host).length).toBeGreaterThan(0);
    expect(radios(host).every((radio) => radio.disabled)).toBe(true);
    expect(host.textContent).toContain('Only someone with the Administer Spaces authorization can change this.');
    // The radios are off, so they can't be focused: the group is what a screen reader lands on, and it points at the reason
    const group = host.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-describedby')).toBe('settings-retrieval-note');
    expect(host.querySelector('#settings-retrieval-note')?.textContent).toContain('Administer Spaces');
    without.destroy();

    const withIt = TestBed.createComponent(CollabSpaceSettingsComponent);
    withIt.componentRef.setInput('Settings', settings);
    withIt.componentRef.setInput('CanEdit', true);
    withIt.componentRef.setInput('CanAdminister', true);
    await withIt.whenStable();
    const allowed = withIt.nativeElement as HTMLElement;
    expect(radios(allowed).every((radio) => !radio.disabled)).toBe(true);
    expect(allowed.textContent).not.toContain('Only someone with the Administer Spaces authorization');
    expect(allowed.querySelector('[role="radiogroup"]')!.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('the Team row, rendered', () => {
  it('keeps Share a control of its own: a key press on it does not reach a row control, and a click shares without selecting', async () => {
    const fixture = TestBed.createComponent(CollabItemRowComponent);
    fixture.componentRef.setInput('Title', 'Engagement letter');
    fixture.componentRef.setInput('CanShare', true);
    const shared = vi.fn();
    const selected = vi.fn();
    fixture.componentInstance.ShareRequested.subscribe(shared);
    fixture.componentInstance.RowSelectRequested.subscribe(selected);
    await fixture.whenStable();
    const share = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.share-btn')!;
    // Were the keyboard control on the whole row, this keydown would bubble to it and select the row
    share.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selected).not.toHaveBeenCalled();
    share.click();
    expect(shared).toHaveBeenCalledTimes(1);
    expect(selected).not.toHaveBeenCalled();
  });

  it('selects the row from the keyboard through its name block', async () => {
    const fixture = TestBed.createComponent(CollabItemRowComponent);
    fixture.componentRef.setInput('Title', 'Engagement letter');
    const selected = vi.fn();
    fixture.componentInstance.RowSelectRequested.subscribe(selected);
    await fixture.whenStable();
    const block = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.open-block')!;
    block.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selected).toHaveBeenCalledTimes(1);
  });
});

describe('the rail, rendered', () => {
  it('lists conversations only for a space whose type has a Chat tab', async () => {
    const chat = { id: 'Chat', label: 'Chat', iconClass: 'fa-solid fa-comments' };
    const overview = { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high' };
    const without = TestBed.createComponent(CollabSpaceRailComponent);
    without.componentRef.setInput('Mode', 'space');
    without.componentRef.setInput('Tabs', [overview]);
    without.detectChanges();
    expect((without.nativeElement as HTMLElement).textContent).not.toContain('Conversations');
    without.destroy();
    const withChat = TestBed.createComponent(CollabSpaceRailComponent);
    withChat.componentRef.setInput('Mode', 'space');
    withChat.componentRef.setInput('Tabs', [overview, chat]);
    withChat.detectChanges();
    expect((withChat.nativeElement as HTMLElement).textContent).toContain('Conversations');
  });

  it('lets the collapsed space switcher tile open the space switcher popover and return to All spaces', async () => {
    const fixture = TestBed.createComponent(CollabSpaceRailComponent);
    fixture.componentRef.setInput('SpaceTitle', 'Northwind');
    fixture.componentRef.setInput('Mode', 'space');
    fixture.componentInstance.isCollapsed = true;
    const back = vi.fn();
    fixture.componentInstance.BackToSpacesRequested.subscribe(back);
    fixture.detectChanges();
    await fixture.whenStable();
    const tile = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.collapsed-tile')!;
    expect(tile.tagName).toBe('BUTTON');
    expect(tile.getAttribute('aria-haspopup')).toBe('dialog');
    tile.click();
    fixture.detectChanges();
    const allSpacesBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="switcher-all-spaces"]')!;
    expect(allSpacesBtn).not.toBeNull();
    allSpacesBtn.click();
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('the header and page edit bar, rendered', () => {
  it('shows breadcrumbs only for a sub-space (ending at the parent space) and routes Invite, New sub-space, Edit page, New page, and Space settings through the mj-menu ⋯ trigger', async () => {
    const fixture = TestBed.createComponent(CollabSpaceHeaderComponent);
    fixture.componentRef.setInput('Title', 'Northwind');
    fixture.componentRef.setInput('Breadcrumbs', [{ label: 'Spaces' }, { label: 'Northwind' }]);
    fixture.componentRef.setInput('CanInvite', true);
    fixture.componentRef.setInput('CanAddSubSpace', true);
    fixture.componentRef.setInput('CanEditPages', true);
    fixture.componentRef.setInput('CanEditCurrentPage', true);
    fixture.componentRef.setInput('CanConfigure', true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.crumbs')).toBeNull();

    fixture.componentRef.setInput('Breadcrumbs', [
      { label: 'Spaces' },
      { label: 'Board of Directors', spaceId: 'parent-1' },
      { label: 'Audit Committee', spaceId: 'sub-1' },
    ]);
    fixture.detectChanges();
    const crumbs = root.querySelector('.crumbs');
    expect(crumbs).not.toBeNull();
    expect(crumbs?.textContent).toContain('Board of Directors');
    expect(crumbs?.textContent).not.toContain('Audit Committee');

    const moreBtn = root.querySelector<HTMLButtonElement>('[data-testid="space-header-more-btn"]')!;
    expect(moreBtn).not.toBeNull();
    moreBtn.click();
    fixture.detectChanges();
    expect(document.body.querySelector('[data-testid="space-header-more-menu"]')).not.toBeNull();

    const editRequested = vi.fn();
    fixture.componentInstance.EditPageRequested.subscribe(editRequested);
    const editItem = document.body.querySelector<HTMLElement>('[data-testid="header-menu-edit-page"] button, [data-testid="header-menu-edit-page"]')!;
    editItem.click();
    fixture.detectChanges();
    expect(editRequested).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('hides the page edit bar for viewers and shows Editing · Draft with [Publish] [Discard] in edit mode, confirming discard via MJConfirmService', async () => {
    const confirmMock = { Confirm: vi.fn().mockResolvedValue(true) };
    TestBed.overrideComponent(CollabSpacePagesComponent, {
      add: { providers: [{ provide: MJConfirmService, useValue: confirmMock }] },
    });
    const fixture = TestBed.createComponent(CollabSpacePagesComponent);
    fixture.componentRef.setInput('CanWrite', true);
    fixture.componentRef.setInput('Pages', [
      {
        id: 'p1',
        title: 'Overview',
        iconClass: 'fa-solid fa-compass',
        pageType: 'Overview',
        band: 'Shared',
        status: 'Published',
        sequence: 0,
        collaborative: true,
        summary: 'Welcome',
        body: 'Initial body',
        blocks: [],
        comments: [],
        updatedLabel: 'Just now',
        authorName: 'Ada',
      },
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="page-edit-bar"]')).toBeNull();

    fixture.componentRef.setInput('IsCustomizing', true);
    fixture.detectChanges();
    const bar = root.querySelector<HTMLElement>('[data-testid="page-edit-bar"]')!;
    expect(bar).not.toBeNull();
    expect(bar.textContent).toContain('Editing · Draft');
    const buttons = Array.from(bar.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Publish', 'Discard']);

    fixture.componentInstance.editSessionDirty = true;
    await fixture.componentInstance.discardChanges(fixture.componentInstance.activePage!);
    expect(confirmMock.Confirm).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.isCustomizing).toBe(false);
  });
});

describe('the dialogs, rendered', () => {
  it('closes each dialog on Escape, and not the upload while it is saving', async () => {
    const upload = TestBed.createComponent(CollabUploadDialogComponent);
    const uploadCancelled = vi.fn();
    upload.componentInstance.CancelRequested.subscribe(uploadCancelled);
    upload.detectChanges();
    await upload.whenStable();
    escape();
    expect(uploadCancelled).toHaveBeenCalledTimes(1);
    upload.componentRef.setInput('IsSubmitting', true);
    upload.detectChanges();
    escape();
    expect(uploadCancelled).toHaveBeenCalledTimes(1);
    upload.destroy();

    const convo = TestBed.createComponent(CollabNewConversationDialogComponent);
    const convoCancelled = vi.fn();
    convo.componentInstance.CancelRequested.subscribe(convoCancelled);
    convo.detectChanges();
    escape();
    expect(convoCancelled).toHaveBeenCalledTimes(1);
    convo.destroy();

    const share = TestBed.createComponent(CollabShareCheckDialogComponent);
    const shareCancelled = vi.fn();
    share.componentInstance.CancelRequested.subscribe(shareCancelled);
    share.detectChanges();
    escape();
    expect(shareCancelled).toHaveBeenCalledTimes(1);
  });

  it('names the share dialog, draws one close button, and holds Share and Cancel in the actions', async () => {
    const fixture = TestBed.createComponent(CollabShareCheckDialogComponent);
    fixture.componentRef.setInput('Title', 'Share Engagement letter with the client');
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.mj-dialog-container')!.getAttribute('aria-labelledby')).toMatch(/^mj-dialog-title-/);
    expect(host.querySelector('.mj-dialog-title')?.textContent).toContain('Share Engagement letter with the client');
    expect(host.querySelectorAll('[aria-label="Close dialog"]')).toHaveLength(1);
    const actions = host.querySelector('mj-dialog-actions')!;
    expect(actions.textContent).toContain('Share');
    expect(actions.textContent).toContain('Cancel');
    expect(host.querySelector('.mj-dialog-body')?.textContent).not.toContain('Cancel');
  });

  it('shows the moment a share was recorded as the host formatted it, not as "today at" an ISO string', async () => {
    const fixture = TestBed.createComponent(CollabShareCheckDialogComponent);
    fixture.componentRef.setInput('AuthorName', 'Ada Owner');
    fixture.componentRef.setInput('Timestamp', 'Oct 1, 2026, 1:19 AM');
    fixture.detectChanges();
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Recorded as shared by Ada Owner on Oct 1, 2026, 1:19 AM');
    expect(text).not.toContain('today at');
  });

  it('holds the upload and new-conversation footers in the dialog actions, not in the scrolling body', async () => {
    const upload = TestBed.createComponent(CollabUploadDialogComponent);
    const convo = TestBed.createComponent(CollabNewConversationDialogComponent);
    for (const fixture of [upload, convo]) {
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('mj-dialog-actions')?.textContent).toContain('Cancel');
      expect(host.querySelector('.mj-dialog-body')?.textContent).not.toContain('Cancel');
    }
  });

  it("leaves focus to mj-dialog: none of the dialogs turns its autofocus, Tab trap or focus return off, or handles Tab itself", () => {
    for (const Dialog of [CollabNewConversationDialogComponent, CollabUploadDialogComponent, CollabShareCheckDialogComponent, CollabNewSpaceDialogComponent]) {
      const fixture = TestBed.createComponent(Dialog as Type<unknown>);
      fixture.detectChanges();
      const dialog = fixture.debugElement.query((node) => node.name === 'mj-dialog').injector.get(MJDialogComponent);
      expect([dialog.AutoFocus, dialog.TrapFocus, dialog.RestoreFocus]).toEqual([true, true, true]);
      // No listener of the dialog's own on the document: MJ's handler sits on its container
      const def = (Dialog as unknown as { ɵcmp: { hostBindings: unknown } }).ɵcmp;
      expect(def.hostBindings).toBeNull();
      fixture.destroy();
    }
  });

  it('opens on the first field, on the marked control when there is one, and, in the share dialog, on its content, so that Enter right after it opens shares nothing', async () => {
    // mj-dialog moves the focus on the microtask after its container is drawn
    const settle = () => Promise.resolve();
    const convo = TestBed.createComponent(CollabNewConversationDialogComponent);
    convo.detectChanges();
    await settle();
    expect((document.activeElement as HTMLElement).id).toBe('convo-name');
    convo.destroy();

    const upload = TestBed.createComponent(CollabUploadDialogComponent);
    upload.detectChanges();
    await settle();
    expect((document.activeElement as HTMLElement).hasAttribute('data-autofocus')).toBe(true);
    upload.destroy();

    const share = TestBed.createComponent(CollabShareCheckDialogComponent);
    share.detectChanges();
    await settle();
    const active = document.activeElement as HTMLElement;
    // No field in this dialog: left to itself mj-dialog would focus the first button, which is Share when there are no findings
    expect(active.classList.contains('share-modal')).toBe(true);
    expect(active.tagName).not.toBe('BUTTON');
    expect(active.getAttribute('tabindex')).toBe('-1');
    const shared = vi.fn();
    share.componentInstance.ShareRequested.subscribe(shared);
    active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    active.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    expect(shared).not.toHaveBeenCalled();
  });

  it('gives focus back to what opened the dialog when it closes, and leaves it on the page when that is gone', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const fixture = TestBed.createComponent(CollabNewConversationDialogComponent);
    fixture.detectChanges();
    document.body.querySelector<HTMLElement>('input')?.focus();
    expect(document.activeElement).not.toBe(opener);
    fixture.destroy();
    expect(document.activeElement).toBe(opener);

    const second = document.createElement('button');
    document.body.appendChild(second);
    second.focus();
    const again = TestBed.createComponent(CollabNewConversationDialogComponent);
    again.detectChanges();
    document.body.querySelector<HTMLElement>('input')?.focus();
    second.remove();
    again.destroy();
    // mj-dialog blurs to the body rather than picking a landing place of its own
    expect(document.activeElement).toBe(document.body);
  });

  it('asks for the share when Share is clicked, and not when Cancel is', async () => {
    const fixture = TestBed.createComponent(CollabShareCheckDialogComponent);
    const shared = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.ShareRequested.subscribe(shared);
    fixture.componentInstance.CancelRequested.subscribe(cancelled);
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('mj-dialog-actions button'));
    buttons.find((b) => b.textContent?.includes('Share'))!.click();
    expect(shared).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
    buttons.find((b) => b.textContent?.includes('Cancel'))!.click();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(shared).toHaveBeenCalledTimes(1);
  });

  /** Tab from an element inside the dialog: the key bubbles to mj-dialog's container, where its trap listens. */
  const tabFrom = (element: HTMLElement, shiftKey = false): KeyboardEvent => {
    element.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    element.dispatchEvent(tab);
    return tab;
  };

  it("keeps Tab inside, including the dialog's own close button: from the last control to the first, from the first back", async () => {
    const fixture = TestBed.createComponent(CollabShareCheckDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('button'));
    expect(buttons[0].getAttribute('aria-label')).toBe('Close dialog');
    const last = buttons[buttons.length - 1];
    expect(tabFrom(last).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    expect(tabFrom(buttons[0], true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('holds the trap from the container, where the focus starts: Shift+Tab wraps to the last control, and a plain Tab is left to the browser, which goes to the first', async () => {
    const fixture = TestBed.createComponent(CollabShareCheckDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const container = host.querySelector<HTMLElement>('.mj-dialog-container')!;
    expect(container.getAttribute('tabindex')).toBe('-1');
    const buttons = Array.from(host.querySelectorAll<HTMLElement>('button'));
    expect(tabFrom(container, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    // mj-dialog wraps only at the ends: from the container, the browser's own Tab already lands on the first control
    expect(tabFrom(container).defaultPrevented).toBe(false);
  });

  it('keeps the focus on the dialog while a save has every control off, in the dialogs that open on a field', async () => {
    for (const Dialog of [CollabUploadDialogComponent, CollabNewConversationDialogComponent, CollabNewSpaceDialogComponent]) {
      const fixture = TestBed.createComponent(Dialog as Type<CollabUploadDialogComponent | CollabNewConversationDialogComponent | CollabNewSpaceDialogComponent>);
      fixture.componentRef.setInput('IsSubmitting', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      // Every control is off, as it is while the save runs: the container, which mj-dialog keeps focusable and out of the tab order, is what is left
      host.querySelectorAll<HTMLElement>('input, select, textarea, button').forEach((el) => el.setAttribute('disabled', ''));
      host.querySelectorAll<HTMLElement>('[tabindex]').forEach((el) => {
        if (!el.classList.contains('mj-dialog-container')) el.setAttribute('tabindex', '-1');
      });
      const container = host.querySelector<HTMLElement>('.mj-dialog-container')!;
      const tab = tabFrom(container, true);
      expect(tab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(container);
      fixture.destroy();
    }
  });
});

/**
 * Test components are declared without decorator syntax: the widgets' `tsconfig.json` leaves `*.test.ts` out, and the toolchain
 * reads `experimentalDecorators` from the tsconfig that covers a file, so a decorator here would reach Node uncompiled. Calling the
 * decorator is what `@Component` does.
 */
function declareComponent(target: Type<unknown>, metadata: Component): void {
  Component({ standalone: true, ...metadata })(target);
}

/** Stands in for MJ's chat area and keeps what the space bound to it, so a test can read the bindings that decide what the composer offers. */
class ChatAreaStub {
  /** The slots the space projects, by MJ's own directive: only one marked `mjChatSlot="header"` is drawn, as MJ's chat area draws it. */
  @ContentChildren(ChatSlotDirective) public slots?: QueryList<ChatSlotDirective>;
  public get header(): TemplateRef<unknown> | null {
    return this.slots?.find((slot) => slot.SlotName === 'header')?.Template ?? null;
  }
  public AllowRealtime = true;
  /** MJ's chat area: when true, its own banner with `ReadOnlyMessage` replaces the composer, and pin, edit and delete follow. */
  public ReadOnly = false;
  public ReadOnlyMessage: string | null = null;
  public EnableDecisionRouting = false;
  public CollapseThreadReplies = false;
  /** MJ's chat area names a reply after the agent that made it when this is null. */
  public assistantDisplayName: string | null = null;
  public ComposerDraftConsumed = new EventEmitter<void>();
  public PendingMessageConsumed = new EventEmitter<void>();
}
declareComponent(ChatAreaStub, {
  selector: 'mj-conversation-chat-area',
  imports: [NgTemplateOutlet],
  template: '<ng-content></ng-content><ng-container *ngTemplateOutlet="header"></ng-container>',
  inputs: [
    'EnvironmentId', 'CurrentUser', 'ConversationId', 'ApplicationScope', 'ApplicationId', 'LinkedEntityId', 'LinkedRecordId', 'DefaultAgentId',
    'assistantDisplayName', 'ReadOnly', 'ReadOnlyMessage', 'AllowMentions', 'AllowEntityMentions', 'AllowSkillCommands', 'AllowAttachments', 'AllowRealtime',
    'CollapseThreadReplies', 'AgentReplyMode', 'AllowedAgentIDs', 'EnableDecisionRouting', 'MentionPeople', 'AgentHistoryFrom',
    'AgentTurnHandler', 'AutoNameConversation', 'ComposerDraft', 'PendingMessage', 'PendingMessageConversationId',
  ],
  outputs: ['ComposerDraftConsumed', 'PendingMessageConsumed'],
});

/** MJ's status-push subscription, as the space's chat starts it. */
const streamingStub = { initialize: vi.fn() };
const provideStreamingStub = () => TestBed.overrideProvider(ConversationStreamingService, { useValue: streamingStub });

describe("a space's conversation, rendered", () => {
  it("offers no voice call: a call doesn't go through the turn that holds an agent to the conversation's audience", async () => {
    provideStreamingStub();
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, SharedGenericModule, ChatSlotDirective, ChatAreaStub] } });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    fixture.componentRef.setInput('ConversationId', 'c1');
    fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
    fixture.detectChanges();
    await fixture.whenStable();
    const area = fixture.debugElement.query((node) => node.name === 'mj-conversation-chat-area');
    expect(area).not.toBeNull();
    // MJ's chat area defaults AllowRealtime to true; the space must turn it off
    expect(area.injector.get(ChatAreaStub).AllowRealtime).toBe(false);
    // Multi-party space chats turn on Jev decision routing by default for active-agent follow-ups
    expect(area.injector.get(ChatAreaStub).EnableDecisionRouting).toBe(true);
    // Space chats opt into collapsing thread replies under their parent message
    expect(area.injector.get(ChatAreaStub).CollapseThreadReplies).toBe(true);
  });
});

describe('New space, rendered', () => {
  const types: NewSpaceTypeOption[] = [
    { id: 't-board', name: 'Board', description: 'A governing body', iconClass: 'fa-solid fa-landmark', color: '#0076b6' },
    { id: 't-workspace', name: 'Workspace', description: '', iconClass: 'fa-solid fa-briefcase', color: '#059669' },
  ];
  const render = (inputs: Record<string, unknown> = {}) => {
    const fixture = TestBed.createComponent(CollabNewSpaceDialogComponent);
    fixture.componentRef.setInput('Types', types);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture;
  };
  const primary = (host: HTMLElement): HTMLButtonElement =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('mj-dialog-actions button')).find((b) => b.textContent?.includes('Create space'))!;

  it('offers each kind as a radio and shows no name until one is chosen', async () => {
    const fixture = render();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="radiogroup"]')?.getAttribute('aria-labelledby')).toBe('new-space-kind-label');
    expect(host.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(host.textContent).toContain('A governing body');
    expect(host.querySelector('#new-space-name')).toBeNull();
    expect(primary(host).disabled).toBe(true);
  });

  it('asks the host for the kind that was picked, and does not select it itself', async () => {
    const fixture = render();
    await fixture.whenStable();
    const picked = vi.fn();
    fixture.componentInstance.TypeSelected.subscribe(picked);
    const radios = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="radio"]');
    radios[0].dispatchEvent(new Event('change'));
    expect(picked).toHaveBeenCalledWith('t-board');
    expect(fixture.componentInstance.SelectedTypeId).toBe('');
  });

  it('shows name and description once a kind is chosen, and submits the trimmed name with the kind', async () => {
    const fixture = render({ SelectedTypeId: 't-workspace' });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const submitted = vi.fn();
    fixture.componentInstance.SubmitRequested.subscribe(submitted);
    fixture.componentInstance.name = '  Northwind  ';
    fixture.componentInstance.description = ' the account ';
    fixture.detectChanges();
    expect(primary(host).disabled).toBe(false);
    primary(host).click();
    expect(submitted).toHaveBeenCalledWith({ typeId: 't-workspace', name: 'Northwind', description: 'the account' });
  });

  it('holds Create off until the name is filled in, and while the kind\'s own details are incomplete', async () => {
    const fixture = render({ SelectedTypeId: 't-board', HasDetails: true, DetailsTitle: 'Board details', DetailsIncomplete: true });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Board details');
    fixture.componentInstance.name = 'Board 2026';
    fixture.detectChanges();
    expect(primary(host).disabled).toBe(true);
    fixture.componentRef.setInput('DetailsIncomplete', false);
    fixture.detectChanges();
    expect(primary(host).disabled).toBe(false);
  });

  it('shows the refusal the server gave and keeps the dialog open', async () => {
    const fixture = render({ SelectedTypeId: 't-workspace', ErrorMessage: 'A board may not sit under a workspace.' });
    await fixture.whenStable();
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('A board may not sit under a workspace.');
  });

  it('turns every control off while it saves, and ignores Escape', async () => {
    const fixture = render({ SelectedTypeId: 't-workspace', IsSubmitting: true });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const cancelled = vi.fn();
    fixture.componentInstance.CancelRequested.subscribe(cancelled);
    expect(Array.from(host.querySelectorAll<HTMLInputElement>('input')).every((i) => i.disabled)).toBe(true);
    escape();
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('says so when there is no kind to start', async () => {
    const fixture = render({ Types: [] });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('There is no kind of space you can start.');
  });

  it('leaves focus on the kind that was chosen: an arrow key in a radio group picks, and the name comes next in the tab order', async () => {
    vi.useFakeTimers();
    const fixture = render();
    vi.runAllTimers();
    const radio = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="radio"]')!;
    radio.focus();
    fixture.componentRef.setInput('SelectedTypeId', 't-workspace');
    fixture.detectChanges();
    vi.runAllTimers();
    expect(document.activeElement).toBe(radio);
  });
});

describe('A space\'s own details, rendered', () => {
  class SettingsHost {
    public settings = settings;
    public hasDetails = true;
    public editable = true;
    public dirty = false;
    public incomplete = false;
    public saving = false;
    public message = '';
    public error = '';
    public saved = vi.fn();
    public discarded = vi.fn();
  }
  declareComponent(SettingsHost, {
    imports: [CollabSpaceSettingsComponent],
    template: `
      <mjc-space-settings [Settings]="settings" [HasDetails]="hasDetails" DetailsTitle="Board details" [DetailsEditable]="editable"
        [DetailsDirty]="dirty" [DetailsIncomplete]="incomplete" [IsSavingDetails]="saving" [DetailsMessage]="message" [DetailsError]="error"
        (SaveDetailsRequested)="saved()" (DiscardDetailsRequested)="discarded()">
        <div mjcSettingsDetails id="projected-field">Term</div>
      </mjc-space-settings>`,
  });

  const renderSettings = async (over: Partial<SettingsHost> = {}) => {
    const fixture = TestBed.createComponent(SettingsHost);
    Object.assign(fixture.componentInstance, over);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };
  const buttonNamed = (host: HTMLElement, text: string): HTMLButtonElement | undefined =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(text));

  it('draws what the host projects under the details title, and no card when the space has none', async () => {
    const withDetails = await renderSettings();
    const host = withDetails.nativeElement as HTMLElement;
    expect(host.querySelector('#settings-details-title')?.textContent).toContain('Board details');
    // The heading names the card as a region: `aria-labelledby` on a plain div names nothing
    expect(host.querySelector('section[aria-labelledby="settings-details-title"]')).not.toBeNull();
    expect(host.querySelector('.details-fields #projected-field')).not.toBeNull();
    const without = await renderSettings({ hasDetails: false });
    expect((without.nativeElement as HTMLElement).querySelector('#settings-details-title')).toBeNull();
  });

  it('holds Save and Discard off until a detail changes, and Save off while a required one is empty or a save is under way', async () => {
    const clean = await renderSettings();
    const cleanHost = clean.nativeElement as HTMLElement;
    expect(buttonNamed(cleanHost, 'Save details')!.disabled).toBe(true);
    expect(buttonNamed(cleanHost, 'Discard changes')!.disabled).toBe(true);
    const dirty = await renderSettings({ dirty: true });
    expect(buttonNamed(dirty.nativeElement, 'Save details')!.disabled).toBe(false);
    expect(buttonNamed(dirty.nativeElement, 'Discard changes')!.disabled).toBe(false);
    expect(buttonNamed((await renderSettings({ dirty: true, incomplete: true })).nativeElement, 'Save details')!.disabled).toBe(true);
    expect(buttonNamed((await renderSettings({ dirty: true, saving: true })).nativeElement, 'Saving')!.disabled).toBe(true);
  });

  it('asks the host to save or discard, and says what came of a save', async () => {
    const fixture = await renderSettings({ dirty: true, message: 'Details saved.' });
    const host = fixture.nativeElement as HTMLElement;
    buttonNamed(host, 'Save details')!.click();
    buttonNamed(host, 'Discard changes')!.click();
    expect(fixture.componentInstance.saved).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.discarded).toHaveBeenCalledTimes(1);
    expect(host.querySelector('mj-alert.details-outcome')?.textContent).toContain('Details saved.');
    const failed = await renderSettings({ error: 'Quorum must be between 1 and 100.' });
    expect((failed.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Quorum must be between 1 and 100.');
  });

  it('shows the details read-only, with no Save, to someone who may not change settings', async () => {
    const fixture = await renderSettings({ editable: false });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#projected-field')).not.toBeNull();
    expect(buttonNamed(host, 'Save details')).toBeUndefined();
  });

  it('shows an About card on the Overview only when the space has details, titled by the host', async () => {
    class OverviewHost {
      public has = true;
    }
    declareComponent(OverviewHost, {
      imports: [CollabSpaceOverviewComponent],
      template: `<mjc-space-overview [HasAbout]="has" AboutTitle="About this board"><span mjcAbout id="about-field">Term</span></mjc-space-overview>`,
    });
    const shown = TestBed.createComponent(OverviewHost);
    shown.detectChanges();
    await shown.whenStable();
    const host = shown.nativeElement as HTMLElement;
    expect(host.querySelector('.about-card')?.textContent).toContain('About this board');
    expect(host.querySelector('.about-card #about-field')).not.toBeNull();
    shown.componentInstance.has = false;
    shown.changeDetectorRef.markForCheck();
    shown.detectChanges();
    expect(host.querySelector('.about-card')).toBeNull();
  });
});

describe("Home's lists, rendered", () => {
  const rows: HomeListRow[] = [
    { key: 's1', title: 'Bea is invited as Contributor', detail: 'Invited Sep 28, 2026', spaceName: 'Northwind', iconClass: 'fa-solid fa-user-plus', actionLabel: 'Review on People' },
    { key: 's2', title: 'Cy is invited', detail: 'Waiting for an owner', spaceName: 'Board', iconClass: 'fa-solid fa-user-plus', actionLabel: 'Review on People' },
  ];
  const render = async (inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(CollabHomeListComponent);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  it('draws a button for each row, named by what it is, where it is and what it does, and selects the row by its key', async () => {
    const fixture = await render({ Id: 'approvals', Title: 'Invitations waiting on an owner', Rows: rows, TotalCount: 2 });
    const host = fixture.nativeElement as HTMLElement;
    const selected = vi.fn();
    fixture.componentInstance.RowSelected.subscribe(selected);
    expect(host.querySelector('section')?.getAttribute('aria-labelledby')).toBe('hl-title-approvals');
    const buttons = host.querySelectorAll<HTMLButtonElement>('.hl-row');
    expect(buttons).toHaveLength(2);
    // No `aria-label`: it would replace the visible text and leave out the detail line, so the text names the button
    expect(buttons[0].hasAttribute('aria-label')).toBe(false);
    for (const text of ['Bea is invited as Contributor', 'Invited Sep 28, 2026', 'Northwind', 'Review on People']) expect(buttons[0].textContent).toContain(text);
    buttons[1].click();
    expect(selected).toHaveBeenCalledWith('s2');
  });

  it('says how many there are in all when the rows are cut short, and not when they are all shown', async () => {
    const cut = await render({ Rows: rows, TotalCount: 73 });
    expect((cut.nativeElement as HTMLElement).textContent).toContain('Showing 2 of 73.');
    const all = await render({ Rows: rows, TotalCount: 2 });
    expect((all.nativeElement as HTMLElement).textContent).not.toContain('Showing');
  });

  it('says what an empty list means, what went wrong with a read and offers to try again, and says it is reading', async () => {
    const empty = await render({ Rows: [], EmptyMessage: 'No open tasks in your spaces.' });
    expect((empty.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent).toContain('No open tasks in your spaces.');
    const failed = await render({ Rows: [], ErrorMessage: 'The list could not be read: the query is not approved.' });
    const retried = vi.fn();
    failed.componentInstance.RetryRequested.subscribe(retried);
    const failedHost = failed.nativeElement as HTMLElement;
    expect(failedHost.querySelector('[role="alert"]')?.textContent).toContain('the query is not approved');
    failedHost.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    expect(retried).toHaveBeenCalledTimes(1);
    const loading = await render({ Rows: rows, IsLoading: true });
    const loadingHost = loading.nativeElement as HTMLElement;
    expect(loadingHost.textContent).toContain('Reading');
    expect(loadingHost.querySelector('.hl-row')).toBeNull();
  });

  it('closes from its own button', async () => {
    const fixture = await render({ Rows: rows });
    const closed = vi.fn();
    fixture.componentInstance.CloseRequested.subscribe(closed);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Close this list"]')!.click();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});

describe("The Overview's contributed cards, rendered", () => {
  class SharedCardStub {}
  declareComponent(SharedCardStub, { selector: 'stub-shared-card', template: '<div class="stub-card" data-side="shared">Shared card</div>' });
  class TeamCardStub {}
  declareComponent(TeamCardStub, { selector: 'stub-team-card', template: '<div class="stub-card" data-side="team">Team card</div>' });
  class NoSideCardStub {}
  declareComponent(NoSideCardStub, { selector: 'stub-no-side-card', template: '<div class="stub-card" data-side="none">No side</div>' });

  const render = async (canSeeTeamSide: boolean) => {
    const fixture = TestBed.createComponent(CollabSpaceOverviewComponent);
    fixture.componentRef.setInput('CanSeeTeamSide', canSeeTeamSide);
    fixture.componentRef.setInput('ContributedCards', [
      { key: 'shared', title: 'Shared', side: 'Shared', component: SharedCardStub },
      { key: 'team', title: 'Team', side: 'Team', component: TeamCardStub },
      { key: 'no-side', title: 'No side', component: NoSideCardStub },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.stub-card')).map((el) => el.getAttribute('data-side'));
  };

  it('draws the Shared card and no Team card for a viewer who cannot see the Team band, and every card for one who can', async () => {
    expect(await render(false)).toEqual(['shared']);
    expect(await render(true)).toEqual(['shared', 'team', 'none']);
  });
});

describe('the conversation of a space, read-only', () => {
  const render = async (inputs: Record<string, unknown>) => {
    // A test may render twice: each render starts from a fresh test module
    TestBed.resetTestingModule();
    provideStreamingStub();
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, SharedGenericModule, ChatSlotDirective, ChatAreaStub] } });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    fixture.componentRef.setInput('ConversationId', 'c1');
    fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('says why it can be read and not posted in, as a lock with the reason on hover, not a banner of its own', async () => {
    const note = 'You can read this conversation, but you have no seat that lets you post.';
    const host = await render({ IsReadOnly: true, ConversationId: null, ReadOnlyNote: note });
    const lock = host.querySelector('.read-only-lock');
    expect(lock?.getAttribute('title')).toBe(note);
    expect(lock?.getAttribute('aria-label')).toBe(note);
    expect(host.querySelector('.space-closed-banner')).toBeNull();
    expect(host.textContent).not.toContain(note);
  });

  it("hands MJ's chat area ReadOnly and the reason, instead of hiding its composer from outside", async () => {
    const note = 'This space is closed. Conversations are read-only.';
    TestBed.resetTestingModule();
    provideStreamingStub();
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, SharedGenericModule, ChatSlotDirective, ChatAreaStub] } });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    fixture.componentRef.setInput('ConversationId', 'c1');
    fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
    fixture.componentRef.setInput('IsReadOnly', true);
    fixture.componentRef.setInput('ReadOnlyNote', note);
    fixture.detectChanges();
    await fixture.whenStable();
    const area = fixture.debugElement.query((node) => node.name === 'mj-conversation-chat-area').injector.get(ChatAreaStub);
    expect(area.ReadOnly).toBe(true);
    expect(area.ReadOnlyMessage).toBe(note);
    // No style reaches into MJ's markup through the piercing combinator: the composer is MJ's to hide
    const styles = (CollabSpaceChatComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).not.toMatch(/::\S*deep\b/);
    expect(styles).not.toContain('message-input-container');
  });

  it('shows neither composer, note nor lock while the seat is not yet known: a quiet wait, and no chat area', async () => {
    const host = await render({ IsPending: true, IsReadOnly: false, ConversationId: 'c1' });
    expect(host.querySelector('mj-conversation-chat-area')).toBeNull();
    expect(host.querySelector('.read-only-lock')).toBeNull();
    expect(host.querySelector('.read-only-reason')).toBeNull();
    expect(host.querySelector('.chat-pending')).not.toBeNull();
  });

  it("shows the header's lock over an open conversation too, with the reason as its label", async () => {
    const note = 'You can read this conversation, but you have no seat that lets you post.';
    const host = await render({ IsReadOnly: true, ReadOnlyNote: note });
    const lock = host.querySelector<HTMLButtonElement>('.space-chat-header-slot .read-only-lock');
    expect(lock?.tagName).toBe('BUTTON');
    expect(lock?.getAttribute('title')).toBe(note);
    expect(lock?.getAttribute('aria-label')).toBe(note);
    expect(lock?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.read-only-reason')).toBeNull();
  });

  it('shows the reason on focus, for a keyboard, and toggles it on a tap or click, for a touch screen, without a click after focus closing it', async () => {
    const note = 'You can read this conversation, but you have no seat that lets you post.';
    TestBed.resetTestingModule();
    provideStreamingStub();
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, SharedGenericModule, ChatSlotDirective, ChatAreaStub] } });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    fixture.componentRef.setInput('ConversationId', null);
    fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
    fixture.componentRef.setInput('IsReadOnly', true);
    fixture.componentRef.setInput('ReadOnlyNote', note);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const lock = host.querySelector<HTMLButtonElement>('.read-only-lock')!;
    /** A pointer's click: `detail` is 1, where Enter's and Space's is 0. */
    const tap = () => lock.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    const reason = () => host.querySelector('.read-only-reason')?.textContent?.trim() ?? null;
    lock.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(reason()).toBe(note);
    expect(lock.getAttribute('aria-expanded')).toBe('true');
    // The click that follows the mouse-down that focused the lock keeps the reason open
    tap();
    fixture.detectChanges();
    expect(reason()).toBe(note);
    // A second tap closes it, a third opens it again
    tap();
    fixture.detectChanges();
    expect(reason()).toBeNull();
    tap();
    fixture.detectChanges();
    expect(reason()).toBe(note);
    // Leaving the lock closes it
    lock.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(reason()).toBeNull();
    expect(lock.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles the reason on the first Enter after tabbing to the lock, closes it on Escape without moving focus, and on a tap outside', async () => {
    TestBed.resetTestingModule();
    provideStreamingStub();
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, SharedGenericModule, ChatSlotDirective, ChatAreaStub] } });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    fixture.componentRef.setInput('ConversationId', null);
    fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
    fixture.componentRef.setInput('IsReadOnly', true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);
    const lock = host.querySelector<HTMLButtonElement>('.read-only-lock')!;
    const shown = () => host.querySelector('.read-only-reason') !== null;
    /** A click as Enter or Space makes it: `detail` is 0. A pointer's is 1. */
    const press = (detail: number) => { lock.dispatchEvent(new MouseEvent('click', { bubbles: true, detail })); fixture.detectChanges(); };

    // Tab to the lock: the reason shows. The first Enter closes it, the second opens it again.
    lock.focus();
    lock.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(shown()).toBe(true);
    press(0);
    expect(shown()).toBe(false);
    press(0);
    expect(shown()).toBe(true);

    // Escape closes it, and the focus stays on the lock
    lock.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(shown()).toBe(false);
    expect(document.activeElement).toBe(lock);

    // Open again with a pointer, then tap somewhere else
    press(1);
    expect(shown()).toBe(true);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    fixture.detectChanges();
    expect(shown()).toBe(false);

    // The reason is the button's label, so it is not a live region, and its id is this instance's own
    press(1);
    const reason = host.querySelector('.read-only-reason')!;
    expect(reason.getAttribute('role')).toBeNull();
    expect(reason.id).toMatch(/^mjc-read-only-reason-\d+$/);
    expect(lock.getAttribute('aria-controls')).toBe(reason.id);
    host.remove();
  });

  it("closes one chat's reason on a tap on another chat's lock: a tap that moves no focus (Safari) is outside the first chat", async () => {
    TestBed.resetTestingModule();
    provideStreamingStub();
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, SharedGenericModule, ChatSlotDirective, ChatAreaStub] } });
    const chats = [1, 2].map(() => {
      const fixture = TestBed.createComponent(CollabSpaceChatComponent);
      fixture.componentRef.setInput('ConversationId', null);
      fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
      fixture.componentRef.setInput('IsReadOnly', true);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      document.body.appendChild(host);
      return { fixture, host, lock: host.querySelector<HTMLButtonElement>('.read-only-lock')!, wrap: host.querySelector<HTMLElement>('.read-only-lock-wrap')! };
    });
    const shown = (chat: (typeof chats)[number]) => chat.host.querySelector('.read-only-reason') !== null;
    const draw = () => chats.forEach((chat) => chat.fixture.detectChanges());

    // The first chat's reason opens by a pointer's click on its lock
    chats[0].lock.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    draw();
    expect(shown(chats[0])).toBe(true);

    // A tap inside the second chat's lock, beside its button, is outside the first chat: the first's reason closes
    chats[1].wrap.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    draw();
    expect(shown(chats[0])).toBe(false);

    // The same tap beside the second chat's own lock leaves its reason open
    chats[1].lock.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    draw();
    expect(shown(chats[1])).toBe(true);
    chats[1].wrap.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    draw();
    expect(shown(chats[1])).toBe(true);
    expect(shown(chats[0])).toBe(false);
    chats.forEach((chat) => chat.host.remove());
  });

  it('shows no lock while it can be posted in, and says the space is closed unless told otherwise', async () => {
    expect((await render({ ConversationId: null })).querySelector('.read-only-lock')).toBeNull();
    expect((await render({ IsReadOnly: true, ConversationId: null })).querySelector('.read-only-lock')?.getAttribute('title')).toContain('This space is closed.');
  });

  it("leaves the reply's name to MJ's chat area, so the agent that answered is the one named", async () => {
    TestBed.resetTestingModule();
    provideStreamingStub();
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, SharedGenericModule, ChatSlotDirective, ChatAreaStub] } });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    fixture.componentRef.setInput('ConversationId', 'c1');
    fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
    fixture.detectChanges();
    await fixture.whenStable();
    const area = fixture.debugElement.query((node) => node.name === 'mj-conversation-chat-area');
    expect(area.injector.get(ChatAreaStub).assistantDisplayName).toBeNull();
  });

  it("starts MJ's status-push subscription, which the chat area does not start itself: without it a reply stays at Starting", async () => {
    streamingStub.initialize.mockClear();
    await render({});
    expect(streamingStub.initialize).toHaveBeenCalledTimes(1);
  });

  it('renders the linked workstream actionable item pill and PR #6176 live agent working progress bar in the header', async () => {
    TestBed.resetTestingModule();
    provideStreamingStub();
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, SharedGenericModule, ChatSlotDirective, ChatAreaStub] } });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    fixture.componentRef.setInput('ConversationId', 'c1');
    fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
    fixture.componentRef.setInput('LinkedWorkstreamItem', { kind: 'task', id: 'task-1', title: 'Audit Charter Review', status: 'InProgress' });
    fixture.componentInstance.onAgentTurnStarted({ agentName: 'Sage', route: 'ThreadReply', statusText: 'Drafting audit summary…' });
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const pill = host.querySelector('[data-testid="linked-workstream-pill"]');
    expect(pill?.textContent).toContain('Audit Charter Review');
    expect(pill?.textContent).toContain('InProgress');

    const progress = host.querySelector('[data-testid="agent-working-progress-bar"]');
    expect(progress?.textContent).toContain('@Sage is working');
    expect(progress?.textContent).toContain('↪ Thread Reply');
    expect(progress?.textContent).toContain('Drafting audit summary…');
  });
});

@RegisterClassEx(BaseSpacePageBlock, {
  key: 'test:custom-metric',
  metadata: {
    slot: 'page-block',
    contributionKey: 'test:custom-metric',
    label: 'Custom metric block',
    icon: 'fa-solid fa-gauge-high',
    side: 'Shared',
    defaultZone: 'main',
    sortKey: 55,
    spaceTypes: ['*'],
    description: 'Live metric block registered via ClassFactory',
    emptyText: 'No metrics yet',
  },
})
@Component({
  selector: 'mjc-test-custom-metric-block',
  standalone: true,
  template: `
    <div data-testid="test-custom-metric-block">
      Metric block for {{ SpaceId }} (readonly={{ ReadOnly }})
    </div>
  `,
})
class TestCustomMetricBlockComponent extends BaseSpacePageBlock {}

@RegisterClassEx(BaseSpacePageBlock, {
  key: 'test:team-audit',
  metadata: {
    slot: 'page-block',
    contributionKey: 'test:team-audit',
    label: 'Team audit block',
    icon: 'fa-solid fa-user-shield',
    side: 'Team',
    defaultZone: 'main',
    sortKey: 56,
    spaceTypes: ['*'],
    description: 'Internal team audit block',
    emptyText: 'No team audits yet',
  },
})
@Component({
  selector: 'mjc-test-team-audit-block',
  standalone: true,
  template: `
    <div data-testid="test-team-audit-block">
      Internal team audit block for {{ SpaceId }}
    </div>
  `,
})
class TestTeamAuditBlockComponent extends BaseSpacePageBlock {}

@RegisterClassEx(BaseSpacePageBlock, {
  key: 'test:omitted-side',
  metadata: {
    slot: 'page-block',
    contributionKey: 'test:omitted-side',
    label: 'Omitted side block',
    icon: 'fa-solid fa-shield-halved',
    defaultZone: 'main',
    sortKey: 57,
    spaceTypes: ['*'],
    description: 'Block registered with no side in metadata',
  },
})
@Component({
  selector: 'mjc-test-omitted-side-block',
  standalone: true,
  template: `
    <div data-testid="test-omitted-side-block">
      Omitted side block for {{ SpaceId }}
    </div>
  `,
})
class TestOmittedSideBlockComponent extends BaseSpacePageBlock {}

describe('Registered page blocks (BaseSpacePageBlock), rendered', () => {
  const sampleOverviewPage = (blocks: CollabPageModel['blocks']): CollabPageModel => ({
    id: 'page-overview',
    builtInTabId: 'Overview',
    title: 'Overview',
    iconClass: 'fa-solid fa-house',
    pageType: 'Overview',
    band: 'Shared',
    status: 'Published',
    sequence: 0,
    collaborative: true,
    summary: 'Space overview',
    body: '',
    blocks,
    comments: [],
    updatedLabel: 'Today',
    authorName: 'Ada',
  });

  it('discovers a @RegisterClassEx(BaseSpacePageBlock) component in the block picker and renders it on a page without changing space-pages or collaboration-section', () => {
    void TestCustomMetricBlockComponent;
    const fixture = TestBed.createComponent(CollabSpacePagesComponent);
    fixture.componentRef.setInput('SpaceId', 'space-42');
    fixture.componentRef.setInput('CanWrite', true);
    fixture.componentRef.setInput('CanSeeTeam', true);
    fixture.componentRef.setInput('IsCustomizing', true);
    fixture.componentRef.setInput('Pages', [sampleOverviewPage([])]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const comp = fixture.componentInstance;
    const options = comp.availableWidgetBlockOptions(comp.activePage!);
    expect(options.some((o) => o.type === 'test:custom-metric' && o.label === 'Custom metric block')).toBe(true);

    // Open the block picker via the main-column insert button and verify the registered block appears in the picker UI
    let savedPage: CollabPageModel | null = null;
    comp.PageSaveRequested.subscribe((p) => {
      savedPage = p;
      fixture.componentRef.setInput('Pages', [p]);
    });

    const insertButtons = Array.from(host.querySelectorAll<HTMLButtonElement>('.sp-insert-btn'));
    const mainInsertBtn = insertButtons.find((btn) => btn.textContent?.includes('Add to main column')) ?? insertButtons[0];
    mainInsertBtn.click();
    fixture.detectChanges();

    const pickerCards = Array.from(host.querySelectorAll<HTMLButtonElement>('.sp-picker-card'));
    const customCard = pickerCards.find((card) => card.querySelector('.sp-picker-lbl')?.textContent?.trim() === 'Custom metric block');
    expect(customCard).toBeDefined();

    // Click the custom block card in the picker and verify it mounts via NgComponentOutlet with its inputs
    customCard!.click();
    fixture.detectChanges();

    expect(savedPage).not.toBeNull();
    const rendered = host.querySelector('[data-testid="test-custom-metric-block"]');
    expect(rendered).not.toBeNull();
    expect(rendered?.textContent).toContain('Metric block for space-42 (readonly=false)');
  });

  it('filters the block picker and rendered page by side (including blocks registered with no side, which default to Team) so non-Team viewers never see or render a Team block', () => {
    void TestTeamAuditBlockComponent;
    void TestOmittedSideBlockComponent;
    const pageWithTeamBlock = sampleOverviewPage([
      { id: 'blk-team-1', type: 'test:team-audit', title: '', width: 'main' },
      { id: 'blk-omitted-side', type: 'test:omitted-side', title: '', width: 'main' },
      { id: 'blk-team-files', type: 'collab:team-files', title: '', width: 'main' },
    ]);

    const fixture = TestBed.createComponent(CollabSpacePagesComponent);
    fixture.componentRef.setInput('SpaceId', 'space-99');
    fixture.componentRef.setInput('CanWrite', false);
    fixture.componentRef.setInput('CanSeeTeam', false);
    fixture.componentRef.setInput('Pages', [pageWithTeamBlock]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const comp = fixture.componentInstance;

    // Non-Team viewer does not see Team blocks or omitted-side blocks in the picker or on the rendered page
    const sharedOnlyOptions = comp.availableWidgetBlockOptions(sampleOverviewPage([]));
    expect(sharedOnlyOptions.some((o) => o.type === 'test:team-audit')).toBe(false);
    expect(sharedOnlyOptions.some((o) => o.type === 'test:omitted-side')).toBe(false);
    expect(sharedOnlyOptions.some((o) => o.type === 'collab:team-files')).toBe(false);
    expect(host.querySelector('[data-testid="test-team-audit-block"]')).toBeNull();
    expect(host.querySelector('[data-testid="test-omitted-side-block"]')).toBeNull();

    // Switching CanSeeTeam to true exposes Team blocks and omitted-side blocks in the picker and renders them on the page
    fixture.componentRef.setInput('CanSeeTeam', true);
    fixture.detectChanges();
    const teamOptions = comp.availableWidgetBlockOptions(sampleOverviewPage([]));
    expect(teamOptions.some((o) => o.type === 'test:team-audit')).toBe(true);
    expect(teamOptions.some((o) => o.type === 'test:omitted-side')).toBe(true);
    expect(teamOptions.some((o) => o.type === 'collab:team-files')).toBe(true);
    expect(host.querySelector('[data-testid="test-team-audit-block"]')?.textContent).toContain('Internal team audit block for space-99');
    expect(host.querySelector('[data-testid="test-omitted-side-block"]')?.textContent).toContain('Omitted side block for space-99');
  });

  it('renders a muted "This block is no longer available" notice in edit mode and nothing for viewers when a block key is unregistered', async () => {
    const confirmSpy = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [{ provide: MJConfirmService, useValue: { Confirm: confirmSpy } }],
    });
    const pageWithRetiredBlock = sampleOverviewPage([
      { id: 'blk-retired', type: 'custom:retired-widget', title: 'Retired widget', width: 'main' },
    ]);

    const fixture = TestBed.createComponent(CollabSpacePagesComponent);
    fixture.componentRef.setInput('SpaceId', 'space-1');
    fixture.componentRef.setInput('CanWrite', true);
    fixture.componentRef.setInput('IsCustomizing', false);
    fixture.componentRef.setInput('Pages', [pageWithRetiredBlock]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    // Viewer mode: nothing rendered for the unregistered block
    expect(host.querySelector('[data-testid="block-unavailable-notice"]')).toBeNull();
    expect(host.querySelectorAll('.sp-block').length).toBe(0);

    // Edit mode: muted "This block is no longer available" card + compact block toolbar
    fixture.componentRef.setInput('IsCustomizing', true);
    fixture.detectChanges();
    const unavailable = host.querySelector('[data-testid="block-unavailable-notice"]');
    expect(unavailable).not.toBeNull();
    expect(unavailable?.textContent).toContain('This block is no longer available');

    const toolbar = host.querySelector('[data-testid="block-toolbar"]');
    expect(toolbar).not.toBeNull();

    // Removing a block confirms via MJConfirmService
    let updatedPage: CollabPageModel | null = null;
    fixture.componentInstance.PageSaveRequested.subscribe((p) => { updatedPage = p; });
    await fixture.componentInstance.deleteBlock(fixture.componentInstance.activePage!, 0);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(updatedPage?.blocks).toHaveLength(0);
  });
});


