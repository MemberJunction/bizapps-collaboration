import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabAvatarComponent } from './avatar.component';
import { CollabFileIconComponent } from './file-icon.component';
import { CollabBandChipComponent } from './band-chip.component';
import type { ChatLensAudienceGroup, ChatLensPinnedItem } from './types';

/**
 * Chat lens right-rail panel widget (L1).
 * Displays audience roster, Assistant data boundary rules, and pinned items.
 * Frames 05 and 11.
 */
@Component({
  selector: 'mjc-chat-lens',
  standalone: true,
  imports: [CommonModule, CollabAvatarComponent, CollabFileIconComponent, CollabBandChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
      border-left: 1px solid var(--mj-border-subtle, #e2e8f0);
      background: var(--mj-bg-surface, #ffffff);
      overflow-y: auto;
      padding: 16px;
      gap: 20px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--mj-text-primary, #0f172a);
      text-transform: none;
      margin: 0 0 10px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .count-muted {
      color: var(--mj-text-muted, #94a3b8);
      font-weight: 500;
    }

    .roster-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .avatar-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .avatar-wrapper {
      position: relative;
    }

    .online-dot {
      position: absolute;
      bottom: -1px;
      right: -1px;
      width: 8px;
      height: 8px;
      border-radius: var(--mj-radius-full, 9999px);
      background: #10b981;
      border: 1.5px solid var(--mj-bg-surface, #ffffff);
    }

    .boundary-card {
      padding: 14px;
      border-radius: var(--mj-radius-lg, 10px);
      background: var(--mj-bg-surface-sunken, rgba(148, 163, 184, 0.06));
      border: 1px solid var(--mj-border-subtle, #e2e8f0);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .boundary-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--mj-text-primary, #0f172a);
    }

    .sparkle-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: var(--mj-radius-md, 6px);
      background: var(--mj-brand-tertiary, #0ea5e9);
      color: var(--mj-text-inverse, #ffffff);
      font-size: 11px;
    }

    .rules-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rule-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
    }

    .rule-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rule-count {
      color: var(--mj-text-secondary, #64748b);
    }

    .rule-status {
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .rule-status.allowed {
      color: #10b981;
    }

    .rule-status.denied {
      color: var(--mj-text-muted, #94a3b8);
    }

    .boundary-explainer {
      font-size: 11px;
      line-height: 1.45;
      color: var(--mj-text-secondary, #64748b);
      margin: 0;
      padding-top: 4px;
      border-top: 1px solid var(--mj-border-subtle, #e2e8f0);
    }

    .boundary-explainer strong {
      color: var(--mj-text-primary, #0f172a);
    }

    .pinned-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pinned-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--mj-radius-md, 8px);
      border: 1px solid var(--mj-border-subtle, #e2e8f0);
      background: var(--mj-bg-surface, #ffffff);
      cursor: pointer;
      transition: background-color 0.12s ease, border-color 0.12s ease;
    }

    .pinned-item:hover {
      background: var(--mj-bg-surface-hover, rgba(0, 0, 0, 0.03));
      border-color: var(--mj-border-strong, #cbd5e1);
    }

    .pinned-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .pinned-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--mj-text-primary, #0f172a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pinned-meta {
      font-size: 11px;
      color: var(--mj-text-muted, #94a3b8);
    }
  `],
  template: `
    <div class="roster-group">
      @for (group of AudienceGroups; track group.name) {
        <div>
          <div class="section-title">
            <span>{{ group.name }}</span>
            <span class="count-muted">{{ group.count }}</span>
          </div>
          <div class="avatar-grid">
            @for (person of group.members; track person.id || person.initials) {
              <div class="avatar-wrapper" [title]="person.name || person.initials">
                <mjc-avatar
                  [Initials]="person.initials"
                  [Name]="person.name || ''"
                  [ColorClass]="person.colorClass || ''"
                  [IsOutside]="!!person.isOutside"
                  [Size]="'md'"
                />
                <span class="online-dot"></span>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <div class="boundary-card">
      <div class="boundary-header">
        <span class="sparkle-icon"><i class="fa-solid fa-sparkles"></i></span>
        <span>What it can use here</span>
      </div>

      <div class="rules-list">
        <div class="rule-row">
          <div class="rule-left">
            <mjc-band-chip [Band]="'Shared'" />
            <span class="rule-count">{{ SharedCount }} items</span>
          </div>
          <span class="rule-status allowed"><i class="fa-solid fa-check"></i> Yes</span>
        </div>

        <div class="rule-row">
          <div class="rule-left">
            <mjc-band-chip [Band]="'Team'" />
            <span class="rule-count">{{ TeamCount }} items</span>
          </div>
          @if (CanUseTeam) {
            <span class="rule-status allowed"><i class="fa-solid fa-check"></i> Yes</span>
          } @else {
            <span class="rule-status denied"><i class="fa-solid fa-xmark"></i> Not here</span>
          }
        </div>
      </div>

      <p class="boundary-explainer">
        @if (!CanUseTeam) {
          It only uses what <strong>everyone</strong> in the chat can open. If someone joins or leaves, the next answer follows the new list. Ask in <strong>{{ FirmName }} team</strong> to include Team material.
        } @else {
          Everyone here is {{ FirmName }} staff, so Team material is in play. Nothing said here reaches outside clients unless someone shares it.
        }
      </p>
    </div>

    <div>
      <div class="section-title">Pinned</div>
      <div class="pinned-list">
        @for (item of PinnedItems; track item.id) {
          <div
            class="pinned-item"
            (click)="onSelectPinned(item.id)"
            role="button"
            tabindex="0"
            (keydown.enter)="onSelectPinned(item.id)"
          >
            <mjc-file-icon [Kind]="item.kind" [Size]="'md'" />
            <div class="pinned-details">
              <span class="pinned-title">{{ item.title }}</span>
              <span class="pinned-meta">{{ item.meta }}</span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class CollabChatLensComponent {
  @Input() AudienceGroups: ChatLensAudienceGroup[] = [];
  @Input() CanUseShared = true;
  @Input() SharedCount = 9;
  @Input() CanUseTeam = false;
  @Input() TeamCount = 15;
  @Input() PinnedItems: ChatLensPinnedItem[] = [];
  @Input() IsInternal = false;
  @Input() FirmName = 'Meridian';

  @Output() PinnedItemSelected = new EventEmitter<string>();

  public onSelectPinned(id: string): void {
    this.PinnedItemSelected.emit(id);
  }
}
