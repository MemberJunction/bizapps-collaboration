import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  SimpleChanges,
  ViewChild,
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

export interface WorkstreamLinkedItem {
  kind: 'task' | 'file';
  id: string;
  title: string;
  status?: string;
}

export interface ChatThreadMessageLike {
  ID: string;
  ParentID?: string | null;
  Role?: string | null;
  Message?: string | null;
  UserID?: string | null;
  AgentID?: string | null;
  User?: string | null;
  Agent?: string | null;
  Status?: string | null;
  __mj_CreatedAt?: Date | string | null;
}

export interface PendingAgentPromptState {
  messageId: string;
  messageText: string;
  reasonLabel: string;
  suggestedAgentName: string;
  suggestedAgentId: string | null;
}

/**
 * The conversation of a space: MemberJunction's chat area, held to the space's audience and rules,
 * plus the UI representation of multi-party speaker attribution, thread replies (`ParentID` / `ThreadReply`),
 * live agent execution progress bar, and the "Ask if an agent should go" prompt (MJ PR #6176).
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
          #chatAreaRef
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
          [CollapseThreadReplies]="true"
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
            <div class="space-chat-header-wrap">
              <div class="space-chat-header-slot">
                <div class="header-left">
                  <div class="title-row">
                    <i [class]="AudienceBand === 'Team' ? 'fa-solid fa-lock hash-icon' : (LinkedWorkstreamItem ? 'fa-solid fa-bullseye hash-icon' : 'fa-solid fa-hashtag hash-icon')" aria-hidden="true"></i>
                    <span class="chat-title">{{ ConversationName || (SpaceName ? SpaceName + ' General' : 'General') }}</span>
                    <mjc-band-chip [Band]="AudienceBand" />
                    @if (LinkedWorkstreamItem) {
                      <button
                        type="button"
                        class="linked-workstream-pill"
                        data-testid="linked-workstream-pill"
                        (click)="onOpenLinkedItem()"
                        [title]="'Open linked ' + (LinkedWorkstreamItem.kind === 'task' ? 'task' : 'document') + ': ' + LinkedWorkstreamItem.title">
                        <i [class]="LinkedWorkstreamItem.kind === 'task' ? 'fa-solid fa-list-check' : 'fa-solid fa-file-lines'" aria-hidden="true"></i>
                        <span class="linked-kind-label">{{ LinkedWorkstreamItem.kind === 'task' ? 'Task:' : 'Doc:' }}</span>
                        <span class="linked-title-text">{{ LinkedWorkstreamItem.title }}</span>
                        @if (LinkedWorkstreamItem.status) {
                          <span class="linked-status-badge">{{ LinkedWorkstreamItem.status }}</span>
                        }
                        <i class="fa-solid fa-arrow-up-right-from-square linked-jump-icon" aria-hidden="true"></i>
                      </button>
                    }
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
                    <div class="participant-pill-wrap">
                      <button
                        type="button"
                        class="participant-count-pill"
                        data-testid="chat-participants-pill"
                        [class.open]="showParticipantsPopover"
                        [attr.aria-expanded]="showParticipantsPopover"
                        (click)="toggleParticipantsPopover($event)"
                        title="View people &amp; AI agents in this conversation">
                        <i class="fa-solid fa-users" aria-hidden="true"></i>
                        <span>{{ ParticipantCount }}</span>
                        <i class="fa-solid fa-chevron-down participant-pill-caret" [class.open]="showParticipantsPopover" aria-hidden="true"></i>
                      </button>

                      @if (showParticipantsPopover) {
                        <div class="chat-participants-popover" data-testid="chat-participants-popover" role="dialog" aria-label="Conversation participants">
                          <div class="chat-participants-head">
                            <span class="chat-participants-title">In this conversation ({{ conversationParticipantsList.length }})</span>
                            <span class="chat-participants-sub">{{ AudienceBand === 'Team' ? 'Team only' : 'Shared audience' }}</span>
                          </div>
                          <div class="chat-participants-list">
                            @for (person of conversationParticipantsList; track person.id) {
                              <div class="chat-participant-row">
                                <div class="chat-participant-avatar" [class.is-ai]="person.isAi">
                                  @if (person.imageUrl) {
                                    <img [src]="person.imageUrl" [alt]="person.name" class="avatar-img" />
                                  } @else {
                                    <i [class]="person.iconClass" aria-hidden="true"></i>
                                  }
                                </div>
                                <div class="chat-participant-info">
                                  <div class="chat-participant-name-line">
                                    <span class="chat-participant-name">{{ person.name }}</span>
                                    <span class="chat-participant-badge" [class.is-ai]="person.isAi">{{ person.role }}</span>
                                  </div>
                                  @if (person.subtitle) {
                                    <span class="chat-participant-sub">{{ person.subtitle }}</span>
                                  }
                                </div>
                                @if (!IsReadOnly) {
                                  <button
                                    type="button"
                                    class="chat-participant-mention-btn"
                                    data-testid="chat-participant-mention-btn"
                                    (click)="mentionParticipant(person.name)"
                                    [title]="'Mention @' + person.name + ' in message'">
                                    &#64;Mention
                                  </button>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- PR #6176: Live Agent Activity & Routing Decision Progress Bar -->
              @if (isRoutingCheck || isAgentWorking) {
                <div class="agent-working-progress-banner" data-testid="agent-working-progress-bar" role="status" aria-live="polite">
                  <div class="agent-progress-track">
                    <div
                      class="agent-progress-fill"
                      [class.indeterminate]="activeAgentProgressPercent === null"
                      [style.width.%]="activeAgentProgressPercent ?? 42">
                    </div>
                  </div>
                  <div class="agent-progress-body">
                    <div class="agent-progress-left">
                      <span class="agent-pulse-dot" aria-hidden="true"></span>
                      <i class="fa-solid fa-robot agent-progress-icon" aria-hidden="true"></i>
                      @if (isRoutingCheck && !isAgentWorking) {
                        <span class="agent-progress-title">Evaluating addressee routing…</span>
                        <span class="agent-progress-step">Checking speaker attribution &amp; thread context to see if an AI agent should respond</span>
                      } @else {
                        <span class="agent-progress-title">&#64;{{ activeAgentName || DefaultAgentName }} is working</span>
                        @if (activeAgentRoute) {
                          <span class="agent-route-badge" data-testid="agent-route-badge">{{ formatRouteBadge(activeAgentRoute) }}</span>
                        }
                        <span class="agent-progress-step">{{ activeAgentStatusText || 'Generating response…' }}</span>
                      }
                    </div>
                    @if (activeAgentElapsed) {
                      <span class="agent-progress-elapsed">{{ activeAgentElapsed }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          </ng-template>

          <!-- PR #6176: Slack-style Collapsed Thread Bar & Expandable Thread Replies Under Parent Message -->
          <ng-template mjChatSlot="messageExtra" let-message="message">
            @if (message) {
              <div class="msg-thread-extra" [attr.data-message-id]="message.ID">
                @if (getParentMessage(message); as parentMsg) {
                  <button
                    type="button"
                    class="msg-thread-parent-chip"
                    data-testid="message-thread-parent"
                    (click)="scrollToMessage(parentMsg.ID)"
                    [title]="'Jump to parent message from ' + getSpeakerName(parentMsg)">
                    <i class="fa-solid fa-reply" aria-hidden="true"></i>
                    <span class="parent-speaker">Replying to {{ getSpeakerName(parentMsg) }}</span>
                    <span class="parent-excerpt">"{{ getMessageExcerpt(parentMsg, 64) }}"</span>
                    @if (isAiMessage(message) && !isAiMessage(parentMsg)) {
                      <span class="thread-route-tag">Thread Reply</span>
                    }
                  </button>
                }

                <div class="msg-thread-actions-row">
                  @if (getRepliesFor(message.ID).length > 0) {
                    <button
                      type="button"
                      class="msg-thread-replies-btn slack-thread-bar"
                      data-testid="message-thread-replies"
                      [class.expanded]="isThreadExpanded(message.ID)"
                      [attr.aria-expanded]="isThreadExpanded(message.ID)"
                      (click)="toggleThreadExpanded(message.ID)">
                      <span class="thread-avatar-stack">
                        @for (part of getThreadParticipants(message.ID); track part.key) {
                          <span class="thread-mini-avatar" [class.is-ai]="part.isAi" [title]="part.name">
                            @if (part.imageUrl) {
                              <img [src]="part.imageUrl" [alt]="part.name" class="avatar-img" />
                            } @else {
                              <i [class]="part.iconClass" aria-hidden="true"></i>
                            }
                          </span>
                        }
                      </span>
                      <span class="thread-reply-count">
                        {{ getRepliesFor(message.ID).length }} {{ getRepliesFor(message.ID).length === 1 ? 'reply' : 'replies' }}
                      </span>
                      @if (hasInProgressReply(message.ID)) {
                        <span class="thread-live-pill">
                          <span class="thread-live-dot" aria-hidden="true"></span>
                          &#64;{{ activeAgentName || DefaultAgentName }} is replying…
                        </span>
                      } @else {
                        <span class="thread-last-speaker">Last reply from {{ getLastReplySpeaker(message.ID) }}</span>
                      }
                      <span class="thread-view-cue">
                        <span>{{ isThreadExpanded(message.ID) ? 'Hide thread' : 'View thread' }}</span>
                        <i [class]="isThreadExpanded(message.ID) ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-right'" aria-hidden="true"></i>
                      </span>
                    </button>
                  }

                  @if (!IsReadOnly && message.ID) {
                    <button
                      type="button"
                      class="msg-reply-btn"
                      data-testid="message-reply-btn"
                      [class.active]="replyToMessage?.ID === message.ID"
                      (click)="startReplyTo(message)"
                      title="Reply in thread (sets ParentID for addressee routing)">
                      <i class="fa-solid fa-reply" aria-hidden="true"></i>
                      <span>{{ getRepliesFor(message.ID).length > 0 ? 'Reply in thread' : 'Reply' }}</span>
                    </button>
                  }
                </div>

                @if (isThreadExpanded(message.ID) && getRepliesFor(message.ID).length > 0) {
                  <div class="msg-thread-replies-drawer" data-testid="message-thread-drawer" role="region" aria-label="Thread replies">
                    @for (reply of getRepliesFor(message.ID); track reply.ID) {
                      <div class="thread-reply-item" [attr.data-message-id]="reply.ID">
                        <div class="thread-reply-avatar" [class.is-ai]="isAiMessage(reply)">
                          @if (getSpeakerAvatarUrl(reply); as avatarUrl) {
                            <img [src]="avatarUrl" [alt]="getSpeakerName(reply)" class="avatar-img" />
                          } @else {
                            <i [class]="getSpeakerAvatarIconClass(reply)" aria-hidden="true"></i>
                          }
                        </div>
                        <div class="thread-reply-content">
                          <div class="thread-reply-meta">
                            <div class="thread-reply-meta-left">
                              <span class="thread-reply-author" [class.is-ai]="isAiMessage(reply)">
                                {{ getSpeakerName(reply) }}
                              </span>
                              <span class="thread-reply-role-pill" [class.is-ai]="isAiMessage(reply)">
                                {{ isAiMessage(reply) ? 'AI Agent' : 'Participant' }}
                              </span>
                              @if (getNestedReplyTargetName(reply, message.ID); as nestedTarget) {
                                <span class="thread-nested-target">
                                  <i class="fa-solid fa-reply" aria-hidden="true"></i>
                                  to {{ nestedTarget }}
                                </span>
                              }
                            </div>
                            @if (!IsReadOnly && reply.ID) {
                              <button
                                type="button"
                                class="thread-inline-reply-btn"
                                [class.active]="replyToMessage?.ID === reply.ID"
                                (click)="startReplyTo(reply); $event.stopPropagation()"
                                [title]="'Reply to ' + getSpeakerName(reply) + ' in thread'">
                                <i class="fa-solid fa-reply" aria-hidden="true"></i>
                                <span>Reply</span>
                              </button>
                            }
                          </div>
                          <div class="thread-reply-body">{{ getFormattedMessageBody(reply) }}</div>
                        </div>
                      </div>
                    }
                    @if (!IsReadOnly) {
                      <div class="thread-drawer-footer">
                        <button
                          type="button"
                          class="thread-drawer-reply-btn"
                          (click)="startReplyTo(getLatestThreadTarget(message))">
                          <i class="fa-solid fa-reply" aria-hidden="true"></i>
                          <span>Reply in thread</span>
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </ng-template>

          <!-- PR #6176: Composer Thread Reply Bar & "Ask if an Agent Should Go" Prompt -->
          <ng-template mjChatSlot="composerExtra">
            @if (replyToMessage) {
              <div class="composer-reply-banner" data-testid="composer-reply-banner" role="region" aria-label="Replying in thread">
                <div class="reply-banner-left">
                  <i class="fa-solid fa-reply reply-banner-icon" aria-hidden="true"></i>
                  <div class="reply-banner-info">
                    <div class="reply-banner-top">
                      <span class="reply-banner-label">Replying to <strong>{{ getSpeakerName(replyToMessage) }}</strong></span>
                      @if (isAiMessage(replyToMessage)) {
                        <span class="route-preview-pill agent" data-testid="reply-route-pill">
                          <i class="fa-solid fa-robot" aria-hidden="true"></i>
                          <span>ThreadReply &rarr; &#64;{{ getSpeakerName(replyToMessage) }} will respond</span>
                        </span>
                      } @else {
                        <span class="route-preview-pill human" data-testid="reply-route-pill">
                          <i class="fa-solid fa-user-check" aria-hidden="true"></i>
                          <span>Human thread reply &middot; AI stays silent unless &#64;mentioned</span>
                        </span>
                      }
                    </div>
                    <div class="reply-banner-excerpt">"{{ getMessageExcerpt(replyToMessage, 90) }}"</div>
                  </div>
                </div>
                <button
                  type="button"
                  class="reply-banner-close"
                  data-testid="composer-reply-cancel"
                  (click)="clearReplyTo()"
                  title="Cancel thread reply"
                  aria-label="Cancel thread reply">
                  <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </div>
            }

            @if (pendingAgentPrompt) {
              <div class="ask-agent-prompt-bar" data-testid="ask-agent-should-go-bar" role="region" aria-label="Ask if an AI agent should respond">
                <div class="ask-agent-left">
                  <div class="ask-agent-icon">
                    <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                  </div>
                  <div class="ask-agent-text">
                    <span class="ask-agent-title">No AI agent stepped in</span>
                    <span class="ask-agent-reason">({{ pendingAgentPrompt.reasonLabel }}). Should an agent respond to this message?</span>
                  </div>
                </div>
                <div class="ask-agent-actions">
                  <button
                    type="button"
                    class="ask-agent-confirm-btn"
                    data-testid="ask-agent-go-confirm"
                    (click)="confirmAgentShouldGo()">
                    <i class="fa-solid fa-robot" aria-hidden="true"></i>
                    <span>Let &#64;{{ pendingAgentPrompt.suggestedAgentName }} respond</span>
                  </button>
                  <button
                    type="button"
                    class="ask-agent-dismiss-btn"
                    data-testid="ask-agent-go-dismiss"
                    (click)="dismissAgentPrompt()">
                    <span>Keep human-only</span>
                  </button>
                </div>
              </div>
            }
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
        background: var(--mj-bg-surface);
      }

      .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        position: relative;
      }

      .space-chat-header-wrap {
        display: flex;
        flex-direction: column;
        background: var(--mj-bg-surface);
        border-bottom: 1px solid var(--mj-border-default);
      }

      .space-chat-header-slot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: var(--mj-bg-surface);
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
        flex-wrap: wrap;
      }

      .hash-icon {
        font-size: 14px;
        color: var(--mj-brand-primary);
      }

      .chat-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--mj-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Linked Actionable Item pill on Workstreams */
      .linked-workstream-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--mj-brand-tertiary) 35%, var(--mj-border-default));
        background: color-mix(in srgb, var(--mj-brand-tertiary) 8%, var(--mj-bg-surface));
        color: var(--mj-text-primary);
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--mj-transition-fast);
        max-width: 280px;
      }
      .linked-workstream-pill:hover {
        background: color-mix(in srgb, var(--mj-brand-tertiary) 14%, var(--mj-bg-surface));
        border-color: var(--mj-brand-tertiary);
      }
      .linked-workstream-pill i:first-child {
        color: var(--mj-brand-tertiary);
        font-size: 11px;
      }
      .linked-kind-label {
        color: var(--mj-text-secondary);
        font-weight: 600;
      }
      .linked-title-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .linked-status-badge {
        padding: 1px 6px;
        border-radius: 999px;
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-default);
        font-size: 10px;
        font-weight: 700;
        color: var(--mj-text-secondary);
      }
      .linked-jump-icon {
        font-size: 10px;
        color: var(--mj-text-muted);
      }

      .subtitle-row {
        font-size: 12px;
        color: var(--mj-text-secondary);
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .participant-pill-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .participant-count-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--mj-bg-surface-sunken);
        border: 1px solid var(--mj-border-default);
        color: var(--mj-text-secondary);
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--mj-transition-fast);
      }
      .participant-count-pill:hover,
      .participant-count-pill.open {
        border-color: var(--mj-brand-primary);
        color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 7%, var(--mj-bg-surface));
      }
      .participant-pill-caret {
        font-size: 9px;
        opacity: 0.7;
        transition: transform var(--mj-transition-fast);
      }
      .participant-pill-caret.open {
        transform: rotate(180deg);
      }

      .chat-participants-popover {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 40;
        width: 300px;
        max-height: 360px;
        display: flex;
        flex-direction: column;
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-default);
        border-radius: 12px;
        box-shadow: var(--mj-shadow-lg);
        overflow: hidden;
      }

      .chat-participants-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-bottom: 1px solid var(--mj-border-subtle);
        background: var(--mj-bg-surface-sunken);
      }

      .chat-participants-title {
        font-size: 12px;
        font-weight: 700;
        color: var(--mj-text-primary);
      }

      .chat-participants-sub {
        font-size: 10.5px;
        font-weight: 600;
        color: var(--mj-text-muted);
      }

      .chat-participants-list {
        display: flex;
        flex-direction: column;
        padding: 6px;
        overflow-y: auto;
        gap: 2px;
      }

      .chat-participant-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 8px;
        border-radius: 8px;
      }
      .chat-participant-row:hover {
        background: var(--mj-bg-surface-hover);
      }

      .chat-participant-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 12px;
        background: var(--mj-text-primary);
        color: var(--mj-text-inverse);
        flex-shrink: 0;
        overflow: hidden;
      }
      .chat-participant-avatar.is-ai {
        border-radius: 7px;
        background: var(--mj-brand-primary);
        color: var(--mj-text-inverse);
      }

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }

      .chat-participant-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }

      .chat-participant-name-line {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .chat-participant-name {
        font-size: 12.5px;
        font-weight: 650;
        color: var(--mj-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chat-participant-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 999px;
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-secondary);
      }
      .chat-participant-badge.is-ai {
        background: color-mix(in srgb, var(--mj-brand-tertiary) 12%, transparent);
        color: var(--mj-brand-tertiary);
      }

      .chat-participant-sub {
        font-size: 11px;
        color: var(--mj-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chat-participant-mention-btn {
        padding: 3px 8px;
        border-radius: 6px;
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-brand-primary);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex-shrink: 0;
      }
      .chat-participant-mention-btn:hover {
        border-color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 8%, var(--mj-bg-surface));
      }

      /* PR #6176: Live Agent Activity & Routing Decision Progress Bar */
      .agent-working-progress-banner {
        display: flex;
        flex-direction: column;
        background: color-mix(in srgb, var(--mj-brand-primary) 5%, var(--mj-bg-surface));
        border-top: 1px solid color-mix(in srgb, var(--mj-brand-primary) 18%, var(--mj-border-default));
      }

      .agent-progress-track {
        width: 100%;
        height: 3px;
        background: color-mix(in srgb, var(--mj-brand-primary) 14%, transparent);
        overflow: hidden;
        position: relative;
      }

      .agent-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--mj-brand-primary), var(--mj-brand-tertiary));
        transition: width 0.25s ease;
      }

      .agent-progress-fill.indeterminate {
        width: 38%;
        animation: mjcAgentProgressSlide 1.4s ease-in-out infinite;
      }

      @keyframes mjcAgentProgressSlide {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(120%); }
        100% { transform: translateX(260%); }
      }

      .agent-progress-body {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 16px;
        font-size: 12px;
      }

      .agent-progress-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex-wrap: wrap;
      }

      .agent-pulse-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--mj-brand-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--mj-brand-primary) 24%, transparent);
      }

      .agent-progress-icon {
        color: var(--mj-brand-primary);
        font-size: 12px;
      }

      .agent-progress-title {
        font-weight: 700;
        color: var(--mj-text-primary);
      }

      .agent-route-badge {
        display: inline-flex;
        align-items: center;
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 10.5px;
        font-weight: 700;
        background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
        color: var(--mj-brand-primary);
        border: 1px solid color-mix(in srgb, var(--mj-brand-primary) 25%, transparent);
      }

      .agent-progress-step {
        color: var(--mj-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .agent-progress-elapsed {
        font-size: 11px;
        font-weight: 600;
        color: var(--mj-text-muted);
        font-variant-numeric: tabular-nums;
      }

      /* PR #6176: Slack-style Collapsed Thread Bar & Expandable Thread Replies */
      .msg-thread-extra {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 6px;
      }

      .msg-thread-parent-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        align-self: flex-start;
        padding: 3px 9px;
        border-radius: 6px;
        border: 1px solid var(--mj-border-default);
        border-left: 3px solid var(--mj-brand-primary);
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-secondary);
        font-size: 11.5px;
        cursor: pointer;
        max-width: 100%;
        text-align: left;
      }
      .msg-thread-parent-chip:hover {
        background: var(--mj-bg-surface-hover);
        color: var(--mj-text-primary);
      }
      .msg-thread-parent-chip i {
        font-size: 10px;
        color: var(--mj-brand-primary);
      }
      .parent-speaker {
        font-weight: 700;
        color: var(--mj-text-primary);
        white-space: nowrap;
      }
      .parent-excerpt {
        color: var(--mj-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .thread-route-tag {
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        background: color-mix(in srgb, var(--mj-brand-primary) 12%, transparent);
        color: var(--mj-brand-primary);
        white-space: nowrap;
      }

      .msg-thread-actions-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      /* Slack-style Collapsed Thread Bar */
      .msg-thread-replies-btn.slack-thread-bar {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px 4px 6px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: color-mix(in srgb, var(--mj-brand-primary) 5%, var(--mj-bg-surface));
        color: var(--mj-text-secondary);
        font-size: 12px;
        cursor: pointer;
        transition: all var(--mj-transition-fast);
        max-width: 100%;
      }
      .msg-thread-replies-btn.slack-thread-bar:hover,
      .msg-thread-replies-btn.slack-thread-bar.expanded {
        border-color: color-mix(in srgb, var(--mj-brand-primary) 35%, var(--mj-border-default));
        background: color-mix(in srgb, var(--mj-brand-primary) 9%, var(--mj-bg-surface));
      }

      .thread-avatar-stack {
        display: inline-flex;
        align-items: center;
      }

      .thread-mini-avatar {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: inline-grid;
        place-items: center;
        font-size: 9.5px;
        background: var(--mj-text-primary);
        color: var(--mj-text-inverse);
        border: 1.5px solid var(--mj-bg-surface);
        margin-left: -4px;
        overflow: hidden;
      }
      .thread-mini-avatar:first-child {
        margin-left: 0;
      }
      .thread-mini-avatar.is-ai {
        border-radius: 5px;
        background: var(--mj-brand-primary);
        color: var(--mj-text-inverse);
      }

      .thread-reply-count {
        font-weight: 700;
        color: var(--mj-brand-primary);
        white-space: nowrap;
      }

      .thread-last-speaker {
        font-size: 11.5px;
        color: var(--mj-text-muted);
        white-space: nowrap;
      }

      .thread-live-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 600;
        color: var(--mj-brand-tertiary);
      }

      .thread-live-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: var(--mj-brand-tertiary);
      }

      .thread-view-cue {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 600;
        color: var(--mj-brand-primary);
        margin-left: 2px;
      }
      .thread-view-cue i {
        font-size: 9.5px;
      }

      .msg-reply-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        border-radius: 6px;
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--mj-transition-fast);
      }
      .msg-reply-btn:hover,
      .msg-reply-btn.active {
        border-color: var(--mj-brand-primary);
        color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 8%, var(--mj-bg-surface));
      }

      .msg-thread-replies-drawer {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        margin-top: 4px;
        border-left: 3px solid var(--mj-brand-primary);
        background: var(--mj-bg-surface-sunken);
        border: 1px solid var(--mj-border-default);
        border-left-width: 3px;
        border-left-color: var(--mj-brand-primary);
        border-radius: 0 10px 10px 0;
      }

      .thread-reply-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-subtle);
      }

      .thread-reply-avatar {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 11px;
        background: var(--mj-text-primary);
        color: var(--mj-text-inverse);
        flex-shrink: 0;
        margin-top: 1px;
        overflow: hidden;
      }
      .thread-reply-avatar.is-ai {
        border-radius: 6px;
        background: var(--mj-brand-primary);
        color: var(--mj-text-inverse);
      }

      .thread-reply-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        flex: 1;
      }

      .thread-reply-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11.5px;
      }

      .thread-reply-meta-left {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .thread-reply-author {
        font-weight: 700;
        color: var(--mj-text-primary);
      }
      .thread-reply-author.is-ai {
        color: var(--mj-brand-tertiary);
      }

      .thread-reply-role-pill {
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 999px;
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-secondary);
      }
      .thread-reply-role-pill.is-ai {
        background: color-mix(in srgb, var(--mj-brand-tertiary) 12%, transparent);
        color: var(--mj-brand-tertiary);
      }

      .thread-nested-target {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10.5px;
        color: var(--mj-text-muted);
      }
      .thread-nested-target i {
        font-size: 9px;
      }

      .thread-inline-reply-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 7px;
        border-radius: 5px;
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        font-size: 10.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .thread-inline-reply-btn:hover,
      .thread-inline-reply-btn.active {
        border-color: var(--mj-brand-primary);
        color: var(--mj-brand-primary);
      }

      .thread-reply-body {
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--mj-text-primary);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .thread-drawer-footer {
        display: flex;
        align-items: center;
        padding-top: 2px;
      }

      .thread-drawer-reply-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px dashed color-mix(in srgb, var(--mj-brand-primary) 40%, var(--mj-border-default));
        background: var(--mj-bg-surface);
        color: var(--mj-brand-primary);
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .thread-drawer-reply-btn:hover {
        background: color-mix(in srgb, var(--mj-brand-primary) 6%, var(--mj-bg-surface));
      }

      /* PR #6176: Composer Thread Reply Banner */
      .composer-reply-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 14px;
        margin: 0 12px 6px;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--mj-brand-primary) 28%, var(--mj-border-default));
        background: color-mix(in srgb, var(--mj-brand-primary) 5%, var(--mj-bg-surface));
      }

      .reply-banner-left {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        min-width: 0;
      }

      .reply-banner-icon {
        margin-top: 3px;
        color: var(--mj-brand-primary);
        font-size: 12px;
      }

      .reply-banner-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .reply-banner-top {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .reply-banner-label {
        font-size: 12px;
        color: var(--mj-text-primary);
      }

      .route-preview-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
      }
      .route-preview-pill.agent {
        background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
        color: var(--mj-brand-primary);
      }
      .route-preview-pill.human {
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-secondary);
      }

      .reply-banner-excerpt {
        font-size: 11.5px;
        color: var(--mj-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .reply-banner-close {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--mj-text-secondary);
        cursor: pointer;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .reply-banner-close:hover {
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-primary);
      }

      /* PR #6176: "Ask if an agent should go" Prompt Bar */
      .ask-agent-prompt-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 14px;
        margin: 0 12px 6px;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--mj-brand-tertiary) 35%, var(--mj-border-default));
        background: color-mix(in srgb, var(--mj-brand-tertiary) 6%, var(--mj-bg-surface));
        flex-wrap: wrap;
      }

      .ask-agent-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .ask-agent-icon {
        width: 26px;
        height: 26px;
        border-radius: 7px;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--mj-brand-tertiary) 14%, transparent);
        color: var(--mj-brand-tertiary);
        font-size: 12px;
        flex-shrink: 0;
      }

      .ask-agent-text {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 12px;
      }

      .ask-agent-title {
        font-weight: 700;
        color: var(--mj-text-primary);
      }

      .ask-agent-reason {
        color: var(--mj-text-secondary);
      }

      .ask-agent-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .ask-agent-confirm-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 11px;
        border-radius: 7px;
        border: 1px solid var(--mj-brand-primary);
        background: var(--mj-brand-primary);
        color: var(--mj-text-inverse);
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .ask-agent-confirm-btn:hover {
        background: var(--mj-brand-primary-hover);
      }

      .ask-agent-dismiss-btn {
        display: inline-flex;
        align-items: center;
        padding: 5px 10px;
        border-radius: 7px;
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .ask-agent-dismiss-btn:hover {
        color: var(--mj-text-primary);
        border-color: var(--mj-border-strong);
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
        color: var(--mj-status-warning);
        background: var(--mj-bg-surface-sunken);
        border: 1px solid var(--mj-border-default);
        cursor: pointer;
      }
      .read-only-lock:focus-visible {
        outline: 2px solid var(--mj-brand-primary);
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
        border: 1px solid var(--mj-border-default);
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
export class CollabSpaceChatComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  constructor(
    @Optional() @Inject(ConversationStreamingService) private readonly streaming?: ConversationStreamingService,
    /** This chat's own element: a click in another chat's lock on the same page is outside it. */
    @Optional() @Inject(ElementRef) private readonly host?: ElementRef<HTMLElement>,
    @Optional() @Inject(ChangeDetectorRef) private readonly cdr?: ChangeDetectorRef,
  ) {}

  @ViewChild('chatAreaRef') private chatArea?: unknown;

  private boundChatArea: unknown = null;
  private boundInputInstance: unknown = null;
  private cleanups: Array<() => void> = [];
  private noAgentPromptTimer: ReturnType<typeof setTimeout> | undefined;

  public ngOnInit(): void {
    this.streaming?.initialize();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['ConversationId'] && !changes['ConversationId'].firstChange) {
      this.replyToMessage = null;
      this.pendingAgentPrompt = null;
      this.isRoutingCheck = false;
      this.isAgentWorking = false;
      this.expandedThreadIds.clear();
      this.syncParentMessageIdToComposer(null);
    }
  }

  public ngAfterViewChecked(): void {
    this.bindChatAreaListeners();
    this.syncLiveProgressFromChatArea();
  }

  public ngOnDestroy(): void {
    this.clearSubscriptions();
    if (this.noAgentPromptTimer !== undefined) {
      clearTimeout(this.noAgentPromptTimer);
    }
  }

  /** The conversation can be read and not posted in: MJ's chat area takes `ReadOnly` and shows `ReadOnlyNote` where the composer was, and the header's lock says why. */
  @Input() public IsReadOnly = false;
  /** The caller's seat is not known yet: neither a composer nor a note nor a lock, only a quiet wait, so nobody is told they can't post before the page knows. */
  @Input() public IsPending = false;
  @Input() public ReadOnlyNote = 'This space is closed. Conversations are read-only.';

  /** Linked actionable item (Task or Document) when this conversation is a focused Workstream. */
  @Input() public LinkedWorkstreamItem: WorkstreamLinkedItem | null = null;
  /** Friendly fallback name for the space's default AI agent. */
  @Input() public DefaultAgentName = 'Sage';
  /** Optional explicit thread messages list (used by tests or before chatArea populates). */
  @Input() public ThreadMessages: readonly ChatThreadMessageLike[] = [];

  @Output() public LinkedItemOpenRequested = new EventEmitter<WorkstreamLinkedItem>();
  @Output() public AgentStepInRequested = new EventEmitter<{ messageId: string; messageText: string; agentName: string }>();

  /** PR #6176: Active message being replied to in a thread (`ParentID`). */
  public replyToMessage: ChatThreadMessageLike | null = null;
  /** PR #6176: Expanded inline thread drawers keyed by parent message ID. */
  public expandedThreadIds = new Set<string>();
  /** PR #6176: True while `RunRoutingDecision` / intent check is evaluating whether an agent should respond. */
  public isRoutingCheck = false;
  /** PR #6176: True while an AI agent turn is actively running. */
  public isAgentWorking = false;
  public activeAgentName = '';
  public activeAgentRoute = '';
  public activeAgentStatusText = '';
  public activeAgentElapsed = '';
  public activeAgentProgressPercent: number | null = null;
  /** PR #6176: Prompt shown when a user message resolves to `NoAgent` so the user can ask an agent to step in if desired. */
  public pendingAgentPrompt: PendingAgentPromptState | null = null;
  /** Interactive conversation participants popover state in the chat header. */
  public showParticipantsPopover = false;

  public get hasRealChatArea(): boolean {
    const area = this.chatArea as { slotTemplate?: unknown } | undefined;
    return typeof area?.slotTemplate === 'function';
  }

  /** What the empty conversation area says, for someone who may start a conversation and for someone who may only read. */
  public get emptyMessage(): string {
    if (this.HasConversations) return this.CanStartConversation ? 'Choose a conversation from the space sidebar or start a new one.' : 'Choose a conversation from the space sidebar to read it.';
    return this.CanStartConversation ? 'Start a new conversation to begin collaborating.' : 'There are no conversations in this space.';
  }

  private static nextReasonId = 0;
  /** This instance's id for the reason, which the lock's `aria-controls` names: several chats can be on one page. */
  public readonly ReasonId = `mjc-read-only-reason-${++CollabSpaceChatComponent.nextReasonId}`;

  public ReasonShown = false;
  private reasonOpenedByFocus = false;

  public onLockFocus(): void {
    this.ReasonShown = true;
    this.reasonOpenedByFocus = true;
  }

  public onLockBlur(): void {
    this.ReasonShown = false;
    this.reasonOpenedByFocus = false;
  }

  public onLockClick(event: Pick<MouseEvent, 'detail'>): void {
    const pointerAfterFocus = this.reasonOpenedByFocus && event.detail > 0;
    this.reasonOpenedByFocus = false;
    this.ReasonShown = pointerAfterFocus ? true : !this.ReasonShown;
  }

  public onLockEscape(): void {
    this.ReasonShown = false;
    this.reasonOpenedByFocus = false;
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: Pick<MouseEvent, 'target'>): void {
    const target = event.target;
    if (this.ReasonShown) {
      const lockWrap = target instanceof Element ? target.closest('.read-only-lock-wrap') : null;
      if (!lockWrap || !this.host?.nativeElement.contains(lockWrap)) {
        this.ReasonShown = false;
        this.reasonOpenedByFocus = false;
      }
    }
    if (this.showParticipantsPopover) {
      const pillWrap = target instanceof Element ? target.closest('.participant-pill-wrap') : null;
      if (!pillWrap || !this.host?.nativeElement.contains(pillWrap)) {
        this.showParticipantsPopover = false;
        this.cdr?.markForCheck();
      }
    }
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
  @Input() public OutsideParticipantCount = 0;

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
  @Input() public EnableDecisionRouting = true;
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

  public onOpenLinkedItem(): void {
    if (this.LinkedWorkstreamItem) {
      this.LinkedItemOpenRequested.emit(this.LinkedWorkstreamItem);
    }
  }

  public onComposerDraftConsumed(): void {
    this.ComposerDraft = null;
    this.ComposerDraftConsumed.emit();
  }

  public onPendingMessageConsumed(): void {
    this.PendingMessage = null;
    this.PendingMessageConsumed.emit();
  }

  // ── Interactive Conversation Participants Popover ─────────────────────────

  public toggleParticipantsPopover(event?: MouseEvent): void {
    event?.stopPropagation();
    this.showParticipantsPopover = !this.showParticipantsPopover;
    this.cdr?.markForCheck();
  }

  public get conversationParticipantsList(): Array<{
    id: string;
    name: string;
    initials: string;
    imageUrl: string | null;
    iconClass: string;
    role: string;
    subtitle: string;
    isAi: boolean;
  }> {
    const seen = new Set<string>();
    const list: Array<{
      id: string;
      name: string;
      initials: string;
      imageUrl: string | null;
      iconClass: string;
      role: string;
      subtitle: string;
      isAi: boolean;
    }> = [];

    if (this.CurrentUser?.ID) {
      const id = this.CurrentUser.ID.toLowerCase();
      seen.add(id);
      const name = this.CurrentUser.Name || 'You';
      const avatar = this.getUserAvatarEntry(this.CurrentUser.ID);
      list.push({
        id: this.CurrentUser.ID,
        name,
        initials: this.computeInitials(name),
        imageUrl: avatar?.imageUrl ?? null,
        iconClass: avatar?.iconClass || 'fa-solid fa-user',
        role: 'You',
        subtitle: this.CurrentUser.Email || '',
        isAi: false,
      });
    }

    for (const person of this.MentionPeople ?? []) {
      const id = (person.ID ?? '').toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = person.Name || 'Participant';
      const avatar = this.getUserAvatarEntry(person.ID);
      list.push({
        id: person.ID,
        name,
        initials: this.computeInitials(name),
        imageUrl: avatar?.imageUrl ?? null,
        iconClass: avatar?.iconClass || 'fa-solid fa-user',
        role: 'Participant',
        subtitle: person.Email || '',
        isAi: false,
      });
    }

    const agentName = this.DefaultAgentName || 'Sage';
    list.push({
      id: this.DefaultAgentId || 'agent-default',
      name: agentName,
      initials: 'AI',
      imageUrl: null,
      iconClass: 'fa-solid fa-robot',
      role: 'AI Agent',
      subtitle: `Responds when @mentioned or in thread replies`,
      isAi: true,
    });

    return list;
  }

  public mentionParticipant(name: string): void {
    if (this.IsReadOnly || !name) return;
    const prefix = `@${name.trim()} `;
    const existing = (this.ComposerDraft ?? '').trim();
    this.ComposerDraft = existing ? `${existing} ${prefix}` : prefix;
    this.showParticipantsPopover = false;
    this.cdr?.markForCheck();
  }

  // ── PR #6176: Threads & Replies (`ParentID` & `ThreadReply`) ──────────────

  public get allMessages(): readonly ChatThreadMessageLike[] {
    const area = this.chatArea as { DisplayMessages?: ChatThreadMessageLike[]; messages?: ChatThreadMessageLike[] } | undefined;
    const live = area?.messages ?? area?.DisplayMessages;
    if (Array.isArray(live) && live.length > 0) {
      return live;
    }
    return this.ThreadMessages;
  }

  public getParentMessage(message: ChatThreadMessageLike | null | undefined): ChatThreadMessageLike | null {
    const parentId = message?.ParentID;
    if (!parentId) return null;
    const norm = parentId.trim().toLowerCase();
    const parent = this.allMessages.find((m) => (m.ID ?? '').trim().toLowerCase() === norm) ?? null;
    if (!parent) return null;
    // An agent's answer to a top-level message stays in the main flow and is not a thread reply
    const parentParentId = parent.ParentID?.trim().toLowerCase();
    if (this.isAiMessage(message) && (!parentParentId || parentParentId === 'null')) {
      return null;
    }
    return parent;
  }

  /**
   * Collects all transitive replies in the Slack-style thread rooted at `parentId`
   * (person replies to `parentId`, plus person or agent replies to those thread replies),
   * preserving chronological order. An agent's direct answer to a top-level message stays in
   * the main flow and is not part of the thread.
   */
  public getRepliesFor(parentId: string | null | undefined): ChatThreadMessageLike[] {
    if (!parentId) return [];
    const rootNorm = parentId.trim().toLowerCase();
    if (!rootNorm) return [];
    const all = this.allMessages;
    const inThread = new Set<string>([rootNorm]);
    let added = true;
    while (added) {
      added = false;
      for (const m of all) {
        const id = (m.ID ?? '').trim().toLowerCase();
        const pid = (m.ParentID ?? '').trim().toLowerCase();
        if (!id || !pid || pid === 'null' || !inThread.has(pid) || inThread.has(id)) {
          continue;
        }
        if (pid === rootNorm && this.isAiMessage(m)) {
          continue;
        }
        inThread.add(id);
        added = true;
      }
    }
    inThread.delete(rootNorm);
    if (inThread.size === 0) return [];
    return all.filter((m) => inThread.has((m.ID ?? '').trim().toLowerCase()));
  }

  public getThreadParticipants(parentId: string | null | undefined): Array<{
    key: string;
    name: string;
    initials: string;
    imageUrl: string | null;
    iconClass: string;
    isAi: boolean;
  }> {
    const replies = this.getRepliesFor(parentId);
    const seen = new Set<string>();
    const participants: Array<{
      key: string;
      name: string;
      initials: string;
      imageUrl: string | null;
      iconClass: string;
      isAi: boolean;
    }> = [];
    for (const r of replies) {
      const isAi = this.isAiMessage(r);
      const name = this.getSpeakerName(r);
      const key = `${isAi ? 'ai' : 'user'}:${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      participants.push({
        key,
        name,
        initials: this.getSpeakerInitials(r),
        imageUrl: this.getSpeakerAvatarUrl(r),
        iconClass: this.getSpeakerAvatarIconClass(r),
        isAi,
      });
      if (participants.length >= 4) break;
    }
    return participants;
  }

  public getLastReplySpeaker(parentId: string | null | undefined): string {
    const replies = this.getRepliesFor(parentId);
    if (replies.length === 0) return '';
    return this.getSpeakerName(replies[replies.length - 1]);
  }

  public hasInProgressReply(parentId: string | null | undefined): boolean {
    const replies = this.getRepliesFor(parentId);
    return replies.some((r) => (r.Status ?? '').trim().toLowerCase() === 'in-progress');
  }

  public getLatestThreadTarget(rootMessage: ChatThreadMessageLike): ChatThreadMessageLike {
    const replies = this.getRepliesFor(rootMessage.ID);
    return replies.length > 0 ? replies[replies.length - 1] : rootMessage;
  }

  public getNestedReplyTargetName(reply: ChatThreadMessageLike, rootMessageId: string): string | null {
    const pid = (reply.ParentID ?? '').trim().toLowerCase();
    const rootNorm = (rootMessageId ?? '').trim().toLowerCase();
    if (!pid || !rootNorm || pid === rootNorm) return null;
    const parent = this.getParentMessage(reply);
    return parent ? this.getSpeakerName(parent) : null;
  }

  public isThreadExpanded(messageId: string): boolean {
    return this.expandedThreadIds.has(messageId);
  }

  public toggleThreadExpanded(messageId: string): void {
    if (this.expandedThreadIds.has(messageId)) {
      this.expandedThreadIds.delete(messageId);
    } else {
      this.expandedThreadIds.add(messageId);
    }
    this.cdr?.markForCheck();
  }

  public isAiMessage(message: ChatThreadMessageLike | null | undefined): boolean {
    if (!message) return false;
    const role = (message.Role ?? '').trim().toLowerCase();
    return role === 'ai' || role === 'assistant' || !!message.AgentID;
  }

  public getSpeakerName(message: ChatThreadMessageLike | null | undefined): string {
    if (!message) return 'Participant';
    if (this.isAiMessage(message)) {
      return message.Agent?.trim() || this.DefaultAgentName || 'AI Agent';
    }
    if (message.User?.trim()) {
      return message.User.trim();
    }
    if (message.UserID && this.CurrentUser?.ID && message.UserID.toLowerCase() === this.CurrentUser.ID.toLowerCase()) {
      return this.CurrentUser.Name || 'You';
    }
    const person = this.MentionPeople?.find((p) => p.ID.toLowerCase() === (message.UserID ?? '').toLowerCase());
    return person?.Name || 'Team Member';
  }

  public getSpeakerInitials(message: ChatThreadMessageLike | null | undefined): string {
    if (this.isAiMessage(message)) return 'AI';
    return this.computeInitials(this.getSpeakerName(message));
  }

  /**
   * Resolves the user's avatar entry from `ConversationChatAreaComponent.userAvatarMap`
   * (or `UserAvatarMap`) so thread avatars match `<mj-conversation-message-item>`.
   */
  public getUserAvatarEntry(userId: string | null | undefined): { imageUrl: string | null; iconClass: string | null } | null {
    if (!userId) return null;
    const area = this.chatArea as {
      userAvatarMap?: Map<string, { imageUrl: string | null; iconClass: string | null }>;
      UserAvatarMap?: Map<string, { imageUrl: string | null; iconClass: string | null }>;
    } | undefined;
    const map = area?.userAvatarMap ?? area?.UserAvatarMap;
    if (!map) return null;
    const direct = map.get(userId);
    if (direct) return direct;
    const target = userId.trim().toLowerCase();
    for (const [key, val] of map.entries()) {
      if (key.trim().toLowerCase() === target) {
        return val;
      }
    }
    return null;
  }

  public getSpeakerAvatarUrl(message: ChatThreadMessageLike | null | undefined): string | null {
    if (!message || this.isAiMessage(message)) return null;
    return this.getUserAvatarEntry(message.UserID)?.imageUrl ?? null;
  }

  public getSpeakerAvatarIconClass(message: ChatThreadMessageLike | null | undefined): string {
    if (this.isAiMessage(message)) {
      return 'fa-solid fa-robot';
    }
    return this.getUserAvatarEntry(message?.UserID)?.iconClass || 'fa-solid fa-user';
  }

  private computeInitials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  public getFormattedMessageBody(message: ChatThreadMessageLike | null | undefined): string {
    const cleaned = (message?.Message ?? '')
      .replace(/@\{[^}]+\}/g, (match) => {
        try {
          const parsed = JSON.parse(match.slice(1)) as { name?: string };
          return parsed.name ? `@${parsed.name}` : '@mention';
        } catch {
          return '@mention';
        }
      })
      .trim();
    if (!cleaned && (message?.Status ?? '').trim().toLowerCase() === 'in-progress') {
      return 'Generating response…';
    }
    return cleaned;
  }

  public getMessageExcerpt(message: ChatThreadMessageLike | null | undefined, maxLen = 80): string {
    const raw = this.getFormattedMessageBody(message).replace(/\s+/g, ' ').trim();
    if (raw.length <= maxLen) return raw;
    return raw.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
  }

  public startReplyTo(message: ChatThreadMessageLike): void {
    if (this.IsReadOnly) return;
    this.replyToMessage = message;
    this.pendingAgentPrompt = null;
    this.syncParentMessageIdToComposer(message.ID);
    this.cdr?.markForCheck();
  }

  public clearReplyTo(): void {
    this.replyToMessage = null;
    this.syncParentMessageIdToComposer(null);
    this.cdr?.markForCheck();
  }

  public scrollToMessage(messageId: string): void {
    const area = this.chatArea as { OnJumpToMessage?: (id: string) => void } | undefined;
    if (typeof area?.OnJumpToMessage === 'function') {
      area.OnJumpToMessage(messageId);
      return;
    }
    const el = this.host?.nativeElement.querySelector(`[data-message-id="${messageId}"]`);
    if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── PR #6176: Progress Bar & "Ask if an Agent Should Go" Prompt ───────────

  public formatRouteBadge(route: string): string {
    switch (route) {
      case 'ThreadReply': return '↪ Thread Reply';
      case 'Mention': return '@Mention';
      case 'DecisionRouted': return '⚡ Auto-Routed';
      case 'Continuity': return 'Continuity';
      case 'Pinned': return 'Pinned Agent';
      case 'Default': return 'Default Agent';
      default: return route;
    }
  }

  /**
   * Called when a user sends a message so we can track whether PR #6176 routed it to an agent
   * or settled it as human-only (`NoAgent`), and clear any active thread `ParentMessageId`.
   */
  public onUserMessageSent(message: ChatThreadMessageLike, hadReplyParent: ChatThreadMessageLike | null = this.replyToMessage): void {
    this.replyToMessage = null;
    this.syncParentMessageIdToComposer(null);
    this.pendingAgentPrompt = null;

    const text = message.Message ?? '';
    const hasExplicitAgentMention = text.includes('"type":"agent"') || /@\b(sage|agent|assistant)\b/i.test(text);
    if (hasExplicitAgentMention) {
      this.cdr?.markForCheck();
      return;
    }

    // Determine PR #6176's reason if no agent turn starts
    let reasonLabel = 'Human-to-human message — no AI agent was triggered';
    if (hadReplyParent && !this.isAiMessage(hadReplyParent)) {
      reasonLabel = `Replied to ${this.getSpeakerName(hadReplyParent)} — AI stays silent on human thread replies`;
    } else if (text.includes('"type":"user"')) {
      reasonLabel = 'Addressed to a team member — AI stays silent unless @mentioned';
    }

    if (this.noAgentPromptTimer !== undefined) {
      clearTimeout(this.noAgentPromptTimer);
    }
    this.noAgentPromptTimer = setTimeout(() => {
      this.noAgentPromptTimer = undefined;
      if (!this.isAgentWorking && !this.isRoutingCheck) {
        this.pendingAgentPrompt = {
          messageId: message.ID,
          messageText: text,
          reasonLabel,
          suggestedAgentName: this.DefaultAgentName || 'Sage',
          suggestedAgentId: this.DefaultAgentId,
        };
        this.cdr?.markForCheck();
      }
    }, 120);
  }

  public onAgentTurnStarted(info: { agentName?: string | null; route?: string | null; statusText?: string | null }): void {
    if (this.noAgentPromptTimer !== undefined) {
      clearTimeout(this.noAgentPromptTimer);
      this.noAgentPromptTimer = undefined;
    }
    this.pendingAgentPrompt = null;
    this.isRoutingCheck = false;
    this.isAgentWorking = true;
    this.activeAgentName = info.agentName?.trim() || this.DefaultAgentName || 'Sage';
    this.activeAgentRoute = info.route?.trim() || 'Mention';
    this.activeAgentStatusText = info.statusText?.trim() || 'Generating response…';
    this.cdr?.markForCheck();
  }

  public onAgentTurnCompleted(): void {
    this.isRoutingCheck = false;
    this.isAgentWorking = false;
    this.activeAgentStatusText = '';
    this.activeAgentProgressPercent = null;
    this.cdr?.markForCheck();
  }

  public confirmAgentShouldGo(): void {
    const prompt = this.pendingAgentPrompt;
    if (!prompt) return;
    this.pendingAgentPrompt = null;
    this.onAgentTurnStarted({
      agentName: prompt.suggestedAgentName,
      route: 'ThreadReply',
      statusText: `Stepping in on thread…`,
    });
    this.AgentStepInRequested.emit({
      messageId: prompt.messageId,
      messageText: prompt.messageText,
      agentName: prompt.suggestedAgentName,
    });

    // Also trigger via chatArea if available
    const area = this.chatArea as { OnResendInPlaceRequested?: (msg: unknown) => void; messages?: ChatThreadMessageLike[] } | undefined;
    const msgEntity = area?.messages?.find((m) => m.ID === prompt.messageId);
    if (msgEntity && typeof area?.OnResendInPlaceRequested === 'function') {
      area.OnResendInPlaceRequested(msgEntity);
    } else {
      this.ComposerDraft = `@${prompt.suggestedAgentName} Please weigh in on: "${this.getMessageExcerpt({ ID: prompt.messageId, Message: prompt.messageText }, 80)}"`;
      this.syncParentMessageIdToComposer(prompt.messageId);
    }
    this.cdr?.markForCheck();
  }

  public dismissAgentPrompt(): void {
    this.pendingAgentPrompt = null;
    this.cdr?.markForCheck();
  }

  private getActiveMessageInput(): Record<string, unknown> | null {
    const area = this.chatArea as {
      messageInputComponents?: { toArray?: () => Array<Record<string, unknown>> };
    } | undefined;
    const list = area?.messageInputComponents?.toArray?.() ?? [];
    if (list.length === 0) return null;
    const matching = list.find((inp) => inp['ConversationId'] === this.ConversationId || inp['conversationId'] === this.ConversationId);
    return matching ?? list[0] ?? null;
  }

  private syncParentMessageIdToComposer(parentId: string | null): void {
    const input = this.getActiveMessageInput();
    if (input) {
      input['ParentMessageId'] = parentId;
    }
  }

  private bindChatAreaListeners(): void {
    if (this.chatArea && this.chatArea !== this.boundChatArea) {
      this.clearSubscriptions();
      this.boundChatArea = this.chatArea;
      const area = this.chatArea as {
        BeforeAgentTurn?: { subscribe?: (fn: (args: { Turn?: { AgentName?: string | null; Route?: string } }) => void) => { unsubscribe: () => void } };
        AfterAgentTurn?: { subscribe?: (fn: () => void) => { unsubscribe: () => void } };
      };
      if (typeof area.BeforeAgentTurn?.subscribe === 'function') {
        const sub = area.BeforeAgentTurn.subscribe((args) => {
          this.onAgentTurnStarted({
            agentName: args?.Turn?.AgentName ?? this.DefaultAgentName,
            route: args?.Turn?.Route ?? 'Mention',
          });
        });
        this.cleanups.push(() => sub.unsubscribe());
      }
      if (typeof area.AfterAgentTurn?.subscribe === 'function') {
        const sub = area.AfterAgentTurn.subscribe(() => {
          this.onAgentTurnCompleted();
        });
        this.cleanups.push(() => sub.unsubscribe());
      }
    }

    const activeInput = this.getActiveMessageInput();
    if (activeInput && activeInput !== this.boundInputInstance) {
      this.boundInputInstance = activeInput;
      if (this.replyToMessage) {
        activeInput['ParentMessageId'] = this.replyToMessage.ID;
      }
      const messageSent = activeInput['MessageSent'] as { subscribe?: (fn: (msg: ChatThreadMessageLike) => void) => { unsubscribe: () => void } } | undefined;
      if (typeof messageSent?.subscribe === 'function') {
        const sub = messageSent.subscribe((msg) => {
          this.onUserMessageSent(msg, this.replyToMessage);
        });
        this.cleanups.push(() => sub.unsubscribe());
      }
      const intentStart = activeInput['IntentCheckStarted'] as { subscribe?: (fn: () => void) => { unsubscribe: () => void } } | undefined;
      if (typeof intentStart?.subscribe === 'function') {
        const sub = intentStart.subscribe(() => {
          this.isRoutingCheck = true;
          this.cdr?.markForCheck();
        });
        this.cleanups.push(() => sub.unsubscribe());
      }
      const intentEnd = activeInput['IntentCheckCompleted'] as { subscribe?: (fn: () => void) => { unsubscribe: () => void } } | undefined;
      if (typeof intentEnd?.subscribe === 'function') {
        const sub = intentEnd.subscribe(() => {
          this.isRoutingCheck = false;
          this.cdr?.markForCheck();
        });
        this.cleanups.push(() => sub.unsubscribe());
      }
    }
  }

  private syncLiveProgressFromChatArea(): void {
    const area = this.chatArea as {
      isProcessing?: boolean;
      StatusText?: string | null;
      StatusElapsed?: string | null;
    } | undefined;
    if (!area) return;
    if (area.isProcessing && !this.isAgentWorking) {
      this.isAgentWorking = true;
      if (!this.activeAgentName) {
        this.activeAgentName = this.DefaultAgentName || 'Sage';
      }
    } else if (area.isProcessing === false && this.isAgentWorking && !this.activeAgentRoute) {
      this.isAgentWorking = false;
    }
    if (area.StatusText && area.StatusText !== this.activeAgentStatusText) {
      this.activeAgentStatusText = area.StatusText;
    }
    if (area.StatusElapsed !== undefined && (area.StatusElapsed ?? '') !== this.activeAgentElapsed) {
      this.activeAgentElapsed = area.StatusElapsed ?? '';
    }
  }

  private clearSubscriptions(): void {
    for (const fn of this.cleanups) {
      fn();
    }
    this.cleanups = [];
    this.boundChatArea = null;
    this.boundInputInstance = null;
  }
}
