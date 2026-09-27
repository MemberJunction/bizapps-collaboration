/**********************************************************************************
* GENERATED FILE - This file is automatically managed by the MJ CodeGen tool, 
* 
* DO NOT MODIFY THIS FILE - any changes you make will be wiped out the next time the file is
* generated
* 
**********************************************************************************/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// MemberJunction Imports
import { BaseFormsModule } from '@memberjunction/ng-base-forms';
import { EntityViewerModule } from '@memberjunction/ng-entity-viewer';
import { LinkDirectivesModule } from '@memberjunction/ng-link-directives';

// Import Generated Components
import { mjBizAppsCollaborationItemUseFormComponent } from "./Entities/mjBizAppsCollaborationItemUse/mjbizappscollaborationitemuse.form.component";
import { mjBizAppsCollaborationShareNoticeFormComponent } from "./Entities/mjBizAppsCollaborationShareNotice/mjbizappscollaborationsharenotice.form.component";
import { mjBizAppsCollaborationSpaceFormComponent } from "./Entities/mjBizAppsCollaborationSpace/mjbizappscollaborationspace.form.component";
import { mjBizAppsCollaborationSpaceItemFormComponent } from "./Entities/mjBizAppsCollaborationSpaceItem/mjbizappscollaborationspaceitem.form.component";
import { mjBizAppsCollaborationSpaceMemberFormComponent } from "./Entities/mjBizAppsCollaborationSpaceMember/mjbizappscollaborationspacemember.form.component";
import { mjBizAppsCollaborationSpaceRoleTypeFormComponent } from "./Entities/mjBizAppsCollaborationSpaceRoleType/mjbizappscollaborationspaceroletype.form.component";
import { mjBizAppsCollaborationSpaceTypeFormComponent } from "./Entities/mjBizAppsCollaborationSpaceType/mjbizappscollaborationspacetype.form.component";
   

@NgModule({
declarations: [
    mjBizAppsCollaborationItemUseFormComponent,
    mjBizAppsCollaborationSpaceFormComponent
],
imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule
],
exports: [
]
})
export class GeneratedForms_SubModule_3 { }
    


@NgModule({
declarations: [
    mjBizAppsCollaborationSpaceMemberFormComponent
],
imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule
],
exports: [
]
})
export class GeneratedForms_SubModule_9 { }
    


@NgModule({
declarations: [
    mjBizAppsCollaborationSpaceItemFormComponent
],
imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule
],
exports: [
]
})
export class GeneratedForms_SubModule_14 { }
    


@NgModule({
declarations: [
    mjBizAppsCollaborationShareNoticeFormComponent
],
imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule
],
exports: [
]
})
export class GeneratedForms_SubModule_16 { }
    


@NgModule({
declarations: [
    mjBizAppsCollaborationSpaceRoleTypeFormComponent,
    mjBizAppsCollaborationSpaceTypeFormComponent
],
imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule
],
exports: [
]
})
export class GeneratedForms_SubModule_19 { }
    


@NgModule({
declarations: [
],
imports: [
    GeneratedForms_SubModule_3,
    GeneratedForms_SubModule_9,
    GeneratedForms_SubModule_14,
    GeneratedForms_SubModule_16,
    GeneratedForms_SubModule_19
]
})
export class GeneratedFormsModule { }
    
// Note: LoadXXXGeneratedForms() functions have been removed. Tree-shaking prevention
// is now handled by the pre-built class registration manifest system.
// See packages/CodeGenLib/CLASS_MANIFEST_GUIDE.md for details.
    