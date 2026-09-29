import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MJDialogComponent } from '@memberjunction/ng-ui-components';
import { CollabDialogBase } from './dialog-base';
import type { FileKind, FindingModel, RecipientPersonModel } from './types';
import { CollabShareCheckComponent } from './share-check.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-share-check-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MJDialogComponent, CollabShareCheckComponent],
  template: `
    <mj-dialog [Visible]="true" [Width]="680" (Close)="onCancel()">
    <div #dialogBox class="share-modal">
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
  @ViewChild('dialogBox') private dialogBox?: ElementRef<HTMLElement>;
  protected override DialogBox(): ElementRef<HTMLElement> | undefined { return this.dialogBox; }

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
