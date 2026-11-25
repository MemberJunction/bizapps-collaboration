/**
 * SPDX-License-Identifier: BUSL-1.1
 *
 * Pure helpers for resolving `MJ: Artifacts` targets across Collaboration pins,
 * overview/library items, and durable chat record links.
 */
import type { FileKind } from '@mj-biz-apps/collaboration-ng-widgets';

export const ARTIFACTS_ENTITY_NAME = 'MJ: Artifacts';

/** Returns true when an entity name refers to `MJ: Artifacts` (case- and whitespace-insensitive). */
export function isArtifactEntityName(entityName: string | null | undefined): boolean {
    return (entityName ?? '').trim().toLowerCase() === ARTIFACTS_ENTITY_NAME.toLowerCase();
}

/** Splits a `PinModel.target` (`<kind>:<id>`) cleanly into kind and id. */
export function parsePinTarget(target: string | null | undefined): { kind: string; id: string } {
    const raw = (target ?? '').trim();
    const colon = raw.indexOf(':');
    if (colon < 0) return { kind: raw, id: '' };
    return { kind: raw.slice(0, colon), id: raw.slice(colon + 1) };
}

/** Maps an Artifact's type name and title to a Collaboration `FileKind` icon category. */
export function detectArtifactFileKind(name: string, artifactType?: string | null): FileKind {
    const lowerType = (artifactType ?? '').trim().toLowerCase();
    const lowerName = (name ?? '').trim().toLowerCase();
    if (lowerType.includes('presentation') || lowerType.includes('slide') || lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')) {
        return 'ppt';
    }
    if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) {
        return 'pdf';
    }
    if (lowerType.includes('spreadsheet') || lowerType.includes('excel') || lowerType.includes('csv') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
        return 'xls';
    }
    if (lowerType.includes('image') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.svg')) {
        return 'img';
    }
    return 'doc';
}

/** Returns a FontAwesome icon class suited to an Artifact's type/name for pin strips and Home lists. */
export function artifactIconClass(artifactType?: string | null, name?: string | null): string {
    const kind = detectArtifactFileKind(name ?? '', artifactType);
    switch (kind) {
        case 'ppt':
            return 'fa-solid fa-file-powerpoint';
        case 'pdf':
            return 'fa-solid fa-file-pdf';
        case 'xls':
            return 'fa-solid fa-file-excel';
        case 'img':
            return 'fa-solid fa-file-image';
        default:
            return 'fa-solid fa-file-lines';
    }
}

/** Extracts the Artifact `ID` from a chat durable record link targeting `MJ: Artifacts`, or returns `null`. */
export function extractArtifactIdFromRecordLink(link: {
    entityName: string;
    keys: Readonly<Record<string, string | number>>;
}): string | null {
    if (!isArtifactEntityName(link.entityName)) return null;
    const raw = link.keys['ID'] ?? link.keys['id'];
    if (raw == null) return null;
    const trimmed = String(raw).trim();
    return trimmed.length > 0 ? trimmed : null;
}
