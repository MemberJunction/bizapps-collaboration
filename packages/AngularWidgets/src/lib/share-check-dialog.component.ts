import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { FileKind, FindingModel, RecipientPersonModel } from './types';
import { CollabShareCheckComponent } from './share-check.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-share-check-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabShareCheckComponent],
  template: `
    <div class="scrim" (click)="onCancel()"></div>
    <div class="modal share-modal">
      <mjc-share-check
        [Title]="Title"
        [ItemName]="ItemName"
        [Kind]="Kind"
        [ClientOrgName]="ClientOrgName"
        [RecipientCount]="RecipientCount"
        [AudienceHeader]="AudienceHeader"
        [AudienceStaffSub]="AudienceStaffSub"
        [Recipients]="Recipients"
        [ReviewHeader]="ReviewHeader"
        [ReviewSub]="ReviewSub"
        [Findings]="Findings"
        [Note]="Note"
        [NotifyRecipients]="NotifyRecipients"
        [AuthorName]="AuthorName"
        [Timestamp]="Timestamp"
        (ApplyFixRequested)="onApplyFix($event)"
        (ShareRequested)="onShareRequested($event)"
        (CancelRequested)="onCancel()"
      />
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 1000;
      line-height: var(--mjc-line-height);
    }

    .scrim {
      position: absolute;
      inset: 0;
      background: var(--mj-bg-overlay);
      backdrop-filter: blur(1.5px);
    }

    .modal.share-modal {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 680px;
      transform: translate(-50%, -50%);
      background: var(--mj-bg-surface);
      border-radius: 16px;
      box-shadow: var(--mj-shadow-2xl);
      border: 1px solid var(--mj-border-default);
      overflow: hidden;
      box-sizing: border-box;
      z-index: 1001;
    }
  `],
})
export class CollabShareCheckDialogComponent {
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

  public onApplyFix(fix: FindingModel): void {
    this.ApplyFixRequested.emit(fix);
  }

  public onShareRequested(result: { applyFixes: boolean; note: string; notify: boolean }): void {
    this.ShareRequested.emit(result);
  }

  public onCancel(): void {
    this.CancelRequested.emit();
  }
}
