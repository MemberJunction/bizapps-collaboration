/**
 * Shared helper for validating and applying subtype-specific detail columns onto an IsA child entity
 * without `BaseEntity.Set()` or `any`/`unknown` casts.
 */
import { type BaseEntity, EntityFieldTSType } from '@memberjunction/core';
import type { SpaceDetailsMap, SpaceDetailValue } from '@mj-biz-apps/collaboration-core';
import { ownDetailFields } from '@mj-biz-apps/collaboration-entities';

function coerceDetailFieldValue(leaf: BaseEntity, name: string, value: SpaceDetailValue): SpaceDetailValue {
    const field = leaf.EntityInfo.Fields.find((f) => f.Name === name);
    if (field?.TSType === EntityFieldTSType.Date && typeof value === 'string') {
        return new Date(value);
    }
    return value;
}

/**
 * Validates that every key in `details` belongs to the subtype's own columns (never base Space columns,
 * primary keys, or unknown names) and assigns each value via the generated entity property setter.
 * Returns a human-readable refusal reason or `null` when valid.
 */
export function applySubtypeDetails(
    leaf: BaseEntity,
    attachedChild: BaseEntity | null,
    spaceTypeName: string,
    details: SpaceDetailsMap | null | undefined,
): string | null {
    if (!details) {
        return null;
    }
    const entries = Object.entries(details);
    if (entries.length === 0) {
        return null;
    }
    const allowed = new Set(attachedChild ? ownDetailFields(attachedChild).map((f) => f.name) : []);
    for (const [fieldName, value] of entries) {
        if (!allowed.has(fieldName)) {
            return `${fieldName} is not a detail of a ${spaceTypeName} space.`;
        }
        const coerced = coerceDetailFieldValue(leaf, fieldName, value);
        Reflect.set(leaf, fieldName, coerced);
    }
    return null;
}

export interface ParseSpaceDetailsResult {
    ok: boolean;
    details?: SpaceDetailsMap | null;
    message?: string;
}

/**
 * Parses a GraphQL JSON `Details` string into a strongly-typed `SpaceDetailsMap` without `any` or `unknown`.
 */
export function parseSpaceDetailsJson(raw: string | null | undefined): ParseSpaceDetailsResult {
    if (!raw || !raw.trim()) {
        return { ok: true, details: null };
    }
    try {
        const parsed: object | string | number | boolean | null = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return { ok: false, message: 'The details must be a JSON object of field names and values.' };
        }
        const details: SpaceDetailsMap = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (
                value === null ||
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean'
            ) {
                details[key] = value;
            } else {
                return { ok: false, message: `Detail field "${key}" must be a string, number, boolean, or null.` };
            }
        }
        return { ok: true, details };
    } catch {
        return { ok: false, message: 'The details must be a JSON object of field names and values.' };
    }
}
