import type { BaseEntity } from '@memberjunction/core';
import { detailFields, type DetailField } from '@mj-biz-apps/collaboration-core';

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
