import type { BaseEntity } from '@memberjunction/core';
import { detailFields, subtypeFormSections, type DetailField } from '@mj-biz-apps/collaboration-core';

/** The subtype's own detail fields, read from the entity object's metadata. */
export function ownDetailFields(leaf: BaseEntity): DetailField[] {
    return detailFields(
        leaf.EntityInfo.Fields.map((f) => ({
            Name: f.Name,
            DisplayName: f.DisplayNameOrName,
            IsPrimaryKey: f.IsPrimaryKey,
            IsVirtual: f.IsVirtual,
            AllowUpdateAPI: f.AllowUpdateAPI,
            AllowsNull: f.AllowsNull,
            DefaultValue: f.DefaultValue ?? null,
            Sequence: f.Sequence,
        })),
        leaf.EntityInfo.ParentEntityFieldNames,
    );
}

/**
 * The sections of the subtype's generated form that hold only the columns it adds (see `subtypeFormSections`), or null when the form
 * can't be shown without the space's own columns.
 */
export function ownFormSections(leaf: BaseEntity, hiddenFieldNames?: readonly string[]): string[] | null {
    const ownFields = ownDetailFields(leaf);
    const own = new Set(ownFields.map((f) => f.name));
    // A required column is never hidden, as `visibleDetailFields` keeps it
    const required = new Set(ownFields.filter((f) => f.required).map((f) => f.name.toLowerCase()));
    const hidden = new Set((hiddenFieldNames ?? []).map((n) => n.toLowerCase()).filter((n) => !required.has(n)));
    return subtypeFormSections(
        leaf.EntityInfo.Fields.map((f) => ({
            Name: f.Name,
            IsPrimaryKey: f.IsPrimaryKey,
            Category: f.Category ?? null,
            GeneratedFormSection: f.GeneratedFormSection,
            IncludeInGeneratedForm: f.IncludeInGeneratedForm,
        })),
        own,
        hidden,
    );
}
