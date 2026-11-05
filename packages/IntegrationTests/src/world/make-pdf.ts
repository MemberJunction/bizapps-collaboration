// Shared by the world's seed files and the content-pipeline checks.

/**
 * Builds a valid single-page PDF buffer containing `text`.
 * Includes a >= 32KB comment block inside object 6 so Node v24's 64KB Buffer slab pool
 * is bypassed when pdf-parse's LoopbackPort clones the buffer via `new Buffer(value)`.
 */
export function makePdf(text: string): Buffer {
    const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const streamContent = `BT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET`;
    const padComment = `%${'P'.repeat(33000)}\n`;
    const objects = [
        `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
        `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
        `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'latin1')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
        `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
        `6 0 obj\n<< /Title (Space Document) >>\n${padComment}endobj\n`,
    ];
    let body = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(body, 'latin1'));
        body += obj;
    }
    const xrefOffset = Buffer.byteLength(body, 'latin1');
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
        xref += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return Buffer.from(body + xref + trailer, 'latin1');
}
