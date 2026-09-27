import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceAgentSkillEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Agent Skills') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspaceagentskill-form',
    templateUrl: './mjbizappscollaborationspaceagentskill.form.component.html'
})
export class mjBizAppsCollaborationSpaceAgentSkillFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceAgentSkillEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

