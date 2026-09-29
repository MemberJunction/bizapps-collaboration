import { LogError } from '@memberjunction/core';
import { SPACE_UPLOAD_MAX_BYTES } from '@mj-biz-apps/collaboration-core';

/** The largest number GraphQL's `Int` carries: the limit is sent to the browser as an `Int`, so a larger one would break the field. */
const GRAPHQL_INT_MAX = 2_147_483_647;

/**
 * The largest upload this host takes: `COLLABORATION_UPLOAD_MAX_BYTES` when it is a whole number from 1 to 2,147,483,647, else the
 * default. A value that is set and refused is logged, so a typo doesn't quietly fall back.
 */
export function configuredUploadMaxBytes(): number {
    const setting = process.env.COLLABORATION_UPLOAD_MAX_BYTES;
    if (setting === undefined || setting.trim() === '') return SPACE_UPLOAD_MAX_BYTES;
    const raw = Number(setting);
    if (Number.isInteger(raw) && raw >= 1 && raw <= GRAPHQL_INT_MAX) return raw;
    LogError(`COLLABORATION_UPLOAD_MAX_BYTES is '${setting}', which is not a whole number of bytes from 1 to ${GRAPHQL_INT_MAX}; the default of ${SPACE_UPLOAD_MAX_BYTES} is used.`);
    return SPACE_UPLOAD_MAX_BYTES;
}
