/**
 * The MIME type to record for an uploaded file. A browser reports `File.type` from its own table, and leaves it empty for
 * a type it doesn't know (a `.docx` on a machine with no Office, for one), so the name's extension decides when it does.
 * `application/octet-stream` is the last resort, not the first.
 */
const BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    zip: 'application/zip',
    gz: 'application/gzip',
    tar: 'application/x-tar',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
});

/** The type the browser reported when it reported one; otherwise the extension's; otherwise `application/octet-stream`. */
export function mimeTypeForFileName(fileName: string | null | undefined, reported?: string | null): string {
    const claimed = (reported ?? '').split(';')[0].trim().toLowerCase();
    if (claimed) return claimed;
    const name = (fileName ?? '').trim().toLowerCase();
    const dot = name.lastIndexOf('.');
    const extension = dot >= 0 ? name.slice(dot + 1) : '';
    return BY_EXTENSION[extension] ?? 'application/octet-stream';
}
