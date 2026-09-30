import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MJButtonDirective, MJDialogActionsComponent, MJDialogComponent } from '@memberjunction/ng-ui-components';
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
    <!-- The dialog has no field, so mj-dialog would open on its first button: Share, when there are no findings. The focus starts
         here instead, on the content itself, so that Enter right after it opens shares nothing. -->
    <div class="share-modal" data-autofocus tabindex="-1">
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
        <button mjButton Variant="primary" (click)="check.onApplyAndShare()">
          <i class="fa-solid fa-check"></i>
          <span>{{ check.primaryButtonText }}</span>
        </button>
        <button mjButton Variant="secondary" (click)="check.onShareAsIs()">Share as is</button>
      } @else {
        <button mjButton Variant="primary" (click)="check.onShareAsIs()">
          <i class="fa-solid fa-share"></i>
          <span>Share</span>
        </button>
      }
      <button mjButton Variant="flat" (click)="onCancel()">Cancel</button>
    </mj-dialog-actions>
    </mj-dialog>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: contents;
    }

    /* A place for the focus to start, not a control: it takes no outline */
    .share-modal:focus {
      outline: none;
    }

    .share-modal {
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-size: 14px;
      line-height: var(--mjc-line-height);
    }
  `],
})
export class CollabShareCheckDialogComponent {
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
  @Input() public NotifyRecipients = true;
  @Input() public AuthorName = '';
  @Input() public Timestamp = '';

  @Output() public ApplyFixRequested = new EventEmitter<FindingModel>();
  @Output() public ShareRequested = new EventEmitter<{ applyFixes: boolean; notify: boolean }>();
  @Output() public CancelRequested = new EventEmitter<void>();

  public onApplyFix(fix: FindingModel): void {
    this.ApplyFixRequested.emit(fix);
  }

  public onShareRequested(result: { applyFixes: boolean; notify: boolean }): void {
    this.ShareRequested.emit(result);
  }

  public onCancel(): void {
    this.CancelRequested.emit();
  }
}
