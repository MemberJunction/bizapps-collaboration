import { Component } from '@angular/core';
import { mjBizAppsCollaborationItemUseEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Item Uses') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationitemuse-form',
    templateUrl: './mjbizappscollaborationitemuse.form.component.html'
})
export class mjBizAppsCollaborationItemUseFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationItemUseEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

