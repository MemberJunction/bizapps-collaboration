import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceKnowledgeSourceEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Knowledge Sources') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspaceknowledgesource-form',
    templateUrl: './mjbizappscollaborationspaceknowledgesource.form.component.html'
})
export class mjBizAppsCollaborationSpaceKnowledgeSourceFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceKnowledgeSourceEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

