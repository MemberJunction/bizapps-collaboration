import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CollabAvatarComponent } from './avatar.component';
import { CollabFileIconComponent } from './file-icon.component';
import { CollabChatListComponent } from './chat-list.component';
import { CollabChatBannerComponent } from './chat-banner.component';
import { CollabAnswerReceiptComponent } from './answer-receipt.component';
import { CollabChatLensComponent } from './chat-lens.component';
import type {
  ChatSummaryModel,
  ChatMessageModel,
  ChatMessageCitation,
  ChatLensAudienceGroup,
  ChatLensPinnedItem,
} from './types';

/**
 * Composite L2 component for Space Room and Chats (Frames 05 & 11).
 * Coordinates chat list, conversation feed, citations, Assistant provenance, composer, and audience lens.
 */
@Component({
  selector: 'mjc-space-chats',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CollabAvatarComponent,
    CollabFileIconComponent,
    CollabChatListComponent,
    CollabChatBannerComponent,
    CollabAnswerReceiptComponent,
    CollabChatLensComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: grid;
      grid-template-columns: 260px 1fr 280px;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      background: var(--mj-bg-page, #ffffff);
    }

    .chat-center {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
      background: var(--mj-bg-surface, #ffffff);
    }

    .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      border-bottom: 1px solid var(--mj-border-subtle, #e2e8f0);
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-icon {
      font-size: 14px;
    }

    .header-icon.shared { color: var(--mj-brand-tertiary, #0ea5e9); }
    .header-icon.internal { color: var(--mj-text-secondary, #64748b); }

    .header-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--mj-text-primary, #0f172a);
      margin: 0;
    }

    .audience-pill {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: var(--mj-radius-full, 9999px);
      background: var(--mj-bg-surface-sunken, rgba(148, 163, 184, 0.12));
      color: var(--mj-text-secondary, #64748b);
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: var(--mj-radius-md, 6px);
      border: 1px solid transparent;
      background: transparent;
      color: var(--mj-text-secondary, #64748b);
      cursor: pointer;
      transition: background-color 0.12s ease;
    }

    .icon-btn:hover {
      background: var(--mj-bg-surface-hover, rgba(0, 0, 0, 0.05));
      color: var(--mj-text-primary, #0f172a);
    }

    .stream-container {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .message-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      max-width: 100%;
    }

    .message-avatar-wrap {
      flex-shrink: 0;
      margin-top: 2px;
    }

    .assistant-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--mj-radius-full, 9999px);
      background: linear-gradient(135deg, var(--mj-brand-tertiary, #0ea5e9), var(--mj-brand-accent, #8b5cf6));
      color: #ffffff;
      font-size: 13px;
    }

    .message-body {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .message-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .author-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--mj-text-primary, #0f172a);
    }

    .org-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--mj-radius-sm, 4px);
      background: var(--mj-brand-tertiary-subtle, rgba(14, 165, 233, 0.1));
      color: var(--mj-brand-tertiary, #0ea5e9);
    }

    .ai-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: var(--mj-radius-sm, 4px);
      background: var(--mj-brand-primary, #2563eb);
      color: #ffffff;
    }

    .timestamp {
      font-size: 11px;
      color: var(--mj-text-muted, #94a3b8);
    }

    .message-text {
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--mj-text-primary, #0f172a);
      word-break: break-word;
    }

    .mention {
      color: var(--mj-brand-primary, #2563eb);
      font-weight: 600;
      background: color-mix(in srgb, var(--mj-brand-primary, #2563eb) 12%, transparent);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .bullets-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-left: 18px;
      margin: 4px 0 0 0;
      font-size: 13.5px;
      line-height: 1.45;
      color: var(--mj-text-primary, #0f172a);
    }

    .bullet-row {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 6px;
    }

    .citation-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 7px;
      border-radius: var(--mj-radius-sm, 4px);
      border: 1px solid var(--mj-border-subtle, #e2e8f0);
      background: var(--mj-bg-surface-sunken, rgba(148, 163, 184, 0.08));
      font-size: 11px;
      font-weight: 500;
      color: var(--mj-text-primary, #0f172a);
      cursor: pointer;
      vertical-align: middle;
      transition: background-color 0.12s ease;
    }

    .citation-chip:hover {
      background: var(--mj-bg-surface-hover, rgba(0, 0, 0, 0.06));
    }

    .split-cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 6px;
    }

    .split-card {
      padding: 12px;
      border-radius: var(--mj-radius-md, 8px);
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
    }

    .split-card.shared {
      background: var(--mj-brand-tertiary-subtle, rgba(14, 165, 233, 0.06));
      border: 1px solid color-mix(in srgb, var(--mj-brand-tertiary, #0ea5e9) 35%, transparent);
    }

    .split-card.internal {
      background: var(--mj-bg-surface-sunken, rgba(148, 163, 184, 0.08));
      border: 1px solid var(--mj-border-subtle, #cbd5e1);
    }

    .split-card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 12px;
    }

    .split-card.shared .split-card-header { color: var(--mj-brand-tertiary, #0ea5e9); }
    .split-card.internal .split-card-header { color: var(--mj-text-secondary, #64748b); }

    .action-chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }

    .action-chip-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: var(--mj-radius-md, 6px);
      border: 1px solid var(--mj-border-strong, #cbd5e1);
      background: var(--mj-bg-surface, #ffffff);
      font-size: 12px;
      font-weight: 600;
      color: var(--mj-text-primary, #0f172a);
      cursor: pointer;
      transition: background-color 0.12s ease;
    }

    .action-chip-btn:hover {
      background: var(--mj-bg-surface-hover, rgba(0, 0, 0, 0.04));
    }

    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-style: italic;
      color: var(--mj-text-muted, #94a3b8);
      padding: 0 44px;
    }

    .composer-area {
      padding: 16px 20px;
      border-top: 1px solid var(--mj-border-subtle, #e2e8f0);
      background: var(--mj-bg-surface, #ffffff);
      flex-shrink: 0;
    }

    .composer-box {
      border: 1px solid var(--mj-border-subtle, #cbd5e1);
      border-radius: var(--mj-radius-lg, 10px);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--mj-bg-surface, #ffffff);
      transition: border-color 0.15s ease;
    }

    .composer-box:focus-within {
      border-color: var(--mj-brand-primary, #2563eb);
      box-shadow: 0 0 0 1px var(--mj-brand-primary, #2563eb);
    }

    .composer-input {
      width: 100%;
      border: none;
      outline: none;
      font-size: 13.5px;
      font-family: inherit;
      color: var(--mj-text-primary, #0f172a);
      background: transparent;
      resize: none;
    }

    .composer-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .toolbar-tools {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ask-assistant-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: var(--mj-radius-full, 9999px);
      border: 1px solid color-mix(in srgb, var(--mj-brand-tertiary, #0ea5e9) 40%, transparent);
      background: var(--mj-brand-tertiary-subtle, rgba(14, 165, 233, 0.08));
      color: var(--mj-brand-tertiary, #0ea5e9);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .audience-reminder {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--mj-text-muted, #94a3b8);
    }

    .send-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--mj-radius-md, 8px);
      border: none;
      background: var(--mj-brand-tertiary, #0ea5e9);
      color: #ffffff;
      font-size: 13px;
      cursor: pointer;
      transition: opacity 0.12s ease;
    }

    .send-btn:hover {
      opacity: 0.9;
    }
  `],
  template: `
    <mjc-chat-list
      [Chats]="Chats"
      [ActiveChatId]="ActiveChatId"
      (ChatSelected)="onChatSelected($event)"
      (NewChatRequested)="onNewChatRequested()"
    />

    <section class="chat-center">
      <header class="chat-header">
        <div class="header-left">
          <i
            class="header-icon fa-solid"
            [class.fa-eye]="!IsInternal"
            [class.shared]="!IsInternal"
            [class.fa-lock]="IsInternal"
            [class.internal]="IsInternal"
          ></i>
          <h1 class="header-title">{{ ActiveChatTitle }}</h1>
          <span class="audience-pill">{{ AudiencePillText }}</span>
        </div>

        <div class="header-actions">
          <button type="button" class="icon-btn" aria-label="Search chat">
            <i class="fa-solid fa-magnifying-glass"></i>
          </button>
          <button type="button" class="icon-btn" aria-label="Pin conversation">
            <i class="fa-solid fa-thumbtack"></i>
          </button>
          <button type="button" class="icon-btn" aria-label="More options">
            <i class="fa-solid fa-ellipsis"></i>
          </button>
        </div>
      </header>

      <div class="stream-container">
        <mjc-chat-banner
          [IsInternal]="IsInternal"
          [ClientOrgName]="ClientOrgName"
          [FirmName]="FirmName"
          [TotalPeople]="TotalPeople"
        />

        @for (msg of Messages; track msg.id) {
          <article class="message-item">
            <div class="message-avatar-wrap">
              @if (msg.isAssistant) {
                <div class="assistant-avatar">
                  <i class="fa-solid fa-sparkles"></i>
                </div>
              } @else {
                <mjc-avatar
                  [Initials]="msg.authorAvatar.initials"
                  [Name]="msg.authorAvatar.name || ''"
                  [ColorClass]="msg.authorAvatar.colorClass || ''"
                  [IsOutside]="!!msg.authorAvatar.isOutside"
                  [Size]="'md'"
                />
              }
            </div>

            <div class="message-body">
              <header class="message-meta">
                <span class="author-name">{{ msg.authorName }}</span>
                @if (msg.orgBadge) {
                  <span class="org-badge">{{ msg.orgBadge }}</span>
                }
                @if (msg.isAssistant) {
                  <span class="ai-badge">AI</span>
                }
                <time class="timestamp">{{ msg.timestamp }}</time>
              </header>

              <div class="message-text">
                <span [innerHTML]="msg.text"></span>
              </div>

              @if (msg.bullets && msg.bullets.length > 0) {
                <ul class="bullets-list">
                  @for (b of msg.bullets; track $index) {
                    <li class="bullet-row">
                      <span [innerHTML]="b.text"></span>
                      @if (b.citation) {
                        <button
                          type="button"
                          class="citation-chip"
                          (click)="onCitationClicked(b.citation)"
                        >
                          <mjc-file-icon [Kind]="b.citation.kind" [Size]="'sm'" />
                          <span>{{ b.citation.label }}</span>
                        </button>
                      }
                    </li>
                  }
                </ul>
              }

              @if (msg.splitCards) {
                <div class="split-cards-grid">
                  <div class="split-card shared">
                    <div class="split-card-header">
                      <i class="fa-solid fa-eye"></i>
                      <span>{{ msg.splitCards.sharedTitle }}</span>
                    </div>
                    <p>{{ msg.splitCards.sharedText }}</p>
                    @if (msg.splitCards.sharedCitations && msg.splitCards.sharedCitations.length > 0) {
                      <div>
                        @for (sc of msg.splitCards.sharedCitations; track sc.id) {
                          <button
                            type="button"
                            class="citation-chip"
                            (click)="onCitationClicked(sc)"
                          >
                            <mjc-file-icon [Kind]="sc.kind" [Size]="'sm'" />
                            <span>{{ sc.label }}</span>
                          </button>
                        }
                      </div>
                    }
                  </div>

                  <div class="split-card internal">
                    <div class="split-card-header">
                      <i class="fa-solid fa-lock"></i>
                      <span>{{ msg.splitCards.internalTitle }}</span>
                    </div>
                    <p>{{ msg.splitCards.internalText }}</p>
                    @if (msg.splitCards.internalCitation) {
                      <div>
                        <button
                          type="button"
                          class="citation-chip"
                          (click)="onCitationClicked(msg.splitCards.internalCitation)"
                        >
                          <mjc-file-icon [Kind]="msg.splitCards.internalCitation.kind" [Size]="'sm'" />
                          <span>{{ msg.splitCards.internalCitation.label }}</span>
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (msg.suggestedActions && msg.suggestedActions.length > 0) {
                <div class="action-chips-row">
                  @for (act of msg.suggestedActions; track act.id) {
                    <button
                      type="button"
                      class="action-chip-btn"
                      (click)="onActionTriggered(act.id)"
                    >
                      @if (act.iconClass) {
                        <i [class]="act.iconClass"></i>
                      }
                      <span>{{ act.label }}</span>
                    </button>
                  }
                </div>
              }

              @if (msg.answerReceipt) {
                <mjc-answer-receipt
                  [SharedCount]="msg.answerReceipt.sharedCount"
                  [TeamCount]="msg.answerReceipt.teamCount"
                  [IsInternal]="msg.answerReceipt.isInternal"
                  [ClientOrgName]="ClientOrgName"
                  [ThumbsUpCount]="msg.answerReceipt.thumbsUpCount || 0"
                />
              }
            </div>
          </article>
        }

        @if (TypingText) {
          <div class="typing-indicator">
            <span>{{ TypingText }}</span>
          </div>
        }
      </div>

      <footer class="composer-area">
        <div class="composer-box">
          <textarea
            class="composer-input"
            rows="2"
            [placeholder]="'Message ' + ActiveChatTitle"
            [(ngModel)]="draftText"
            (keydown.enter)="onEnterPressed($event)"
          ></textarea>

          <div class="composer-toolbar">
            <div class="toolbar-tools">
              <button type="button" class="icon-btn" aria-label="Add attachment" title="Attach file">
                <i class="fa-solid fa-paperclip"></i>
              </button>
              <button type="button" class="icon-btn" aria-label="Mention person" title="Mention">
                <i class="fa-solid fa-at"></i>
              </button>
              <button type="button" class="icon-btn" aria-label="Insert emoji" title="Emoji">
                <i class="fa-regular fa-face-smile"></i>
              </button>
              <button type="button" class="ask-assistant-pill" (click)="onAskAssistant()">
                <i class="fa-solid fa-sparkles"></i>
                <span>Ask the Assistant</span>
              </button>
            </div>

            <div class="audience-reminder">
              <i class="fa-solid" [class.fa-eye]="!IsInternal" [class.fa-lock]="IsInternal"></i>
              <span>{{ ReminderText }}</span>
              <button type="button" class="send-btn" (click)="onSendMessage()" aria-label="Send message">
                <i class="fa-solid fa-arrow-up"></i>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </section>

    <mjc-chat-lens
      [AudienceGroups]="AudienceGroups"
      [CanUseShared]="CanUseShared"
      [SharedCount]="SharedCount"
      [CanUseTeam]="CanUseTeam"
      [TeamCount]="TeamCount"
      [PinnedItems]="PinnedItems"
      [IsInternal]="IsInternal"
      [FirmName]="FirmName"
      (PinnedItemSelected)="onPinnedItemSelected($event)"
    />
  `,
})
export class CollabSpaceChatsComponent {
  @Input() Chats: ChatSummaryModel[] = [];
  @Input() ActiveChatId = 'discovery-room';
  @Input() ActiveChatTitle = 'Discovery room';
  @Input() AudiencePillText = 'Everyone · 9';
  @Input() IsInternal = false;
  @Input() TotalPeople = 9;
  @Input() FirmName = 'Meridian';
  @Input() ClientOrgName = 'Northwind';
  @Input() ReminderText = '9 people will see this, 6 at Northwind';
  @Input() Messages: ChatMessageModel[] = [];
  @Input() TypingText = '••• Sam is typing...';

  @Input() AudienceGroups: ChatLensAudienceGroup[] = [];
  @Input() CanUseShared = true;
  @Input() SharedCount = 9;
  @Input() CanUseTeam = false;
  @Input() TeamCount = 15;
  @Input() PinnedItems: ChatLensPinnedItem[] = [];

  @Output() ChatSelected = new EventEmitter<string>();
  @Output() NewChatRequested = new EventEmitter<void>();
  @Output() MessageSent = new EventEmitter<string>();
  @Output() ActionTriggered = new EventEmitter<string>();
  @Output() CitationSelected = new EventEmitter<ChatMessageCitation>();
  @Output() PinnedItemSelected = new EventEmitter<string>();

  public draftText = '';

  public onChatSelected(id: string): void {
    this.ChatSelected.emit(id);
  }

  public onNewChatRequested(): void {
    this.NewChatRequested.emit();
  }

  public onEnterPressed(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (!keyEvent.shiftKey) {
      keyEvent.preventDefault();
      this.onSendMessage();
    }
  }

  public onSendMessage(): void {
    const text = this.draftText.trim();
    if (!text) return;
    this.MessageSent.emit(text);
    this.draftText = '';
  }

  public onAskAssistant(): void {
    this.draftText = '@Assistant ';
  }

  public onActionTriggered(actionId: string): void {
    this.ActionTriggered.emit(actionId);
  }

  public onCitationClicked(citation: ChatMessageCitation): void {
    this.CitationSelected.emit(citation);
  }

  public onPinnedItemSelected(id: string): void {
    this.PinnedItemSelected.emit(id);
  }
}
