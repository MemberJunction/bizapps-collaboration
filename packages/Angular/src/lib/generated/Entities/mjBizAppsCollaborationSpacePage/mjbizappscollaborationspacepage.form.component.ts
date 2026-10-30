import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpacePageEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Pages') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspacepage-form',
    templateUrl: './mjbizappscollaborationspacepage.form.component.html'
})
export class mjBizAppsCollaborationSpacePageFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpacePageEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

