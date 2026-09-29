import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, type Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { BaseEntity } from '@memberjunction/core';
import { BaseFormsModule, type EntityFormConfig } from '@memberjunction/ng-base-forms';
import type { DetailField } from '@mj-biz-apps/collaboration-core';
import type { DetailsPresentation } from './logic/details-view.js';

/** A subtype's form, in the page and not in a page of its own: no toolbar (the screen owns Save and Cancel), no related entities, no record links. */
export const DETAILS_FORM_CONFIG: EntityFormConfig = {
    Toolbar: null,
    ShowRelatedEntities: false,
    CollapsibleSections: false,
    EnableRecordLinks: false,
    WidthMode: 'full-width',
};

/**
 * Draws the details a space keeps in its subtype, on the New space dialog, in Settings and on the Overview. One place decides how:
 * a component the type's UI driver gave, else the form MemberJunction has for the subtype (the form host), else a field for each
 * column. The fields and the form edit `Record` directly; a change is announced as `Changed`, from what the person typed (`input`,
 * `change`, `focusout`) and from a field's own change event.
 */
@Component({
    selector: 'mjc-space-details-view',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <div class="details-view" (input)="Changed.emit()" (change)="Changed.emit()" (focusout)="Changed.emit()">
            @switch (Presentation) {
                @case ('component') {
                    @if (Component) {
                        <ng-container *ngComponentOutlet="Component; inputs: { Record: Record, EditMode: EditMode }"></ng-container>
                    }
                }
                @case ('form') {
                    <mj-entity-form-host [Record]="Record" [Config]="FormConfig" [EditMode]="EditMode"></mj-entity-form-host>
                }
                @default {
                    <div class="fields">
                        @for (field of Fields; track field.name) {
                            <mj-form-field [Record]="Record" [FieldName]="field.name" [EditMode]="EditMode" (ValueChange)="Changed.emit()"></mj-form-field>
                        }
                    </div>
                }
            }
        </div>
    `,
    styles: [`
        :host { display: block; }
        .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    `],
})
export class SpaceDetailsViewComponent {
    /** The subtype's record: the space's own record with its subtype attached, or the subtype loaded through the space. */
    @Input() public Record!: BaseEntity;
    @Input() public Presentation: DetailsPresentation = 'fields';
    /** The columns to draw when there is no form or component. */
    @Input() public Fields: readonly DetailField[] = [];
    @Input() public Component: Type<unknown> | null = null;
    @Input() public EditMode = false;
    /**
     * For a form: the sections that hold only the subtype's columns. The form lays out the space's columns too, so it shows these
     * alone. Setting them makes the form's config, which stays the same object until they are set again, so the form host isn't
     * handed a new one on every pass.
     */
    @Input()
    public set FormSections(sections: readonly string[]) {
        this._formSections = sections;
        this.FormConfig = { ...DETAILS_FORM_CONFIG, VisibleSectionKeys: [...sections] };
    }
    public get FormSections(): readonly string[] {
        return this._formSections;
    }
    private _formSections: readonly string[] = [];

    /** The config the form host is given. */
    public FormConfig: EntityFormConfig = DETAILS_FORM_CONFIG;

    @Output() public Changed = new EventEmitter<void>();
}
