import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import type { UserInfo } from '@memberjunction/core';
import {
  ConversationsModule,
  type AgentReplyMode,
  type AgentTurnHandler,
} from '@memberjunction/ng-conversations';
import type { MentionPerson } from '@memberjunction/conversations-runtime';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import type { SpaceBand } from './types';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-space-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabBandChipComponent, ConversationsModule, MJButtonDirective],
  template: `
    <div class="chat-container">
      @if (ConversationId && CurrentUser) {
        <mj-conversation-chat-area
          [environmentId]="EnvironmentId"
          [currentUser]="CurrentUser"
          [conversationId]="ConversationId"
          [applicationScope]="'Application'"
          [applicationId]="ApplicationId"
          [linkedEntityId]="SpaceEntityId"
          [linkedRecordId]="SpaceId"
          [defaultAgentId]="DefaultAgentId"
          [assistantDisplayName]="'Assistant'"
          [allowMentions]="AllowMentions"
          [allowAgentMentions]="true"
          [allowEntityMentions]="false"
          [allowSkillCommands]="false"
          [allowAttachments]="AllowAttachments"
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
                  <i class="fa-solid fa-hashtag hash-icon"></i>
                  <span class="chat-title">{{ ConversationName || (SpaceName ? SpaceName + ' General' : 'General') }}</span>
                  <mjc-band-chip [Band]="AudienceBand" />
                </div>
                <div class="subtitle-row">
                  @if (AudienceBand === 'Shared') {
                    Shared channel with team members and outside participants.
                  } @else {
                    Private internal team discussion channel.
                  }
                </div>
              </div>

              <div class="header-right">
                @if (ParticipantCount > 0) {
                  <div class="participant-count-pill" title="Participants in this channel">
                    <i class="fa-solid fa-users"></i>
                    <span>{{ ParticipantCount }}</span>
                  </div>
                }
                <button
                  type="button"
                  mjButton
                  variant="primary"
                  size="sm"
                  class="btn-new-convo-header"
                  (click)="onNewConversation()"
                  title="New Conversation"
                  aria-label="New Conversation">
                  <i class="fa-solid fa-plus"></i>
                  <span>New Conversation</span>
                </button>
              </div>
            </div>
          </ng-template>

        </mj-conversation-chat-area>
      } @else {
        <div class="no-conversation-state">
          <div class="empty-icon-wrap">
            <i class="fa-solid fa-comments"></i>
          </div>
          <h3 class="empty-title">Select a Conversation</h3>
          <p class="empty-desc">
            Choose a channel from the space sidebar or start a new conversation.
          </p>
          <button
            type="button"
            mjButton
            variant="primary"
            size="md"
            class="btn-new-convo"
            (click)="onNewConversation()">
            <i class="fa-solid fa-plus"></i>
            <span>New Conversation</span>
          </button>
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

      .empty-icon-wrap {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--mj-bg-surface-sunken, #f1f5f9);
        border: 1px solid var(--mj-border-default, #e2e8f0);
        display: grid;
        place-items: center;
        font-size: 26px;
        color: var(--mj-brand-primary, #0076b6);
        margin-bottom: 16px;
      }

      .empty-title {
        font-size: 17px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
        margin-bottom: 6px;
      }

      .empty-desc {
        max-width: 420px;
        font-size: 13.5px;
        color: var(--mj-text-secondary, #64748b);
        line-height: 1.5;
        margin-bottom: 20px;
      }

      .btn-new-convo-header {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn-new-convo {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    `,
  ],
})
export class CollabSpaceChatComponent {
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
  @Input() public AllowMentions = true;
  @Input() public AllowAttachments = false;
  @Input() public AgentReplyMode: AgentReplyMode = 'MentionOnly';
  @Input() public AllowedAgentIDs: readonly string[] | null = null;
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
