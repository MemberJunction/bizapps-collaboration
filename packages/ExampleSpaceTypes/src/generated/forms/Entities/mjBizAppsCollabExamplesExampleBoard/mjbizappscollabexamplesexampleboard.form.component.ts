import { Component } from '@angular/core';
import { mjBizAppsCollabExamplesExampleBoardEntity } from '@mj-biz-apps/collaboration-example-space-types/entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration_Examples: Example Boards') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollabexamplesexampleboard-form',
    templateUrl: './mjbizappscollabexamplesexampleboard.form.component.html'
})
export class mjBizAppsCollabExamplesExampleBoardFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollabExamplesExampleBoardEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'boardDetails', sectionName: 'Board Details', isExpanded: true },
            { sectionKey: 'nextMeeting', sectionName: 'Next Meeting', isExpanded: true }
        ]);
    }
}

