import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceAgentSourceReceiptEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Agent Source Receipts')
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspaceagentsourcereceipt-form',
    templateUrl: './mjbizappscollaborationspaceagentsourcereceipt.form.component.html'
})
export class mjBizAppsCollaborationSpaceAgentSourceReceiptFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceAgentSourceReceiptEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}
