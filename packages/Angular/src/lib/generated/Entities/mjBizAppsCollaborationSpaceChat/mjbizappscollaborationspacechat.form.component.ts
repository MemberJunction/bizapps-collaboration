import { Component } from '@angular/core';
import { mjBizAppsCollaborationSpaceChatEntity } from '@mj-biz-apps/collaboration-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Collaboration: Space Chats') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappscollaborationspacechat-form',
    templateUrl: './mjbizappscollaborationspacechat.form.component.html'
})
export class mjBizAppsCollaborationSpaceChatFormComponent extends BaseFormComponent {
    public record!: mjBizAppsCollaborationSpaceChatEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

