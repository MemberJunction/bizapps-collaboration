import { ChangeDetectionStrategy, Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceNoticeWatermarkEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Notice Watermarks')
@Component({
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'gen-mjbizappscollaborationspacenoticewatermark-form',
    templateUrl: './mjbizappscollaborationspacenoticewatermark.form.component.html'
})
export class mjBizAppsCollaborationSpaceNoticeWatermarkFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceNoticeWatermarkEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}
