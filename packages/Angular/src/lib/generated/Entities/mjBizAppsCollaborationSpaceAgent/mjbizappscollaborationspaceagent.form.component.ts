import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceAgentEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Agents') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspaceagent-form',
    templateUrl: './mjbizappscollaborationspaceagent.form.component.html'
})
export class mjBizAppsCollaborationSpaceAgentFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceAgentEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

