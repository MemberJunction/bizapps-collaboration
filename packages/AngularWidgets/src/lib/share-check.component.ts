import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FindingModel, FileKind, RecipientPersonModel } from './types';
import { CollabAvatarComponent } from './avatar.component';
import { CollabBandChipComponent } from './band-chip.component';
import { CollabFileIconComponent } from './file-icon.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-share-check',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CollabAvatarComponent, CollabBandChipComponent, CollabFileIconComponent],
  template: `
    <div class="m-h">
      <span class="m-ic">
        <i class="fa-solid fa-share-from-square"></i>
      </span>
      <div class="grow">
        <div class="fw7 title">{{ Title }}</div>
        <div class="row gap6 fs13 secondary subtitle">
          <mjc-file-icon [Kind]="Kind" Size="sm" />
          <b class="item-name">{{ ItemName }}</b>
          <span class="muted">moves from</span>
          <mjc-band-chip Band="Team" Label="Team" />
          <i class="fa-solid fa-arrow-right-long muted fs12"></i>
          <mjc-band-chip Band="Shared" Label="Shared" />
        </div>
      </div>
      <button type="button" class="icon-btn-ghost close-btn" (click)="onCancel()" aria-label="Close dialog">
        <i class="fa-solid fa-xmark muted"></i>
      </button>
    </div>

    <div class="m-b">
      <div class="m-sec">
        <div class="row">
          <span class="fw7 fs13">{{ AudienceHeader }}</span>
          <span class="fs12 muted audience-sub">{{ AudienceStaffSub }}</span>
        </div>
        <div class="pgrid">
          @for (p of Recipients; track p.id || p.name) {
            @if (p.isMore) {
              <div class="pp more">
                <mjc-avatar [Initials]="'+' + (p.moreCount || 2)" Size="sm" ColorClass="c7" [IsOutside]="true" />
                <div class="grow">
                  <div class="fw6 fs12-5">{{ p.name }}</div>
                  <div class="fs11 muted">{{ p.role }}</div>
                </div>
              </div>
            } @else {
              <div class="pp">
                <mjc-avatar [Avatar]="p.avatar" Size="sm" />
                <div class="grow">
                  <div class="fw6 fs12-5 ellipsis">{{ p.name }}</div>
                  <div class="fs11 muted ellipsis">{{ p.role }}</div>
                </div>
              </div>
            }
          }
        </div>
      </div>

      @if (Findings && Findings.length > 0) {
        <div class="review">
          <div class="row gap10">
            <span class="ai-av md">
              <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/>
                <path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/>
              </svg>
            </span>
            <div class="grow">
              <div class="fw7 fs14">{{ ReviewHeader }}</div>
              <div class="fs12-5 secondary">{{ ReviewSub }}</div>
            </div>
            <span class="chip warn">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>{{ pendingCount }} to review</span>
            </span>
          </div>

          @for (fix of Findings; track fix.id) {
            @let parts = getQuotationParts(fix);
            <div class="fix">
              <div class="fix-q">{{ parts.before }}<mark class="marked-phrase" [class.applied]="fix.status === 'Applied'">{{ parts.marked }}</mark>{{ parts.after }}</div>
              <div class="fix-a">
                <span class="muted fs12">Suggest</span>
                <span class="sugg">{{ fix.suggestedPhrase }}</span>
                @if (fix.status === 'Applied') {
                  <span class="applied-badge">
                    <i class="fa-solid fa-check"></i>
                    <span>Applied</span>
                  </span>
                } @else {
                  <button type="button" class="btn sm apply-btn" (click)="onApplyFix(fix)">
                    <i class="fa-solid fa-check"></i>
                    <span>Apply</span>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }

      <div class="m-sec">
        <div class="fw7 fs13 note-title">
          <span>Note to {{ ClientOrgName }}</span>
          <span class="muted fw5">&nbsp;(sent with the notification)</span>
        </div>
        <textarea class="textarea note-textarea" [(ngModel)]="Note"></textarea>
        <div class="effects">
          <div class="eff">
            <span class="switch" [class.on]="NotifyRecipients" (click)="NotifyRecipients = !NotifyRecipients"></span>
            <span>Notify the {{ RecipientCount }} people at {{ ClientOrgName }}</span>
          </div>
          <div class="eff">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>The Assistant can quote it in chats that include {{ ClientOrgName }}</span>
          </div>
          <div class="eff">
            <i class="fa-solid fa-signature"></i>
            <span>Recorded as shared by <b>{{ AuthorName }}</b> {{ formattedTimestamp }}. You can move it back to Team; a sent notification can’t be recalled.</span>
          </div>
        </div>
      </div>
    </div>

    <div class="m-f">
      <button type="button" class="btn primary" (click)="onApplyAndShare()">
        <i class="fa-solid fa-check"></i>
        <span>{{ primaryButtonText }}</span>
      </button>
      <button type="button" class="btn" (click)="onShareAsIs()">Share as is</button>
      <button type="button" class="btn ghost cancel-btn" (click)="onCancel()">Cancel</button>
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: flex;
      flex-direction: column;
      max-height: 100%;
      min-height: 0;
      box-sizing: border-box;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-size: 14px;
      line-height: var(--mjc-line-height);
    }

    .m-h {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 20px 22px 16px;
      border-bottom: 1px solid var(--mj-border-default);
      flex: none;
    }

    .m-ic {
      width: 40px;
      height: 40px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      background: var(--mjc-shared-strong);
      color: var(--mjc-on-strong);
      font-size: 16px;
      flex: none;
    }

    .title {
      font-size: 18px;
    }

    .subtitle {
      margin-top: 3px;
    }

    .item-name {
      font-weight: 600;
      color: var(--mj-text-primary);
    }

    .close-btn {
      background: transparent;
      border: 0;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 4px;
    }

    .m-b {
      padding: 16px 22px 6px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      overflow-y: auto;
      flex: 1 1 auto;
      min-height: 0;
    }

    .audience-sub {
      margin-left: auto;
    }

    .pgrid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }

    .pp {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 10px;
      border: 1px solid var(--mjc-shared-border);
      background: var(--mjc-shared-bg);
      border-radius: 10px;
      min-width: 0;

      &.more {
        background: var(--mj-bg-surface);
        border-style: dashed;
      }
    }

    .review {
      border: 1px solid color-mix(in srgb, var(--mj-status-warning) 40%, transparent);
      background: linear-gradient(180deg, var(--mj-status-warning-bg), var(--mj-bg-surface));
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .fix {
      background: var(--mj-bg-surface);
      border: 1px solid var(--mj-border-default);
      border-radius: 10px;
      padding: 10px 12px;
    }

    .fix-q {
      font-size: 13px;
      color: var(--mj-text-secondary);
      font-family: Georgia, 'DejaVu Serif', serif;

      .marked-phrase {
        background: color-mix(in srgb, var(--mj-status-warning) 35%, transparent);
        color: var(--mj-text-primary);
        border-radius: 3px;
        padding: 0 2px;
        text-decoration: line-through;
        text-decoration-color: color-mix(in srgb, var(--mj-status-error, #ef4444) 70%, transparent);

        &.applied {
          text-decoration: none;
          background: var(--mj-status-success-bg);
          color: var(--mj-status-success-text);
        }
      }
    }

    .fix-a {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .sugg {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--mj-status-success-text);
      background: var(--mj-status-success-bg);
      border: 1px solid color-mix(in srgb, var(--mj-status-success) 35%, transparent);
      padding: 2px 8px;
      border-radius: 6px;
    }

    .apply-btn {
      margin-left: auto;
      min-height: 32px;
      height: 33.5px;
      padding: 0 12px;
      border-radius: var(--mj-radius-sm);
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-primary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;

      i {
        font-size: 13px;
      }

      &:hover {
        background: var(--mj-bg-surface-hover);
      }
    }

    .applied-badge {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 600;
      color: var(--mj-status-success-text);
    }

    .note-title {
      margin-bottom: 8px;
    }

    .note-textarea {
      min-height: 80px;
      height: 80px;
      width: 100%;
      box-sizing: border-box;
      resize: none;
      display: block;
    }

    .textarea {
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-sm);
      background: var(--mj-bg-surface);
      padding: 8px 12px;
      font-size: var(--mj-text-sm);
      color: var(--mj-text-primary);
      line-height: 1.5;
      font-family: inherit;
      outline: none;

      &:focus {
        border-color: var(--mj-brand-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--mj-brand-primary) 15%, transparent);
      }
    }

    .effects {
      display: flex;
      flex-direction: column;
      gap: 9px;
      margin-top: 8px;
    }

    .eff {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12.5px;
      color: var(--mj-text-secondary);

      > i {
        width: 34px;
        text-align: center;
        color: var(--mj-text-muted);
      }

      b {
        color: var(--mj-text-primary);
        font-weight: 600;
      }
    }

    .switch {
      position: relative;
      width: 44px;
      height: 24px;
      margin: 10px 4px;
      border-radius: var(--mj-radius-full);
      background: var(--mj-border-strong);
      flex: none;
      cursor: pointer;

      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        border-radius: var(--mj-radius-full);
        background: var(--mj-bg-surface);
        box-shadow: var(--mj-shadow-sm);
        transition: left 0.15s ease;
      }

      &.on {
        background: var(--mj-brand-primary);

        &::after {
          left: 22px;
        }
      }
    }

    .m-f {
      display: flex;
      gap: 10px;
      padding: 14px 22px 16px;
      border-top: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface-card);
      margin-top: 6px;
      flex: none;
    }

    .cancel-btn {
      margin-left: auto;
    }

    .btn {
      min-height: 44px;
      height: 44px;
      padding: 0 20px;
      border-radius: var(--mj-radius-md);
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-primary);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

      &.sm {
        min-height: 32px;
        height: 33.5px;
        padding: 0 12px;
        font-size: 13px;
        gap: 6px;
      }

      &.primary {
        background: var(--mj-brand-primary);
        color: var(--mj-brand-on-primary);
        border: 0;

        &:hover {
          background: var(--mj-brand-primary-hover);
        }
      }

      &.ghost {
        background: transparent;
        border: 0;
        color: var(--mj-text-secondary);

        &:hover {
          background: var(--mj-bg-surface-hover);
        }
      }
    }

    .row {
      display: flex;
      align-items: center;
    }

    .gap6 { gap: 6px; }
    .gap8 { gap: 8px; }
    .gap10 { gap: 10px; }

    .grow {
      flex: 1;
      min-width: 0;
    }

    .ai-av.md {
      width: 32px;
      height: 32px;
      font-size: 14px;
      border-radius: 9px;
      display: inline-grid;
      place-items: center;
      background: linear-gradient(135deg, var(--mjc-ai-from), var(--mjc-ai-to));
      color: var(--mj-text-inverse);
      flex: none;
    }

    .chip.warn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 99px;
      background: var(--mj-status-warning-bg);
      color: var(--mj-status-warning-text);
      border: 1px solid color-mix(in srgb, var(--mj-status-warning) 30%, transparent);

      i { font-size: 11px; }
    }

    .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .fw5 { font-weight: 500; }
    .fw6 { font-weight: 600; }
    .fw7 { font-weight: 700; }
    .fs11 { font-size: 11px; }
    .fs12 { font-size: 12px; }
    .fs12-5 { font-size: 12.5px; }
    .fs13 { font-size: 13px; }
    .fs14 { font-size: 14px; }
    .muted { color: var(--mj-text-muted); }
    .secondary { color: var(--mj-text-secondary); }
  `],
})
export class CollabShareCheckComponent {
  @Input() public Title = 'Share with Northwind';
  @Input() public ItemName = 'Interview synthesis v3';
  @Input() public Kind: FileKind = 'doc';
  @Input() public ClientOrgName = 'Northwind';
  @Input() public RecipientCount = 6;
  @Input() public AudienceHeader = '6 people at Northwind will be able to open it';
  @Input() public AudienceStaffSub = 'Meridian’s 3 already can';
  @Input() public Recipients: RecipientPersonModel[] = [];
  @Input() public ReviewHeader = 'The Assistant checked it first';
  @Input() public ReviewSub = 'Two phrases could identify someone you interviewed under a promise of anonymity.';
  @Input() public Findings: FindingModel[] = [];
  @Input() public Note = 'Synthesis from all 18 interviews — we’ll walk through it together on Thursday.';
  @Input() public NotifyRecipients = true;
  @Input() public AuthorName = 'Ada Lovell';
  @Input() public Timestamp = '10:14 AM';

  @Output() public ApplyFixRequested = new EventEmitter<FindingModel>();
  @Output() public ShareRequested = new EventEmitter<{ applyFixes: boolean; note: string; notify: boolean }>();
  @Output() public CancelRequested = new EventEmitter<void>();

  public get pendingCount(): number {
    return this.Findings.filter((f) => f.status === 'Flagged').length;
  }

  public get primaryButtonText(): string {
    const count = this.pendingCount;
    return count > 0 ? `Apply ${count} fixes and share` : 'Share';
  }

  public get formattedTimestamp(): string {
    if (!this.Timestamp) return '';
    return this.Timestamp.startsWith('today at ') ? this.Timestamp : `today at ${this.Timestamp}`;
  }

  public getQuotationParts(fix: FindingModel): { before: string; marked: string; after: string } {
    let q = fix.quotation;
    q = q.replace(/<\/?mark[^>]*>/g, '');
    const phrase = fix.originalPhrase;
    const idx = q.indexOf(phrase);
    if (idx === -1) {
      return { before: q, marked: '', after: '' };
    }
    const before = q.slice(0, idx);
    const after = q.slice(idx + phrase.length);
    const marked = fix.status === 'Applied' ? fix.suggestedPhrase : phrase;
    return { before, marked, after };
  }

  public onApplyFix(fix: FindingModel): void {
    this.ApplyFixRequested.emit(fix);
  }

  public onApplyAndShare(): void {
    this.ShareRequested.emit({
      applyFixes: true,
      note: this.Note,
      notify: this.NotifyRecipients,
    });
  }

  public onShareAsIs(): void {
    this.ShareRequested.emit({
      applyFixes: false,
      note: this.Note,
      notify: this.NotifyRecipients,
    });
  }

  public onCancel(): void {
    this.CancelRequested.emit();
  }
}
