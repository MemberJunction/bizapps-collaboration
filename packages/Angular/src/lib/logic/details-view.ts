import type { Type } from '@angular/core';
import { visibleDetailFields, type DetailField } from '@mj-biz-apps/collaboration-core';
import type { SpaceDetailsFormDescriptor } from '@mj-biz-apps/collaboration-ng-widgets';

/** How a space's details are drawn. */
export type DetailsPresentation = 'form' | 'component' | 'fields';

/** What a screen needs to draw a space's details: how, with which columns when it is a field list, and with which component when the driver gave one. */
export interface DetailsViewModel {
    presentation: DetailsPresentation;
    /** The columns of the field list, after the driver's form has left some out. Empty for a form or a component. */
    fields: DetailField[];
    /** The driver's own component, when it gave one. */
    component: Type<unknown> | null;
    /** For a form: the sections of it that hold only the subtype's columns, the only ones shown. */
    formSections: string[];
}

/**
 * Decides how the details of a subtype are drawn, or that there is nothing to draw (null). The UI driver's descriptor comes first:
 * none means no details; a component of its own is used as it is. Otherwise a subtype that has a registered form shows that form,
 * and one that has none shows a field for each column it adds, less the ones the driver hides (a required column is never hidden).
 * `hasForm` is asked only when the driver did not decide.
 *
 * A subtype's form lays out every column of its view, the space's own included, so the form is used only when `formSections` names
 * the sections that hold nothing but the subtype's columns (null when there are none): the form then shows those sections alone.
 * When there are none, the field list is drawn even where a form is registered.
 */
export async function planDetailsView(input: {
    fields: readonly DetailField[];
    formSections: readonly string[] | null;
    descriptor: SpaceDetailsFormDescriptor | undefined;
    hasForm: () => Promise<boolean>;
}): Promise<DetailsViewModel | null> {
    const { descriptor } = input;
    if (!descriptor) return null;
    if (descriptor.component) return { presentation: 'component', fields: [], component: descriptor.component, formSections: [] };
    if (input.formSections && input.formSections.length > 0 && (await input.hasForm())) {
        return { presentation: 'form', fields: [], component: null, formSections: [...input.formSections] };
    }
    const fields = visibleDetailFields(input.fields, descriptor.hiddenFieldNames);
    return fields.length > 0 ? { presentation: 'fields', fields, component: null, formSections: [] } : null;
}
