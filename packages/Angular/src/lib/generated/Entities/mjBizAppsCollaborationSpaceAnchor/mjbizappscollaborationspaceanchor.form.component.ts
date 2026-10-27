import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceAnchorEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Anchors') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspaceanchor-form',
    templateUrl: './mjbizappscollaborationspaceanchor.form.component.html'
})
export class mjBizAppsCollaborationSpaceAnchorFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceAnchorEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

