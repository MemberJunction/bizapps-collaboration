// @vitest-environment jsdom
import '@angular/compiler';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import type { UserInfo } from '@memberjunction/core';
import { CollabBandChipComponent } from './band-chip.component.ts';
import { CollabItemRowComponent } from './item-row.component.ts';
import { CollabSpaceChatComponent } from './space-chat.component.ts';
import { CollabNewConversationDialogComponent } from './new-conversation-dialog.component.ts';
import { CollabShareCheckDialogComponent } from './share-check-dialog.component.ts';
import { CollabSpaceRailComponent } from './space-rail.component.ts';
import { CollabSpaceSettingsComponent } from './space-settings.component.ts';
import { CollabUploadDialogComponent } from './upload-dialog.component.ts';
import type { SpaceSettingsModel } from './types';

const settings: SpaceSettingsModel = {
  id: 's1', name: 'Northwind', description: '', spaceType: 'Workspace', spaceTypeId: 't1', iconClass: 'fa-solid fa-briefcase', color: '#0076b6',
  backgroundImageUrl: '', inheritsMembership: true, agentRetrieval: 'Included', retention: 'Indefinite', status: 'Active',
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
    without.destroy();

    const withIt = TestBed.createComponent(CollabSpaceSettingsComponent);
    withIt.componentRef.setInput('Settings', settings);
    withIt.componentRef.setInput('CanEdit', true);
    withIt.componentRef.setInput('CanAdminister', true);
    await withIt.whenStable();
    const allowed = withIt.nativeElement as HTMLElement;
    expect(radios(allowed).every((radio) => !radio.disabled)).toBe(true);
    expect(allowed.textContent).not.toContain('Only someone with the Administer Spaces authorization');
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
    expect((without.nativeElement as HTMLElement).textContent).not.toContain('CONVERSATIONS');
    without.destroy();
    const withChat = TestBed.createComponent(CollabSpaceRailComponent);
    withChat.componentRef.setInput('Mode', 'space');
    withChat.componentRef.setInput('Tabs', [overview, chat]);
    withChat.detectChanges();
    expect((withChat.nativeElement as HTMLElement).textContent).toContain('CONVERSATIONS');
  });


  it('lets the collapsed space tile be operated from the keyboard', async () => {
    const fixture = TestBed.createComponent(CollabSpaceRailComponent);
    fixture.componentRef.setInput('SpaceTitle', 'Northwind');
    fixture.componentRef.setInput('Mode', 'space');
    fixture.componentInstance.isCollapsed = true;
    const back = vi.fn();
    fixture.componentInstance.BackToSpacesRequested.subscribe(back);
    fixture.detectChanges();
    await fixture.whenStable();
    const tile = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.collapsed-tile')!;
    expect(tile.getAttribute('role')).toBe('button');
    expect(tile.getAttribute('tabindex')).toBe('0');
    tile.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(back).toHaveBeenCalledTimes(1);
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

  it('focuses the first field when it opens, the marked control when there is one, and the container, not a button, when there is neither', () => {
    vi.useFakeTimers();
    const convo = TestBed.createComponent(CollabNewConversationDialogComponent);
    convo.detectChanges();
    vi.runAllTimers();
    expect((document.activeElement as HTMLElement).id).toBe('convo-name');
    convo.destroy();

    const upload = TestBed.createComponent(CollabUploadDialogComponent);
    upload.detectChanges();
    vi.runAllTimers();
    expect((document.activeElement as HTMLElement).hasAttribute('data-autofocus')).toBe(true);
    upload.destroy();

    const share = TestBed.createComponent(CollabShareCheckDialogComponent);
    share.detectChanges();
    vi.runAllTimers();
    expect(document.activeElement?.classList.contains('mj-dialog-container')).toBe(true);
    expect(document.activeElement?.tagName).not.toBe('BUTTON');
  });

  it('gives focus back to what opened the dialog when it closes, and to the main area when that is gone', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);
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
    second.remove();
    again.destroy();
    expect(document.activeElement).toBe(main);
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

  const tabFrom = (element: HTMLElement, shiftKey = false): KeyboardEvent => {
    element.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
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

  it('holds the trap from the container, where the focus starts: Tab goes to the first control, Shift+Tab to the last', async () => {
    const fixture = TestBed.createComponent(CollabShareCheckDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const container = host.querySelector<HTMLElement>('.mj-dialog-container')!;
    container.setAttribute('tabindex', '-1');
    const buttons = Array.from(host.querySelectorAll<HTMLElement>('button'));
    expect(tabFrom(container, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    expect(tabFrom(container).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('keeps the focus on the dialog while a save has every control off', async () => {
    const fixture = TestBed.createComponent(CollabUploadDialogComponent);
    fixture.componentRef.setInput('IsSubmitting', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelectorAll<HTMLElement>('input, select, textarea, button, [tabindex]').forEach((el) => {
      if (!el.classList.contains('mj-dialog-container')) el.setAttribute('disabled', '');
      if (el.hasAttribute('tabindex') && !el.classList.contains('mj-dialog-container')) el.setAttribute('tabindex', '-1');
    });
    const container = host.querySelector<HTMLElement>('.mj-dialog-container')!;
    container.setAttribute('tabindex', '-1');
    const tab = tabFrom(container, true);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container);
  });
});

/** Stands in for MJ's chat area and keeps what the space bound to it, so a test can read the bindings that decide what the composer offers. */
@Component({
  selector: 'mj-conversation-chat-area',
  standalone: true,
  template: '<ng-content></ng-content>',
  inputs: [
    'environmentId', 'currentUser', 'conversationId', 'applicationScope', 'applicationId', 'linkedEntityId', 'linkedRecordId', 'defaultAgentId',
    'assistantDisplayName', 'allowMentions', 'allowAgentMentions', 'allowEntityMentions', 'allowSkillCommands', 'allowAttachments', 'AllowRealtime',
    'AllowPinning', 'AllowMessageEdit', 'AllowMessageDelete', 'AgentReplyMode', 'AllowedAgentIDs', 'MentionPeople', 'AgentHistoryFrom',
    'AgentTurnHandler', 'AutoNameConversation', 'ComposerDraft', 'PendingMessage', 'PendingMessageConversationId',
  ],
})
class ChatAreaStub {
  public AllowRealtime = true;
  @Input() public unusedForTypeCheck = '';
  @Output() public ComposerDraftConsumed = new EventEmitter<void>();
  @Output() public PendingMessageConsumed = new EventEmitter<void>();
}

describe("a space's conversation, rendered", () => {
  it("offers no voice call: a call doesn't go through the turn that holds an agent to the conversation's audience", async () => {
    TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: [CollabBandChipComponent, MJButtonDirective, ChatAreaStub] } });
    const fixture = TestBed.createComponent(CollabSpaceChatComponent);
    fixture.componentRef.setInput('ConversationId', 'c1');
    fixture.componentRef.setInput('CurrentUser', { ID: 'u1', Name: 'Ada' } as unknown as UserInfo);
    fixture.detectChanges();
    await fixture.whenStable();
    const area = fixture.debugElement.query((node) => node.name === 'mj-conversation-chat-area');
    expect(area).not.toBeNull();
    // MJ's chat area defaults AllowRealtime to true; the space must turn it off
    expect(area.injector.get(ChatAreaStub).AllowRealtime).toBe(false);
  });
});
