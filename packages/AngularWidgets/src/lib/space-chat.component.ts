import {
  ChangeDetectionStrategy,
  Component,
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
  imports: [CollabBandChipComponent, ConversationsModule, MJButtonDirective, MJEmptyStateComponent, SharedGenericModule],
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
  constructor(@Inject(ConversationStreamingService) private readonly streaming: ConversationStreamingService) {}

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

  /** A tap or click outside the lock closes the reason: it covers what is under it. */
  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: Pick<MouseEvent, 'target'>): void {
    if (!this.ReasonShown) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.read-only-lock-wrap')) return;
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
  @Input() public CanStartConversation = false;
  @Input() public HasConversations = false;
  @Input() public MentionPeople: readonly MentionPerson[] | null = null;
  @Input() public AgentHistoryFrom: Date | null = null;
  @Input() public AgentTurnHandler: AgentTurnHandler | null = null;
  @Input() public AutoNameConversation: boolean = false;
  @Input() public ComposerDraft: string | null = null;
  @Input() public PendingMessage: string | null = null;
  @Input() public PendingMessageConversationId: string | null = null;

  @Output() public NewConversationRequested = new EventEmitter<void>();
  @Output() public ComposerDraftConsumed = new EventEmitter<void>();
  @Output() public PendingMessageConsumed = new EventEmitter<void>();

  public onNewConversation(): void {
    this.NewConversationRequested.emit();
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
