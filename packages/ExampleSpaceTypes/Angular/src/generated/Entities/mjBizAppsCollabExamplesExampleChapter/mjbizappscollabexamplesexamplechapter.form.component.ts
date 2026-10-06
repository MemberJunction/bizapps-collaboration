import { Component } from '@angular/core';
import { mjBizAppsCollabExamplesExampleChapterEntity } from '@mj-biz-apps/collaboration-example-space-types-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration_Examples: Example Chapters') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollabexamplesexamplechapter-form',
    templateUrl: './mjbizappscollabexamplesexamplechapter.form.component.html'
})
export class mjBizAppsCollabExamplesExampleChapterFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollabExamplesExampleChapterEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsCollaborationExamplesExampleChapterMembers', sectionName: 'Example Chapter Members', isExpanded: false }
        ]);
    }
}

