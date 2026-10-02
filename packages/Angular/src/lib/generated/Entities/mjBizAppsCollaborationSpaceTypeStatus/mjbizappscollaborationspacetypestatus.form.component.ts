import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceTypeStatusEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Type Status') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspacetypestatus-form',
    templateUrl: './mjbizappscollaborationspacetypestatus.form.component.html'
})
export class mjBizAppsCollaborationSpaceTypeStatusFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceTypeStatusEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsCollaborationSpaces', sectionName: 'Spaces', isExpanded: false }
        ]);
    }
}

