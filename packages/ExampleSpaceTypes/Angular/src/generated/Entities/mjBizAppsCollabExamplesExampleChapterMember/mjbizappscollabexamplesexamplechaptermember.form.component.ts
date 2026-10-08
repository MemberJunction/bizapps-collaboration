import { Component } from '@angular/core';
import { mjBizAppsCollabExamplesExampleChapterMemberEntity } from '@mj-biz-apps/collaboration-example-space-types-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration_Examples: Example Chapter Members') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollabexamplesexamplechaptermember-form',
    templateUrl: './mjbizappscollabexamplesexamplechaptermember.form.component.html'
})
export class mjBizAppsCollabExamplesExampleChapterMemberFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollabExamplesExampleChapterMemberEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

