import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspacetype-form',
    templateUrl: './mjbizappscollaborationspacetype.form.component.html'
})
export class mjBizAppsCollaborationSpaceTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsCollaborationSpaces', sectionName: 'Spaces', isExpanded: false },
            { sectionKey: 'mJBizAppsCollaborationSpaceAnchors', sectionName: 'Space Anchors', isExpanded: false },
            { sectionKey: 'mJBizAppsCollaborationSpaceTypeStatus', sectionName: 'Space Type Status', isExpanded: false },
            { sectionKey: 'mJBizAppsCollaborationSpaceGrants', sectionName: 'Space Grants', isExpanded: false }
        ]);
    }
}

