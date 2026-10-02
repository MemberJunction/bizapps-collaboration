import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceMemberPinEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Member Pins') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspacememberpin-form',
    templateUrl: './mjbizappscollaborationspacememberpin.form.component.html'
})
export class mjBizAppsCollaborationSpaceMemberPinFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceMemberPinEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

