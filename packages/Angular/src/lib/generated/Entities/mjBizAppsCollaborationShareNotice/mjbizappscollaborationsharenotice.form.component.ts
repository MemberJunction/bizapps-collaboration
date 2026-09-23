import { Component } from '@angular/core';
import { mjBizAppsCollaborationShareNoticeEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Share Notices') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationsharenotice-form',
    templateUrl: './mjbizappscollaborationsharenotice.form.component.html'
})
export class mjBizAppsCollaborationShareNoticeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationShareNoticeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

