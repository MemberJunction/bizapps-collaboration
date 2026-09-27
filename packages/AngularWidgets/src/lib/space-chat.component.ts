import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import type { UserInfo } from '@memberjunction/core';
import type { MJConversationEntity } from '@memberjunction/core-entities';
import { ConversationsModule } from '@memberjunction/ng-conversations';
import type { SpaceBand } from './types';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-space-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabBandChipComponent, ConversationsModule],
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
          [allowEntityMentions]="true"
          [allowSkillCommands]="true"
          [allowAttachments]="AllowAttachments"
          (conversationCreated)="onConversationCreated($event)">
          
          <ng-template mjChatSlot="header">
            <div class="space-chat-header-slot">
              <div class="header-left">
                <div class="title-row">
                  <i class="fa-solid fa-hashtag hash-icon"></i>
                  <span class="chat-title">{{ ConversationName || SpaceName + ' Room' }}</span>
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
            Choose a channel from the space sidebar or start a new conversation to begin chatting with your team and the AI assistant.
          </p>
          <button type="button" class="btn-create-convo" (click)="onNewConversationClick()">
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

      .btn-create-convo {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--mj-brand-primary, #0076b6);
        color: #ffffff;
        border: none;
        padding: 8px 18px;
        border-radius: 6px;
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .btn-create-convo:hover {
        background: var(--mj-brand-primary-hover, #005a8c);
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
  @Input() public AllowAttachments = true;

  @Output() public ConversationCreated = new EventEmitter<{ conversationId: string; name?: string }>();
  @Output() public NewConversationRequested = new EventEmitter<void>();

  public onConversationCreated(event: { conversation: MJConversationEntity }): void {
    this.ConversationCreated.emit({ conversationId: event.conversation.ID, name: event.conversation.Name ?? undefined });
  }

  public onNewConversationClick(): void {
    this.NewConversationRequested.emit();
  }
}
