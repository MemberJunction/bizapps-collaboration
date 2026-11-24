import { ChangeDetectionStrategy, Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceDigestCheckpointEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Digest Checkpoints')
@Component({
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'gen-mjbizappscollaborationspacedigestcheckpoint-form',
    templateUrl: './mjbizappscollaborationspacedigestcheckpoint.form.component.html'
})
export class mjBizAppsCollaborationSpaceDigestCheckpointFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceDigestCheckpointEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}
