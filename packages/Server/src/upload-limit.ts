import { SPACE_UPLOAD_MAX_BYTES } from '@mj-biz-apps/collaboration-core';

/** The largest upload this host takes: `COLLABORATION_UPLOAD_MAX_BYTES` when it is set to a positive number, else the default. */
export function configuredUploadMaxBytes(): number {
    const raw = Number(process.env.COLLABORATION_UPLOAD_MAX_BYTES);
    return Number.isFinite(raw) && raw > 0 ? raw : SPACE_UPLOAD_MAX_BYTES;
}
