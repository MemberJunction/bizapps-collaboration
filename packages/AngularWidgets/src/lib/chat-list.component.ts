import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabAvatarStackComponent } from './avatar-stack.component';
import type { ChatSummaryModel } from './types';

/**
 * Chat conversation list sidebar widget (L1).
 * Frames 05 and 11.
 */
@Component({
  selector: 'mjc-chat-list',
  standalone: true,
  imports: [CommonModule, CollabAvatarStackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
      border-right: 1px solid var(--mj-border-subtle, #e2e8f0);
      background: var(--mj-bg-surface, #ffffff);
      overflow: hidden;
    }

    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--mj-border-subtle, #e2e8f0);
    }

    .title {
      font-size: 14px;
      font-weight: 700;
      color: var(--mj-text-primary, #0f172a);
      margin: 0;
    }

    .new-chat-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--mj-radius-md, 6px);
      border: 1px solid var(--mj-border-subtle, #e2e8f0);
      background: transparent;
      color: var(--mj-text-secondary, #64748b);
      cursor: pointer;
      transition: background-color 0.12s ease, border-color 0.12s ease;
    }

    .new-chat-btn:hover {
      background: var(--mj-bg-surface-hover, rgba(0, 0, 0, 0.05));
      color: var(--mj-text-primary, #0f172a);
    }

    .items-container {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .chat-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border-radius: var(--mj-radius-md, 8px);
      cursor: pointer;
      border: 1px solid transparent;
      background: transparent;
      transition: background-color 0.12s ease, border-color 0.12s ease;
    }

    .chat-item:hover {
      background: var(--mj-bg-surface-hover, rgba(0, 0, 0, 0.03));
    }

    .chat-item.active {
      background: var(--mj-brand-tertiary-subtle, rgba(14, 165, 233, 0.08));
      border-color: color-mix(in srgb, var(--mj-brand-tertiary, #0ea5e9) 40%, transparent);
    }

    .row-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .title-group {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .privacy-icon {
      font-size: 12px;
      flex-shrink: 0;
    }

    .privacy-icon.shared {
      color: var(--mj-brand-tertiary, #0ea5e9);
    }

    .privacy-icon.internal {
      color: var(--mj-text-secondary, #64748b);
    }

    .privacy-icon.assistant {
      color: var(--mj-brand-accent, #8b5cf6);
    }

    .chat-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--mj-text-primary, #0f172a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .timestamp {
      font-size: 11px;
      color: var(--mj-text-muted, #94a3b8);
      flex-shrink: 0;
    }

    .row-middle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .audience-group {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .audience-text {
      font-size: 11px;
      color: var(--mj-text-secondary, #64748b);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .unread-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: var(--mj-radius-full, 9999px);
      background: var(--mj-brand-primary, #2563eb);
      color: var(--mj-text-inverse, #ffffff);
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .row-snippet {
      font-size: 12px;
      color: var(--mj-text-secondary, #64748b);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }

    .sender-prefix {
      font-weight: 600;
      color: var(--mj-text-primary, #0f172a);
    }

    .list-footer {
      padding: 12px 14px;
      border-top: 1px solid var(--mj-border-subtle, #e2e8f0);
      background: var(--mj-bg-surface-sunken, rgba(148, 163, 184, 0.05));
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 11px;
      color: var(--mj-text-secondary, #64748b);
      line-height: 1.4;
    }

    .footer-icon {
      font-size: 12px;
      color: var(--mj-text-muted, #94a3b8);
      margin-top: 1px;
      flex-shrink: 0;
    }
  `],
  template: `
    <header class="list-header">
      <h2 class="title">Chats</h2>
      <button
        type="button"
        class="new-chat-btn"
        (click)="onNewChat()"
        aria-label="New chat"
        title="Start a new chat"
      >
        <i class="fa-solid fa-pen-to-square"></i>
      </button>
    </header>

    <div class="items-container" role="list">
      @for (chat of Chats; track chat.id) {
        <div
          class="chat-item"
          [class.active]="chat.id === ActiveChatId"
          (click)="onSelectChat(chat.id)"
          role="button"
          tabindex="0"
          (keydown.enter)="onSelectChat(chat.id)"
          (keydown.space)="onSelectChat(chat.id)"
        >
          <div class="row-top">
            <div class="title-group">
              <i
                class="privacy-icon fa-solid"
                [class.fa-eye]="chat.privacy === 'Shared'"
                [class.shared]="chat.privacy === 'Shared'"
                [class.fa-lock]="chat.privacy === 'Internal'"
                [class.internal]="chat.privacy === 'Internal'"
                [class.fa-wand-magic-sparkles]="chat.privacy === 'Assistant'"
                [class.assistant]="chat.privacy === 'Assistant'"
                [class.fa-user]="chat.privacy === 'Direct'"
              ></i>
              <span class="chat-title">{{ chat.title }}</span>
            </div>
            <span class="timestamp">{{ chat.timestamp }}</span>
          </div>

          <div class="row-middle">
            <div class="audience-group">
              <mjc-avatar-stack [Avatars]="chat.avatars" [Max]="3" [Size]="'xs'" />
              <span class="audience-text">{{ chat.audienceLabel }}</span>
            </div>
            @if (chat.unreadCount && chat.unreadCount > 0) {
              <span class="unread-badge">{{ chat.unreadCount }}</span>
            }
          </div>

          <div class="row-snippet">
            @if (chat.lastSender) {
              <span class="sender-prefix">{{ chat.lastSender }}: </span>
            }
            <span>{{ chat.lastMessage }}</span>
          </div>
        </div>
      }
    </div>

    <footer class="list-footer">
      <i class="footer-icon fa-solid fa-circle-info"></i>
      <span>Who's in a chat decides what the Assistant can use there.</span>
    </footer>
  `,
})
export class CollabChatListComponent {
  @Input() Chats: ChatSummaryModel[] = [];
  @Input() ActiveChatId = '';

  @Output() ChatSelected = new EventEmitter<string>();
  @Output() NewChatRequested = new EventEmitter<void>();

  public onSelectChat(id: string): void {
    this.ChatSelected.emit(id);
  }

  public onNewChat(): void {
    this.NewChatRequested.emit();
  }
}
