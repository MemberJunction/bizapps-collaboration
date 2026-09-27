import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { UserInfo } from '@memberjunction/core';
import type { SpaceBand } from './types';
import { CollabAvatarComponent } from './avatar.component';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

export interface RoomMessageItem {
  id: string;
  senderName: string;
  senderInitials: string;
  senderColorClass?: string;
  isAssistant?: boolean;
  isOutside?: boolean;
  timestamp: string;
  text: string;
}

@Component({
  selector: 'mjc-space-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CollabAvatarComponent, CollabBandChipComponent],
  template: `
    <div class="chat-container">
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="room-info">
          <div class="room-title-row">
            <i class="fa-solid fa-hashtag hash-ic"></i>
            <span class="room-title">{{ ConversationName || SpaceName + ' Room' }}</span>
            <mjc-band-chip [Band]="AudienceBand" />
          </div>
          <div class="room-sub">
            @if (AudienceBand === 'Shared') {
              Shared channel with team members and outside participants.
            } @else {
              Private internal team discussion channel.
            }
          </div>
        </div>

        @if (ParticipantCount > 0) {
          <div class="participant-count" title="Participants in this space">
            <i class="fa-solid fa-users"></i>
            <span>{{ ParticipantCount }} participants</span>
          </div>
        }
      </div>

      <!-- Messages Thread Area -->
      <div class="messages-area" #messagesContainer>
        @if (Messages.length === 0) {
          <div class="no-messages">
            <div class="welcome-bubble">
              <i class="fa-solid fa-comments welcome-ic"></i>
              <div class="welcome-title">Welcome to #{{ SpaceName }}</div>
              <div class="welcome-sub">
                This is the start of the {{ SpaceName }} room discussion. Send a message to get started!
              </div>
            </div>
          </div>
        } @else {
          <div class="messages-list">
            @for (msg of Messages; track msg.id) {
              <div class="message-bubble" [class.is-assistant]="msg.isAssistant">
                <div class="msg-avatar-col">
                  @if (msg.isAssistant) {
                    <div class="assistant-avatar">
                      <i class="fa-solid fa-sparkles"></i>
                    </div>
                  } @else {
                    <mjc-avatar
                      [Initials]="msg.senderInitials"
                      [ColorClass]="msg.senderColorClass || 'c1'"
                      [IsOutside]="!!msg.isOutside"
                      Size="md"
                    />
                  }
                </div>

                <div class="msg-content-col">
                  <div class="msg-meta">
                    <span class="msg-author">{{ msg.senderName }}</span>
                    @if (msg.isAssistant) {
                      <span class="role-badge assistant">Assistant</span>
                    } @else if (msg.isOutside) {
                      <span class="role-badge outside">Outside</span>
                    } @else {
                      <span class="role-badge team">Team</span>
                    }
                    <span class="msg-time">{{ msg.timestamp }}</span>
                  </div>

                  <div class="msg-body">{{ msg.text }}</div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Message Composer Footer -->
      <div class="composer-container">
        <div class="composer-box">
          <textarea
            class="composer-textarea"
            rows="2"
            [(ngModel)]="newMessageText"
            (keydown)="onComposerKeyDown($event)"
            [placeholder]="'Message #' + (ConversationName || SpaceName + ' Room') + '... (@assistant to ask AI)'"
          ></textarea>

          <div class="composer-actions">
            <div class="composer-left-actions">
              <button
                type="button"
                class="assistant-toggle-btn"
                [class.active]="askAssistant"
                (click)="askAssistant = !askAssistant"
                title="Direct your message to the AI Assistant">
                <i class="fa-solid fa-sparkles"></i>
                <span>Ask AI</span>
              </button>
              <span class="composer-hint">Enter to send, Shift+Enter for newline</span>
            </div>

            <button
              type="button"
              class="send-btn"
              [disabled]="!newMessageText.trim()"
              (click)="sendMessage()">
              <i class="fa-solid fa-paper-plane"></i>
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
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
      }

      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 24px;
        border-bottom: 1px solid var(--mj-border-subtle, #e2e8f0);
        background: var(--mj-bg-surface, #ffffff);
        gap: 16px;
        flex-shrink: 0;
      }

      .room-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .room-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .hash-ic {
        font-size: 15px;
        color: var(--mj-brand-primary, #0076b6);
      }

      .room-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
        letter-spacing: -0.01em;
      }

      .room-sub {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

      .participant-count {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--mj-text-secondary, #64748b);
        background: var(--mj-bg-surface-sunken, #f1f5f9);
        border: 1px solid var(--mj-border-default, #e2e8f0);
        padding: 4px 10px;
        border-radius: 999px;
        flex-shrink: 0;
      }

      .messages-area {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 24px 28px;
        display: flex;
        flex-direction: column;
        background: var(--mj-bg-surface, #ffffff);
      }

      .messages-list {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .message-bubble {
        display: flex;
        gap: 14px;
        align-items: flex-start;
      }

      .message-bubble.is-assistant {
        background: var(--mjc-shared-bg, rgba(0, 118, 182, 0.04));
        padding: 12px 14px;
        border-radius: 8px;
        border: 1px solid var(--mjc-shared-border, rgba(0, 118, 182, 0.15));
      }

      .msg-avatar-col {
        flex-shrink: 0;
      }

      .assistant-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--mjc-ai-from, #0076b6), var(--mjc-ai-to, #6366f1));
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-size: 14px;
      }

      .msg-content-col {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .msg-meta {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .msg-author {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }

      .role-badge {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.02em;
      }

      .role-badge.assistant {
        background: linear-gradient(135deg, #e0f2fe, #ede9fe);
        color: #4f46e5;
      }

      .role-badge.outside {
        background: #fef3c7;
        color: #b45309;
      }

      .role-badge.team {
        background: #f1f5f9;
        color: #475569;
      }

      .msg-time {
        font-size: 11px;
        color: var(--mj-text-muted, #94a3b8);
      }

      .msg-body {
        font-size: 13.5px;
        line-height: 1.5;
        color: var(--mj-text-primary, #1e293b);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .no-messages {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .welcome-bubble {
        text-align: center;
        max-width: 400px;
        padding: 32px 24px;
        border-radius: 12px;
        background: var(--mj-bg-surface-sunken, #f8fafc);
        border: 1px dashed var(--mj-border-strong, #cbd5e1);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      .welcome-ic {
        font-size: 32px;
        color: var(--mj-brand-primary, #0076b6);
        margin-bottom: 4px;
      }

      .welcome-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
      }

      .welcome-sub {
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
        line-height: 1.4;
      }

      .composer-container {
        padding: 16px 24px 20px;
        border-top: 1px solid var(--mj-border-subtle, #e2e8f0);
        background: var(--mj-bg-surface, #ffffff);
        flex-shrink: 0;
      }

      .composer-box {
        border: 1px solid var(--mj-border-strong, #cbd5e1);
        border-radius: 8px;
        background: var(--mj-bg-surface, #ffffff);
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .composer-box:focus-within {
        border-color: var(--mj-brand-primary, #0076b6);
        box-shadow: 0 0 0 2px rgba(0, 118, 182, 0.1);
      }

      .composer-textarea {
        border: none;
        outline: none;
        resize: none;
        font-size: 13.5px;
        font-family: inherit;
        color: var(--mj-text-primary, #0f172a);
        background: transparent;
        line-height: 1.45;
        width: 100%;
        box-sizing: border-box;
      }

      .composer-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .composer-left-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .assistant-toggle-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--mj-bg-surface-sunken, #f1f5f9);
        border: 1px solid var(--mj-border-default, #e2e8f0);
        color: var(--mj-text-secondary, #475569);
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .assistant-toggle-btn:hover {
        background: var(--mj-bg-surface-card, #e2e8f0);
        color: var(--mj-text-primary, #0f172a);
      }

      .assistant-toggle-btn.active {
        background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 12%, transparent);
        border-color: var(--mj-brand-primary, #0076b6);
        color: var(--mj-brand-primary, #0076b6);
        font-weight: 600;
      }

      .assistant-toggle-btn.active i {
        color: var(--mj-brand-primary, #0076b6);
      }

      .composer-hint {
        font-size: 11px;
        color: var(--mj-text-muted, #94a3b8);
      }

      .send-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--mj-brand-primary, #0076b6);
        color: #ffffff;
        border: none;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .send-btn:hover:not(:disabled) {
        background: var(--mj-brand-primary-hover, #005a8c);
      }

      .send-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `,
  ],
})
export class CollabSpaceChatComponent implements AfterViewChecked {
  @Input() Messages: RoomMessageItem[] = [];
  @Input() SpaceName = '';
  @Input() SpaceId = '';
  @Input() SpaceEntityId = '';
  @Input() AudienceBand: SpaceBand = 'Shared';
  @Input() ParticipantCount = 0;
  @Input() CurrentUser: UserInfo | null = null;
  @Input() ConversationId: string | null = null;
  @Input() ConversationName: string = '';
  @Input() EnvironmentId = '';
  @Input() ApplicationId: string | null = null;
  @Input() DefaultAgentId: string | null = null;
  @Input() AllowMentions = true;
  @Input() AllowAttachments = true;

  @Output() SendMessageRequested = new EventEmitter<string | { text: string; executeAgent?: boolean }>();
  @Output() ConversationCreated = new EventEmitter<{ conversationId: string; name?: string }>();
  @Output() NewConversationRequested = new EventEmitter<void>();

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  public newMessageText = '';
  public askAssistant = false;
  private shouldScroll = false;

  public ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  public onComposerKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  public sendMessage(): void {
    const text = this.newMessageText.trim();
    if (!text) return;
    // Item 8: The agent answers only when tagged or asked; never on arbitrary question marks
    const shouldExecute = this.askAssistant || /(@assistant|@agent|^\/ask)/i.test(text);
    this.SendMessageRequested.emit(shouldExecute ? { text, executeAgent: true } : { text, executeAgent: false });
    this.newMessageText = '';
    this.askAssistant = false;
    this.shouldScroll = true;
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {
      // scroll safely
    }
  }
}
