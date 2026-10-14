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
import { mjBizAppsCollabExamplesExampleBoardFormComponent } from "./Entities/mjBizAppsCollabExamplesExampleBoard/mjbizappscollabexamplesexampleboard.form.component";
import { mjBizAppsCollabExamplesExampleChapterFormComponent } from "./Entities/mjBizAppsCollabExamplesExampleChapter/mjbizappscollabexamplesexamplechapter.form.component";
import { mjBizAppsCollabExamplesExampleChapterMemberFormComponent } from "./Entities/mjBizAppsCollabExamplesExampleChapterMember/mjbizappscollabexamplesexamplechaptermember.form.component";
   

@NgModule({
declarations: [
    mjBizAppsCollabExamplesExampleChapterFormComponent
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
export class GeneratedForms_SubModule_15 { }
    


@NgModule({
declarations: [
    mjBizAppsCollabExamplesExampleBoardFormComponent
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
    mjBizAppsCollabExamplesExampleChapterMemberFormComponent
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
export class GeneratedForms_SubModule_21 { }
    


@NgModule({
declarations: [
],
imports: [
    GeneratedForms_SubModule_15,
    GeneratedForms_SubModule_16,
    GeneratedForms_SubModule_21
]
})
export class GeneratedFormsModule { }
    
// Note: LoadXXXGeneratedForms() functions have been removed. Tree-shaking prevention
// is now handled by the pre-built class registration manifest system.
// See packages/CodeGenLib/CLASS_MANIFEST_GUIDE.md for details.
    