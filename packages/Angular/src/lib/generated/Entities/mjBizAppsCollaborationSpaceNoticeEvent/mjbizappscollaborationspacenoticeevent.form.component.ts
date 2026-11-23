import { ChangeDetectionStrategy, Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceNoticeEventEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Notice Events')
@Component({
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'gen-mjbizappscollaborationspacenoticeevent-form',
    templateUrl: './mjbizappscollaborationspacenoticeevent.form.component.html'
})
export class mjBizAppsCollaborationSpaceNoticeEventFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceNoticeEventEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}
