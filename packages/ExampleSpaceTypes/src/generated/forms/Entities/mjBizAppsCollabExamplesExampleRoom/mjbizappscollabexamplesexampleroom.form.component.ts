import { Component } from '@angular/core';
import { mjBizAppsCollabExamplesExampleRoomEntity } from '@mj-biz-apps/collaboration-example-space-types/entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration_Examples: Example Rooms') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollabexamplesexampleroom-form',
    templateUrl: './mjbizappscollabexamplesexampleroom.form.component.html'
})
export class mjBizAppsCollabExamplesExampleRoomFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollabExamplesExampleRoomEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'dealDetails', sectionName: 'Deal Details', isExpanded: true }
        ]);
    }
}

