import { crc32, gzipSync } from 'node:zlib';
import { CompositeKey, RunView, type BaseEntity, type IMetadataProvider, type UserInfo } from '@memberjunction/core';

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

/**
 * Builds an uncompressed (STORE, method 0) ZIP archive buffer from an array of file entries.
 */
export function makeZip(entries: ReadonlyArray<{ name: string; data: Buffer }>): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;
    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, 'utf8');
        const crc = crc32(entry.data) >>> 0;
        const size = entry.data.length;

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(0, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(size, 18);
        localHeader.writeUInt32LE(size, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);
        localParts.push(localHeader, nameBuf, entry.data);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(0, 12);
        centralHeader.writeUInt16LE(0, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(size, 20);
        centralHeader.writeUInt32LE(size, 24);
        centralHeader.writeUInt16LE(nameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);
        centralParts.push(centralHeader, nameBuf);

        offset += 30 + nameBuf.length + size;
    }
    const centralDir = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralDir.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...localParts, centralDir, eocd]);
}

function escapeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Builds a valid minimal `.docx` OpenXML Word document containing `text`.
 */
export function makeDocx(text: string): Buffer {
    return makeZip([
        {
            name: '[Content_Types].xml',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                    '<Default Extension="xml" ContentType="application/xml"/>' +
                    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
                    '</Types>',
            ),
        },
        {
            name: '_rels/.rels',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
                    '</Relationships>',
            ),
        },
        {
            name: 'word/document.xml',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
                    `<w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body>` +
                    '</w:document>',
            ),
        },
    ]);
}

/**
 * Builds a valid minimal `.xlsx` OpenXML workbook containing `text` on `Sheet1`.
 */
export function makeXlsx(text: string): Buffer {
    return makeZip([
        {
            name: '[Content_Types].xml',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                    '<Default Extension="xml" ContentType="application/xml"/>' +
                    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
                    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
                    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
                    '</Types>',
            ),
        },
        {
            name: '_rels/.rels',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
                    '</Relationships>',
            ),
        },
        {
            name: 'xl/workbook.xml',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
                    '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>' +
                    '</workbook>',
            ),
        },
        {
            name: 'xl/_rels/workbook.xml.rels',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
                    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
                    '</Relationships>',
            ),
        },
        {
            name: 'xl/sharedStrings.xml',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1">' +
                    `<si><t>${escapeXml(text)}</t></si>` +
                    '</sst>',
            ),
        },
        {
            name: 'xl/worksheets/sheet1.xml',
            data: Buffer.from(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
                    '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData>' +
                    '</worksheet>',
            ),
        },
    ]);
}

/**
 * Builds a valid `.gz` compressed buffer containing `text`.
 */
export function makeGzip(text: string): Buffer {
    return gzipSync(Buffer.from(text, 'utf8'));
}

/**
 * Polls `MJ: Content Items` and `MJ: Content Item Chunks` for an uploaded Space Item until its
 * extraction (and segmentation when text is extracted) finishes, up to `timeoutMs`.
 */
export async function waitForSpaceItemPipeline(
    provider: IMetadataProvider,
    user: UserInfo,
    spaceItemId: string,
    timeoutMs = 30000,
): Promise<{
    contentItemId: string;
    extractionStatus: string;
    segmentationStatus: string;
    chunks: Array<{ ID: string; Text: string; ContentItemID: string }>;
}> {
    const rv = RunView.FromMetadataProvider(provider);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const erdRes = await rv.RunView<{ ID: string }>(
            {
                EntityName: 'MJ: Entity Record Documents',
                ExtraFilter: `RecordID = 'ID|${spaceItemId}' OR RecordID = '${spaceItemId}'`,
                Fields: ['ID'],
                ResultType: 'simple',
                BypassCache: true,
            },
            user,
        );
        const erdId = erdRes.Success ? erdRes.Results?.[0]?.ID : undefined;
        if (erdId) {
            const ciRes = await rv.RunView<{
                ID: string;
                ExtractionStatus: string;
                SegmentationStatus: string;
            }>(
                {
                    EntityName: 'MJ: Content Items',
                    ExtraFilter: `EntityRecordDocumentID = '${erdId}' AND DeleteStatus IS NULL`,
                    Fields: ['ID', 'ExtractionStatus', 'SegmentationStatus'],
                    ResultType: 'simple',
                    BypassCache: true,
                },
                user,
            );
            const root = ciRes.Success ? ciRes.Results?.[0] : undefined;
            if (root && root.ExtractionStatus != null && root.ExtractionStatus !== 'Pending') {
                if (
                    root.ExtractionStatus !== 'Complete' ||
                    (root.SegmentationStatus != null && root.SegmentationStatus !== 'Pending')
                ) {
                    const allItemsRes = await rv.RunView<{
                        ID: string;
                        ExtractionStatus: string | null;
                        SegmentationStatus: string | null;
                    }>(
                        {
                            EntityName: 'MJ: Content Items',
                            ExtraFilter: `(ID = '${root.ID}' OR RootParentID = '${root.ID}' OR ParentID = '${root.ID}') AND DeleteStatus IS NULL`,
                            Fields: ['ID', 'ExtractionStatus', 'SegmentationStatus'],
                            ResultType: 'simple',
                            BypassCache: true,
                        },
                        user,
                    );
                    const allItems = allItemsRes.Success ? allItemsRes.Results ?? [] : [root];
                    const anyPending = allItems.some(
                        (item) =>
                            item.ExtractionStatus == null ||
                            item.ExtractionStatus === 'Pending' ||
                            (item.ExtractionStatus === 'Complete' &&
                                (item.SegmentationStatus == null || item.SegmentationStatus === 'Pending')),
                    );
                    if (!anyPending) {
                        const inIds = allItems.map((i) => `'${i.ID}'`).join(', ');
                        const chunksRes = await rv.RunView<{ ID: string; Text: string; ContentItemID: string }>(
                            {
                                EntityName: 'MJ: Content Item Chunks',
                                ExtraFilter: `ContentItemID IN (${inIds}) AND DeleteStatus IS NULL`,
                                Fields: ['ID', 'Text', 'ContentItemID'],
                                OrderBy: 'Sequence ASC',
                                ResultType: 'simple',
                                BypassCache: true,
                            },
                            user,
                        );
                        const chunks = chunksRes.Success ? chunksRes.Results ?? [] : [];
                        return {
                            contentItemId: root.ID,
                            extractionStatus: root.ExtractionStatus,
                            segmentationStatus: root.SegmentationStatus,
                            chunks,
                        };
                    }
                }
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Timed out waiting for Content Pipeline on Space Item ${spaceItemId} after ${timeoutMs}ms`);
}

/**
 * Hard-deletes any remaining test-created `MJ: Content Items` (tombstones and children),
 * `MJ: Content Item Tags`, `MJ: Content Item Attributes`, and `MJ: Entity Record Documents`
 * associated with the given Space Item IDs after a check completes.
 */
export async function purgeTestSpaceItemPipelineRows(
    provider: IMetadataProvider,
    user: UserInfo,
    spaceItemIds: readonly string[],
): Promise<void> {
    if (spaceItemIds.length === 0) return;
    const rv = RunView.FromMetadataProvider(provider);
    const clauses = spaceItemIds.flatMap((id) => [`RecordID = 'ID|${id}'`, `RecordID = '${id}'`]).join(' OR ');
    const erdRes = await rv.RunView<{ ID: string }>(
        {
            EntityName: 'MJ: Entity Record Documents',
            ExtraFilter: clauses,
            Fields: ['ID'],
            ResultType: 'simple',
            BypassCache: true,
        },
        user,
    );
    const erdIds = (erdRes.Success ? erdRes.Results ?? [] : []).map((r) => r.ID);
    if (erdIds.length === 0) return;

    const erdIn = erdIds.map((id) => `'${id}'`).join(', ');
    const rootItemsRes = await rv.RunView<{ ID: string }>(
        {
            EntityName: 'MJ: Content Items',
            ExtraFilter: `EntityRecordDocumentID IN (${erdIn})`,
            Fields: ['ID'],
            ResultType: 'simple',
            BypassCache: true,
        },
        user,
    );
    const rootIds = (rootItemsRes.Success ? rootItemsRes.Results ?? [] : []).map((r) => r.ID);
    if (rootIds.length > 0) {
        const rootIn = rootIds.map((id) => `'${id}'`).join(', ');
        const allItemsRes = await rv.RunView<{ ID: string; ParentID: string | null }>(
            {
                EntityName: 'MJ: Content Items',
                ExtraFilter: `ID IN (${rootIn}) OR RootParentID IN (${rootIn}) OR ParentID IN (${rootIn})`,
                Fields: ['ID', 'ParentID'],
                ResultType: 'simple',
                BypassCache: true,
            },
            user,
        );
        const allItems = allItemsRes.Success ? allItemsRes.Results ?? [] : [];
        const allIds = allItems.map((i) => i.ID);
        if (allIds.length > 0) {
            const allIn = allIds.map((id) => `'${id}'`).join(', ');
            const depSpecs: Array<{ entityName: string; fkColumn: string }> = [
                { entityName: 'MJ: Content Item Chunks', fkColumn: 'ContentItemID' },
                { entityName: 'MJ: Content Item Tags', fkColumn: 'ItemID' },
                { entityName: 'MJ: Content Item Attributes', fkColumn: 'ContentItemID' },
            ];
            for (const dep of depSpecs) {
                const depRes = await rv.RunView<{ ID: string }>(
                    {
                        EntityName: dep.entityName,
                        ExtraFilter: `${dep.fkColumn} IN (${allIn})`,
                        Fields: ['ID'],
                        ResultType: 'simple',
                        BypassCache: true,
                    },
                    user,
                );
                for (const row of depRes.Success ? depRes.Results ?? [] : []) {
                    const ent = await provider.GetEntityObject<BaseEntity>(dep.entityName, user);
                    if (await ent.InnerLoad(CompositeKey.FromID(row.ID))) {
                        await ent.Delete();
                    }
                }
            }
            const children = allItems.filter((i) => !!i.ParentID);
            const roots = allItems.filter((i) => !i.ParentID);
            for (const item of [...children, ...roots]) {
                const ent = await provider.GetEntityObject<BaseEntity>('MJ: Content Items', user);
                if (await ent.InnerLoad(CompositeKey.FromID(item.ID))) {
                    ent.Set('FileID', null);
                    await ent.Delete();
                }
            }
        }
    }

    for (const erdId of erdIds) {
        const ent = await provider.GetEntityObject<BaseEntity>('MJ: Entity Record Documents', user);
        if (await ent.InnerLoad(CompositeKey.FromID(erdId))) {
            await ent.Delete();
        }
    }
}
