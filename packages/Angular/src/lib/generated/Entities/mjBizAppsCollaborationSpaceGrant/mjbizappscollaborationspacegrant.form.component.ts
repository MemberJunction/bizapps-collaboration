import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceGrantEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Grants') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspacegrant-form',
    templateUrl: './mjbizappscollaborationspacegrant.form.component.html'
})
export class mjBizAppsCollaborationSpaceGrantFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceGrantEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsCollaborationSpaceMemberPins', sectionName: 'Space Member Pins', isExpanded: false }
        ]);
    }
}

