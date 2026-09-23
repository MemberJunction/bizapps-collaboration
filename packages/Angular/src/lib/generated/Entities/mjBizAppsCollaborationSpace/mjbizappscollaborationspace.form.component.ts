import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Spaces') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspace-form',
    templateUrl: './mjbizappscollaborationspace.form.component.html'
})
export class mjBizAppsCollaborationSpaceFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsCollaborationSpaceItems', sectionName: 'Space Items', isExpanded: false },
            { sectionKey: 'mJBizAppsCollaborationSpaces', sectionName: 'Spaces', isExpanded: false },
            { sectionKey: 'mJBizAppsCollaborationSpaceMembers', sectionName: 'Space Members', isExpanded: false },
            { sectionKey: 'mJBizAppsCollaborationItemUses', sectionName: 'Item Uses', isExpanded: false },
            { sectionKey: 'mJBizAppsCollaborationShareNotices', sectionName: 'Share Notices', isExpanded: false }
        ]);
    }
}

