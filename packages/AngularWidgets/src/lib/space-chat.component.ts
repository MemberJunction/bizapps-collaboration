import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import type { UserInfo } from '@memberjunction/core';
import {
  ConversationsModule,
  ConversationStreamingService,
  type AgentReplyMode,
  type AgentTurnHandler,
} from '@memberjunction/ng-conversations';
import type { MentionPerson } from '@memberjunction/conversations-runtime';
import { MJButtonDirective, MJEmptyStateComponent } from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import type { SpaceBand } from './types';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

/** Candidate item in retrieval scope for the turn (sources-in-scope chip). */
export interface SpaceChatCitationModel {
  SpaceItemID: string;
  SpaceID: string;
  EntityID: string;
  RecordID: string;
  Name: string;
  Band: SpaceBand;
}

@Component({
  selector: 'mjc-chat-scope-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabBandChipComponent],
  template: `
    <div class="scope-bar" role="group" aria-label="Retrieval scope" data-testid="space-chat-scope-bar">
      <span class="scope-label"><i class="fa-solid fa-compass" aria-hidden="true"></i> Scope:</span>
      <button
        type="button"
        class="scope-pill"
        data-testid="scope-pill-this-space"
        [class.active]="RetrievalScope === 'ThisSpace'"
        [attr.aria-pressed]="RetrievalScope === 'ThisSpace'"
        (click)="onScopeChange('ThisSpace')">
        This Space
      </button>
      <button
        type="button"
        class="scope-pill"
        data-testid="scope-pill-subtree"
        [class.active]="RetrievalScope === 'Subtree'"
        [attr.aria-pressed]="RetrievalScope === 'Subtree'"
        (click)="onScopeChange('Subtree')">
        This Space &amp; Sub-spaces
      </button>
      @if (AllowEverythingScope) {
        <button
          type="button"
          class="scope-pill"
          data-testid="scope-pill-everything"
          [class.active]="RetrievalScope === 'Everything'"
          [attr.aria-pressed]="RetrievalScope === 'Everything'"
          (click)="onScopeChange('Everything')">
          All My Spaces
        </button>
      }
    </div>
    @if (Citations.length > 0) {
      <div class="citations-bar" role="region" aria-label="Sources in scope for the assistant's reply" data-testid="sources-in-scope-bar">
        <span class="citations-label">
          <i class="fa-solid fa-book-open" aria-hidden="true"></i>
          <span>Sources in scope ({{ Citations.length }}):</span>
        </span>
        @for (citation of Citations; track citation.SpaceItemID) {
          <button
            type="button"
            class="citation-chip"
            data-testid="source-in-scope-chip"
            (click)="onCitationClick(citation)"
            [title]="citation.Name">
            <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
            <span class="citation-name">{{ citation.Name }}</span>
            <mjc-band-chip [Band]="citation.Band" />
          </button>
        }
      </div>
    }
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
      }
      .scope-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 16px;
        background: var(--mj-bg-surface-sunken, #f8fafc);
        border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
      }
      .scope-label {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--mj-text-secondary, #64748b);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-right: 2px;
      }
      .scope-pill {
        border: 1px solid var(--mj-border-default, #e2e8f0);
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-secondary, #475569);
        font-size: 11.5px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .scope-pill:hover {
        border-color: var(--mj-brand-primary, #0076b6);
        color: var(--mj-text-primary, #0f172a);
      }
      .scope-pill.active {
        background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 12%, transparent);
        border-color: var(--mj-brand-primary, #0076b6);
        color: var(--mj-brand-primary, #0076b6);
      }
      .citations-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 6px 16px;
        background: var(--mj-bg-surface-sunken, #f1f5f9);
        border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
        font-size: 12px;
      }
      .citations-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        color: var(--mj-text-secondary, #475569);
      }
      .citation-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-default, #e2e8f0);
        color: var(--mj-text-primary, #0f172a);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.15s ease;
      }
      .citation-chip:hover {
        border-color: var(--mj-brand-primary, #0076b6);
      }
      .citation-name {
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class CollabChatScopeBarComponent {
  @Input() public RetrievalScope: 'ThisSpace' | 'Subtree' | 'Everything' = 'Subtree';
  @Input() public AllowEverythingScope = false;
  @Input() public Citations: readonly SpaceChatCitationModel[] = [];
  @Output() public RetrievalScopeChanged = new EventEmitter<'ThisSpace' | 'Subtree' | 'Everything'>();
  @Output() public CitationClicked = new EventEmitter<SpaceChatCitationModel>();

  public onScopeChange(scope: 'ThisSpace' | 'Subtree' | 'Everything'): void {
    this.RetrievalScope = scope;
    this.RetrievalScopeChanged.emit(scope);
  }

  public onCitationClick(citation: SpaceChatCitationModel): void {
    this.CitationClicked.emit(citation);
  }
}

/**
 * The conversation of a space: MemberJunction's chat area, held to the space's audience and rules.
 *
 * MemberJunction's chat area follows an agent's live status and streamed reply through one app-wide subscription to the server's status
 * pushes, and only its own workspace starts it. A space embeds the chat area without that workspace, so this starts the subscription
 * (`initialize` does nothing once it is running); without it a reply stays at "Starting..." until the page is reloaded.
 */
@Component({
  selector: 'mjc-space-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabBandChipComponent, CollabChatScopeBarComponent, ConversationsModule, MJButtonDirective, MJEmptyStateComponent, SharedGenericModule],
  template: `
    <div class="chat-container">
      @if (IsPending) {
        <div class="chat-pending" role="status" aria-live="polite">
          <mj-loading Size="small" [ShowText]="false"></mj-loading>
        </div>
      } @else if (ConversationId && CurrentUser) {
        <mj-conversation-chat-area
          [EnvironmentId]="EnvironmentId"
          [CurrentUser]="CurrentUser"
          [ConversationId]="ConversationId"
          [ApplicationScope]="'Application'"
          [ApplicationId]="ApplicationId"
          [LinkedEntityId]="SpaceEntityId"
          [LinkedRecordId]="SpaceId"
          [DefaultAgentId]="DefaultAgentId"
          [ReadOnly]="IsReadOnly"
          [ReadOnlyMessage]="ReadOnlyNote"
          [AllowMentions]="AllowMentions"
          [AllowEntityMentions]="false"
          [AllowSkillCommands]="false"
          [AllowAttachments]="AllowAttachments"
          [AllowRealtime]="false"
          [AgentReplyMode]="AgentReplyMode"
          [AllowedAgentIDs]="AllowedAgentIDs"
          [EnableDecisionRouting]="EnableDecisionRouting"
          [MentionPeople]="MentionPeople"
          [AgentHistoryFrom]="AgentHistoryFrom"
          [AgentTurnHandler]="AgentTurnHandler"
          [AutoNameConversation]="AutoNameConversation"
          [ComposerDraft]="ComposerDraft"
          [PendingMessage]="PendingMessage"
          [PendingMessageConversationId]="PendingMessageConversationId"
          (ComposerDraftConsumed)="onComposerDraftConsumed()"
          (PendingMessageConsumed)="onPendingMessageConsumed()">
          
          <ng-template mjChatSlot="header">
            <div class="space-chat-header-slot">
              <div class="header-left">
                <div class="title-row">
                  <i [class]="AudienceBand === 'Team' ? 'fa-solid fa-lock hash-icon' : 'fa-solid fa-hashtag hash-icon'" aria-hidden="true"></i>
                  <span class="chat-title">{{ ConversationName || (SpaceName ? SpaceName + ' General' : 'General') }}</span>
                  <mjc-band-chip [Band]="AudienceBand" />
                </div>
                <div class="subtitle-row">
                  {{ AudienceSubtitle }}
                </div>
              </div>

              <div class="header-right">
                @if (IsReadOnly) {
                  <span class="read-only-lock-wrap">
                    <button
                      type="button"
                      class="read-only-lock"
                      [title]="ReadOnlyNote"
                      [attr.aria-label]="ReadOnlyNote"
                      [attr.aria-expanded]="ReasonShown"
                      [attr.aria-controls]="ReasonId"
                      (focus)="onLockFocus()"
                      (blur)="onLockBlur()"
                      (keydown.escape)="onLockEscape()"
                      (click)="onLockClick($event)">
                      <i class="fa-solid fa-lock" aria-hidden="true"></i>
                    </button>
                    @if (ReasonShown) {
                      <span class="read-only-reason" [id]="ReasonId">{{ ReadOnlyNote }}</span>
                    }
                  </span>
                }
                @if (ParticipantCount > 0) {
                  <div class="participant-count-pill" title="People who can see this conversation">
                    <i class="fa-solid fa-users"></i>
                    <span>{{ ParticipantCount }}</span>
                  </div>
                }
                @if (CanStartConversation && !IsReadOnly) {
                  <button
                    type="button"
                    mjButton
                    Variant="primary"
                    Size="sm"
                    class="btn-new-convo-header"
                    (click)="onNewConversation()"
                    title="New Conversation"
                    aria-label="New Conversation">
                    <i class="fa-solid fa-plus"></i>
                    <span>New Conversation</span>
                  </button>
                }
              </div>
            </div>

            <mjc-chat-scope-bar
              [RetrievalScope]="RetrievalScope"
              [AllowEverythingScope]="AllowEverythingScope"
              [Citations]="Citations"
              (RetrievalScopeChanged)="onScopeChange($event)"
              (CitationClicked)="onCitationClick($event)" />
          </ng-template>

        </mj-conversation-chat-area>
      } @else {
        <div class="no-conversation-state">
          @if (IsReadOnly) {
            <span class="read-only-lock-wrap read-only-lock-corner">
              <button
                type="button"
                class="read-only-lock"
                [title]="ReadOnlyNote"
                [attr.aria-label]="ReadOnlyNote"
                [attr.aria-expanded]="ReasonShown"
                [attr.aria-controls]="ReasonId"
                (focus)="onLockFocus()"
                (blur)="onLockBlur()"
                (keydown.escape)="onLockEscape()"
                (click)="onLockClick($event)">
                <i class="fa-solid fa-lock" aria-hidden="true"></i>
              </button>
              @if (ReasonShown) {
                <span class="read-only-reason" [id]="ReasonId">{{ ReadOnlyNote }}</span>
              }
            </span>
          }
          <mj-empty-state
            Icon="fa-solid fa-comments"
            [Title]="HasConversations ? 'Select a Conversation' : 'No conversations yet'"
            [Message]="emptyMessage"
            [ActionText]="CanStartConversation && !IsReadOnly ? 'New Conversation' : ''"
            ActionIcon="fa-solid fa-plus"
            (Action)="onNewConversation()" />
        </div>
      }
    </div>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
        background: var(--mj-bg-surface, #ffffff);
      }

      .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        position: relative;
      }

      .space-chat-header-slot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: var(--mj-bg-surface, #ffffff);
        border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
        gap: 12px;
      }

      .header-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .hash-icon {
        font-size: 14px;
        color: var(--mj-brand-primary, #0076b6);
      }

      .chat-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .subtitle-row {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .participant-count-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--mj-bg-surface-sunken, #f1f5f9);
        border: 1px solid var(--mj-border-default, #e2e8f0);
        color: var(--mj-text-secondary, #475569);
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 11.5px;
        font-weight: 600;
      }

      .no-conversation-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 24px;
        text-align: center;
      }




      .btn-new-convo-header {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .scope-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 16px;
        background: var(--mj-bg-surface-sunken, #f8fafc);
        border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
      }

      .scope-label {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--mj-text-secondary, #64748b);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-right: 2px;
      }

      .scope-pill {
        border: 1px solid var(--mj-border-default, #e2e8f0);
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-secondary, #475569);
        font-size: 11.5px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .scope-pill:hover {
        border-color: var(--mj-brand-primary, #0076b6);
        color: var(--mj-text-primary, #0f172a);
      }
      .scope-pill.active {
        background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 12%, transparent);
        border-color: var(--mj-brand-primary, #0076b6);
        color: var(--mj-brand-primary, #0076b6);
      }


      /* A conversation that can't be posted in says why from a lock, not a banner that takes a row: on hover, and, since a
         keyboard has no hover and a touch screen no pointer, on focus and on tap, from a button that shows the reason beside it */
      .read-only-lock-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .read-only-lock {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border-radius: 999px;
        font-size: 13px;
        color: var(--mj-status-warning, #d97706);
        background: var(--mj-bg-surface-sunken, #f1f5f9);
        border: 1px solid var(--mj-border-default, #e2e8f0);
        cursor: pointer;
      }
      .read-only-lock:focus-visible {
        outline: 2px solid var(--mj-brand-primary, #0076b6);
        outline-offset: 2px;
      }
      .read-only-reason {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 2;
        min-width: 220px;
        max-width: 320px;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1.4;
        color: var(--mj-text-primary);
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-default, #e2e8f0);
        box-shadow: var(--mj-shadow-md);
      }
      .read-only-lock-corner {
        position: absolute;
        top: 10px;
        right: 16px;
      }
      .chat-pending {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        min-height: 120px;
      }
    `,
  ],
})
export class CollabSpaceChatComponent implements OnInit {
  constructor(
    @Inject(ConversationStreamingService) private readonly streaming: ConversationStreamingService,
    /** This chat's own element: a click in another chat's lock on the same page is outside it. */
    @Inject(ElementRef) private readonly host: ElementRef<HTMLElement>,
  ) {}

  public ngOnInit(): void {
    this.streaming.initialize();
  }

  /** The conversation can be read and not posted in: MJ's chat area takes `ReadOnly` and shows `ReadOnlyNote` where the composer was, and the header's lock says why. */
  @Input() public IsReadOnly = false;
  /** The caller's seat is not known yet: neither a composer nor a note nor a lock, only a quiet wait, so nobody is told they can't post before the page knows. */
  @Input() public IsPending = false;
  @Input() public ReadOnlyNote = 'This space is closed. Conversations are read-only.';

  /** What the empty conversation area says, for someone who may start a conversation and for someone who may only read. */
  public get emptyMessage(): string {
    if (this.HasConversations) return this.CanStartConversation ? 'Choose a conversation from the space sidebar or start a new one.' : 'Choose a conversation from the space sidebar to read it.';
    return this.CanStartConversation ? 'Start a new conversation to begin collaborating.' : 'There are no conversations in this space.';
  }

  private static nextReasonId = 0;
  /** This instance's id for the reason, which the lock's `aria-controls` names: several chats can be on one page. */
  public readonly ReasonId = `mjc-read-only-reason-${++CollabSpaceChatComponent.nextReasonId}`;

  /**
   * The lock's reason is on screen: shown while the lock has focus, toggled by a tap, a click, Enter or Space, and closed by
   * Escape or by a tap or click anywhere else. It is the button's own label too, so it carries no live-region role of its own:
   * a screen reader has already read it.
   */
  public ReasonShown = false;
  /** Focus opened the reason, so the pointer's click that follows the mouse-down that focused the lock keeps it open. */
  private reasonOpenedByFocus = false;

  public onLockFocus(): void {
    this.ReasonShown = true;
    this.reasonOpenedByFocus = true;
  }

  public onLockBlur(): void {
    this.ReasonShown = false;
    this.reasonOpenedByFocus = false;
  }

  /** A click made by Enter or Space (`detail` 0) always toggles; only a pointer's click right after focus is the one that keeps the reason open. */
  public onLockClick(event: Pick<MouseEvent, 'detail'>): void {
    const pointerAfterFocus = this.reasonOpenedByFocus && event.detail > 0;
    this.reasonOpenedByFocus = false;
    this.ReasonShown = pointerAfterFocus ? true : !this.ReasonShown;
  }

  /** Escape closes the reason and leaves the focus on the lock. */
  public onLockEscape(): void {
    this.ReasonShown = false;
    this.reasonOpenedByFocus = false;
  }

  /** A tap or click outside this chat's own lock closes the reason: it covers what is under it. Another chat's lock on the same page is outside. */
  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: Pick<MouseEvent, 'target'>): void {
    if (!this.ReasonShown) return;
    const target = event.target;
    const lockWrap = target instanceof Element ? target.closest('.read-only-lock-wrap') : null;
    if (lockWrap && this.host.nativeElement.contains(lockWrap)) return;
    this.ReasonShown = false;
    this.reasonOpenedByFocus = false;
  }

  @Input() public ConversationId: string | null = null;
  @Input() public ConversationName: string = '';
  @Input() public EnvironmentId = '';
  @Input() public CurrentUser: UserInfo | null = null;
  @Input() public SpaceId = '';
  @Input() public SpaceName = '';
  @Input() public SpaceEntityId = '';
  @Input() public AudienceBand: SpaceBand = 'Shared';
  @Input() public ApplicationId: string | null = null;
  @Input() public DefaultAgentId: string | null = null;
  @Input() public ParticipantCount = 0;
  /** How many Active outside seats reach the space: the subtitle claims outside participants only when there are some. */
  @Input() public OutsideParticipantCount = 0;
  /** Who can read this conversation, in words, from the space's real audience. */
  public get AudienceSubtitle(): string {
    if (this.AudienceBand === 'Team') return 'Only the team can see this conversation.';
    return this.OutsideParticipantCount > 0
      ? 'Team members and outside participants can see this conversation.'
      : 'Everyone who can see this space can see this conversation.';
  }

  @Input() public AllowMentions = true;
  @Input() public AllowAttachments = false;
  @Input() public AgentReplyMode: AgentReplyMode = 'MentionOnly';
  @Input() public AllowedAgentIDs: readonly string[] = [];
  @Input() public EnableDecisionRouting = false;
  @Input() public CanStartConversation = false;
  @Input() public HasConversations = false;
  @Input() public MentionPeople: readonly MentionPerson[] | null = null;
  @Input() public AgentHistoryFrom: Date | null = null;
  @Input() public AgentTurnHandler: AgentTurnHandler | null = null;
  @Input() public AutoNameConversation: boolean = false;
  @Input() public ComposerDraft: string | null = null;
  @Input() public PendingMessage: string | null = null;
  @Input() public PendingMessageConversationId: string | null = null;
  @Input() public RetrievalScope: 'ThisSpace' | 'Subtree' | 'Everything' = 'Subtree';
  @Input() public AllowEverythingScope = false;
  @Input() public Citations: readonly SpaceChatCitationModel[] = [];

  @Output() public NewConversationRequested = new EventEmitter<void>();
  @Output() public ComposerDraftConsumed = new EventEmitter<void>();
  @Output() public PendingMessageConsumed = new EventEmitter<void>();
  @Output() public RetrievalScopeChanged = new EventEmitter<'ThisSpace' | 'Subtree' | 'Everything'>();
  @Output() public CitationClicked = new EventEmitter<SpaceChatCitationModel>();

  public onNewConversation(): void {
    this.NewConversationRequested.emit();
  }

  public onScopeChange(scope: 'ThisSpace' | 'Subtree' | 'Everything'): void {
    this.RetrievalScope = scope;
    this.RetrievalScopeChanged.emit(scope);
  }

  public onCitationClick(citation: SpaceChatCitationModel): void {
    this.CitationClicked.emit(citation);
  }

  public onComposerDraftConsumed(): void {
    this.ComposerDraft = null;
    this.ComposerDraftConsumed.emit();
  }

  public onPendingMessageConsumed(): void {
    this.PendingMessage = null;
    this.PendingMessageConsumed.emit();
  }
}
