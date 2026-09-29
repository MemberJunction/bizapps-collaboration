import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MJButtonDirective, MJDialogActionsComponent, MJDialogComponent } from '@memberjunction/ng-ui-components';
import { CollabDialogBase } from './dialog-base';
import type { FileKind, FindingModel, RecipientPersonModel } from './types';
import { CollabShareCheckComponent } from './share-check.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-share-check-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MJDialogComponent, MJDialogActionsComponent, MJButtonDirective, CollabShareCheckComponent],
  template: `
    <mj-dialog [Visible]="true" [Title]="Title || 'Share an item'" [Width]="680" (Close)="onCancel()">
    <div class="share-modal">
      <mjc-share-check
        #check
        [Framed]="false"
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
        [ReviewCompleted]="ReviewCompleted"
        [Note]="Note"
        [NotifyRecipients]="NotifyRecipients"
        [AuthorName]="AuthorName"
        [Timestamp]="Timestamp"
        (ApplyFixRequested)="onApplyFix($event)"
        (ShareRequested)="onShareRequested($event)"
        (CancelRequested)="onCancel()"
      />
    </div>
    <mj-dialog-actions>
      @if (Findings && Findings.length > 0) {
        <button mjButton variant="primary" (click)="check.onApplyAndShare()">
          <i class="fa-solid fa-check"></i>
          <span>{{ check.primaryButtonText }}</span>
        </button>
        <button mjButton variant="secondary" (click)="check.onShareAsIs()">Share as is</button>
      } @else {
        <button mjButton variant="primary" (click)="check.onShareAsIs()">
          <i class="fa-solid fa-share"></i>
          <span>Share</span>
        </button>
      }
      <button mjButton variant="flat" (click)="onCancel()">Cancel</button>
    </mj-dialog-actions>
    </mj-dialog>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: contents;
    }

    .share-modal {
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-size: 14px;
      line-height: var(--mjc-line-height);
    }
  `],
})
export class CollabShareCheckDialogComponent extends CollabDialogBase {
  @ViewChild(MJDialogComponent, { read: ElementRef }) private dialogHost?: ElementRef<HTMLElement>;
  protected override DialogBox(): ElementRef<HTMLElement> | undefined { return this.dialogHost; }

  @Input() public Title = '';
  @Input() public ItemName = '';
  @Input() public Kind: FileKind = 'doc';
  @Input() public ClientOrgName = '';
  @Input() public RecipientCount = 0;
  @Input() public AudienceHeader = '';
  @Input() public AudienceStaffSub = '';
  @Input() public Recipients: RecipientPersonModel[] = [];
  @Input() public ReviewHeader = '';
  @Input() public ReviewSub = '';
  @Input() public Findings: FindingModel[] = [];
  @Input() public ReviewCompleted = false;
  @Input() public Note = '';
  @Input() public NotifyRecipients = true;
  @Input() public AuthorName = '';
  @Input() public Timestamp = '';

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
