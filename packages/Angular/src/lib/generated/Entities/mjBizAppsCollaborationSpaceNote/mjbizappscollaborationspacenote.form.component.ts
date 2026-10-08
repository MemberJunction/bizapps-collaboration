import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceNoteEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Notes') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspacenote-form',
    templateUrl: './mjbizappscollaborationspacenote.form.component.html'
})
export class mjBizAppsCollaborationSpaceNoteFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceNoteEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

