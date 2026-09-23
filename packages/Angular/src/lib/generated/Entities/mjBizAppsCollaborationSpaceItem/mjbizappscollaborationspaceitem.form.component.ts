import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Items') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspaceitem-form',
    templateUrl: './mjbizappscollaborationspaceitem.form.component.html'
})
export class mjBizAppsCollaborationSpaceItemFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceItemEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

