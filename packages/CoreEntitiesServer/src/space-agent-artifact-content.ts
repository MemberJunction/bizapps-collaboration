import { inflateSync } from 'node:zlib';
import { UUIDsEqual } from '@memberjunction/global';
import type { Band, BoundActionPromptCatalogItem } from '@mj-biz-apps/collaboration-core';
import { COLLABORATION_DEFAULT_AGENT_NAME } from './resolve-allowed-agents.js';
import { estimateTokenCount } from './space-agent-retrieval-ranking.js';
import type { SpaceAgentCandidateItem } from './space-agent-retrieval.js';
import type { GrantedKnowledgeScopeSearchHit } from './turn-knowledge-scopes.js';
import type { TurnSpaceDataGrant } from './turn-tools.js';

/** Shipped `Collaboration Space Agent` ID from `metadata/agents/.collaboration-agent.json`. */
export const SHIPPED_COLLABORATION_AGENT_ID = '9E6D761A-197A-40AF-995B-3D3DD9BD7B9E';

/** Target soft character cap per extracted artifact chunk so query prioritization and token budgeting stay granular. */
const MAX_EXTRACTED_CHUNK_CHARS = 800;
/** Hard cap on extracted chunks per artifact version to prevent pathological allocations on huge payloads. */
const MAX_EXTRACTED_CHUNKS_PER_ARTIFACT = 40;
/** Default aggregate token ceiling for the injected Authorized Space Context system message. */
export const DEFAULT_SPACE_CONTEXT_SYSTEM_MESSAGE_MAX_TOKENS = 7500;
const CHARS_PER_TOKEN = 4;

const PDF_DATA_URI_PREFIX = /^data:application\/pdf(?:;[^,]*)?;base64,/i;
const ANY_BASE64_DATA_URI_PREFIX = /^data:[^,]*;base64,/i;

interface SlideMasterLike {
    HeaderText?: string | null;
    FooterText?: string | null;
    OrganizationName?: string | null;
}

interface SlideRegionLike {
    Label?: string | null;
    Kind?: string | null;
    BigNumberValue?: string | number | null;
    BigNumberLabel?: string | null;
    BigNumberDelta?: string | null;
    MarkdownContent?: string | null;
    QuoteAttribution?: string | null;
    Text?: string | null;
    Body?: string | null;
    Bullets?: readonly (string | null | undefined)[] | null;
    Items?: readonly (string | null | undefined)[] | null;
    Metrics?: readonly ({ Label?: string | null; Value?: string | number | null; Delta?: string | null } | null | undefined)[] | null;
}

interface SlideSpecLike {
    SlideNumber?: number | null;
    Title?: string | null;
    Subtitle?: string | null;
    Regions?: readonly (SlideRegionLike | null | undefined)[] | null;
    SpeakerNotes?: string | null;
}

interface SlideDeckSpecLike {
    SchemaVersion?: string | null;
    Title?: string | null;
    Subtitle?: string | null;
    Master?: SlideMasterLike | null;
    Slides?: readonly (SlideSpecLike | null | undefined)[] | null;
}

export interface SpaceAgentContextMessageParams {
    audience: Band;
    typeInstructions?: readonly string[];
    allowedItems?: readonly SpaceAgentCandidateItem[];
    grantedKnowledgeHits?: readonly GrantedKnowledgeScopeSearchHit[];
    spaceData?: readonly TurnSpaceDataGrant[];
    boundActions?: readonly BoundActionPromptCatalogItem[];
    maxTokens?: number;
}

/**
 * Returns true when the resolved agent is the shipped `Collaboration Space Agent` whose own
 * Nunjucks prompt template already renders `allowedItems`, `grantedKnowledgeHits`, `spaceData`,
 * and `typeInstructions`. Non-default agents (such as platform `Sage` or other general agents)
 * return false and receive the injected Authorized Space Context system message.
 */
export function isShippedCollaborationSpaceAgent(
    agentName: string | null | undefined,
    agentId: string | null | undefined,
): boolean {
    const normalizedName = (agentName ?? '').trim().toLowerCase();
    if (normalizedName === COLLABORATION_DEFAULT_AGENT_NAME.toLowerCase()) {
        return true;
    }
    const cleanId = (agentId ?? '').trim();
    if (cleanId && UUIDsEqual(cleanId, SHIPPED_COLLABORATION_AGENT_ID)) {
        return true;
    }
    return false;
}

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function cleanMarkdownSnippet(raw: string): string {
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, ' ').replace(/```/g, ' '))
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '• ')
        .replace(/^\s*>\s?/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitLongTextIntoChunks(text: string, maxChars: number = MAX_EXTRACTED_CHUNK_CHARS): string[] {
    const clean = normalizeWhitespace(text);
    if (!clean) return [];
    if (clean.length <= maxChars) return [clean];

    const out: string[] = [];
    let cursor = 0;
    while (cursor < clean.length && out.length < MAX_EXTRACTED_CHUNKS_PER_ARTIFACT) {
        if (clean.length - cursor <= maxChars) {
            const tail = clean.slice(cursor).trim();
            if (tail) out.push(tail);
            break;
        }
        const window = clean.slice(cursor, cursor + maxChars);
        let splitAt = Math.max(window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(' | '));
        if (splitAt < Math.floor(maxChars * 0.4)) {
            splitAt = window.lastIndexOf(' ');
        }
        if (splitAt <= 0) {
            splitAt = maxChars;
        } else {
            splitAt += 1;
        }
        const piece = clean.slice(cursor, cursor + splitAt).trim();
        if (piece) out.push(piece);
        cursor += splitAt;
        while (cursor < clean.length && clean[cursor] === ' ') cursor++;
    }
    return out;
}

function unescapePdfLiteral(raw: string): string {
    let out = '';
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch !== '\\') {
            out += ch;
            continue;
        }
        if (i + 1 >= raw.length) break;
        const next = raw[++i];
        if (next === '\r') {
            if (raw[i + 1] === '\n') i++;
            continue;
        }
        if (next === '\n') {
            continue;
        }
        switch (next) {
            case 'n':
                out += '\n';
                break;
            case 'r':
                out += '\r';
                break;
            case 't':
                out += '\t';
                break;
            case 'b':
                out += '\b';
                break;
            case 'f':
                out += '\f';
                break;
            case '(':
            case ')':
            case '\\':
                out += next;
                break;
            default: {
                if (next >= '0' && next <= '7') {
                    let octal = next;
                    for (let k = 0; k < 2 && i + 1 < raw.length; k++) {
                        const digit = raw[i + 1];
                        if (digit >= '0' && digit <= '7') {
                            octal += digit;
                            i++;
                        } else {
                            break;
                        }
                    }
                    const code = parseInt(octal, 8);
                    if (code >= 0x20 && code <= 0x7e) {
                        out += String.fromCharCode(code);
                    } else if (code === 0x09 || code === 0x0a || code === 0x0d) {
                        out += ' ';
                    }
                } else {
                    out += next;
                }
                break;
            }
        }
    }
    return out;
}

function readPdfLiteralString(source: string, openParenIdx: number): { value: string; endIdx: number } | null {
    if (source[openParenIdx] !== '(') return null;
    let depth = 1;
    let i = openParenIdx + 1;
    let raw = '';
    while (i < source.length && depth > 0) {
        const ch = source[i];
        if (ch === '\\') {
            if (i + 1 < source.length) {
                raw += ch + source[i + 1];
                i += 2;
                continue;
            }
            break;
        }
        if (ch === '(') {
            depth++;
            raw += ch;
        } else if (ch === ')') {
            depth--;
            if (depth > 0) raw += ch;
        } else {
            raw += ch;
        }
        i++;
    }
    if (depth !== 0) return null;
    return { value: unescapePdfLiteral(raw), endIdx: i };
}

function extractLinesFromPdfContentStream(streamText: string): string[] {
    const lines: string[] = [];
    let i = 0;
    const len = streamText.length;

    while (i < len) {
        const ch = streamText[i];

        if (ch === '(') {
            const parsed = readPdfLiteralString(streamText, i);
            if (!parsed) {
                i++;
                continue;
            }
            let j = parsed.endIdx;
            while (j < len && /\s/.test(streamText[j])) j++;
            const isTj = streamText.startsWith('Tj', j) && (j + 2 >= len || /[\s()[\]<>/%]/.test(streamText[j + 2]));
            const isQuoteOp = streamText[j] === "'" || streamText[j] === '"';
            if (isTj || isQuoteOp) {
                const cleaned = parsed.value.replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
                if (cleaned) lines.push(cleaned);
                i = isTj ? j + 2 : j + 1;
                continue;
            }
            i = parsed.endIdx;
            continue;
        }

        if (ch === '[') {
            // Collect literal strings inside a `[ ... ] TJ` text array
            let j = i + 1;
            const parts: string[] = [];
            let closed = false;
            while (j < len) {
                const c = streamText[j];
                if (c === '(') {
                    const parsed = readPdfLiteralString(streamText, j);
                    if (!parsed) {
                        j++;
                        continue;
                    }
                    parts.push(parsed.value);
                    j = parsed.endIdx;
                    continue;
                }
                if (c === ']') {
                    closed = true;
                    j++;
                    break;
                }
                // Large negative kerning offsets in PDF TJ arrays represent word spaces
                if (c === '-' || (c >= '0' && c <= '9')) {
                    const numStart = j;
                    if (c === '-') j++;
                    while (j < len && ((streamText[j] >= '0' && streamText[j] <= '9') || streamText[j] === '.')) j++;
                    const numVal = Number(streamText.slice(numStart, j));
                    if (Number.isFinite(numVal) && numVal <= -120 && parts.length > 0) {
                        parts.push(' ');
                    }
                    continue;
                }
                j++;
            }
            if (closed) {
                let k = j;
                while (k < len && /\s/.test(streamText[k])) k++;
                if (streamText.startsWith('TJ', k) && (k + 2 >= len || /[\s()[\]<>/%]/.test(streamText[k + 2]))) {
                    const joined = parts.join('').replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
                    if (joined) lines.push(joined);
                    i = k + 2;
                    continue;
                }
            }
            i = j;
            continue;
        }

        i++;
    }

    return lines;
}

function extractReadableChunksFromPdfBuffer(pdfBuffer: Buffer): string[] {
    if (pdfBuffer.length === 0) return [];
    const latin1 = pdfBuffer.toString('latin1');
    const allLines: string[] = [];

    // Locate `stream ... endstream` blocks; attempt FlateDecode decompression when indicated
    const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
    let match: RegExpExecArray | null;
    let foundStreamBlock = false;
    while ((match = streamRegex.exec(latin1)) !== null) {
        foundStreamBlock = true;
        const headerWindow = latin1.slice(Math.max(0, match.index - 256), match.index);
        const bodyRaw = match[1];
        let streamText = bodyRaw;
        if (/\/FlateDecode\b/.test(headerWindow)) {
            try {
                const compressed = Buffer.from(bodyRaw.replace(/\r?\n$/, ''), 'latin1');
                streamText = inflateSync(compressed).toString('latin1');
            } catch {
                // Fall back to scanning raw bytes if stream wasn't standard zlib
                streamText = bodyRaw;
            }
        }
        const extracted = extractLinesFromPdfContentStream(streamText);
        for (const line of extracted) {
            allLines.push(line);
        }
    }

    if (!foundStreamBlock) {
        allLines.push(...extractLinesFromPdfContentStream(latin1));
    }

    if (allLines.length === 0) return [];

    // Group extracted PDF lines into clean bounded chunks
    const chunks: string[] = [];
    let current = '';
    for (const line of allLines) {
        if (chunks.length >= MAX_EXTRACTED_CHUNKS_PER_ARTIFACT) break;
        const candidate = current ? `${current} ${line}` : line;
        if (candidate.length > MAX_EXTRACTED_CHUNK_CHARS && current) {
            chunks.push(current);
            current = line;
        } else {
            current = candidate;
        }
    }
    if (current && chunks.length < MAX_EXTRACTED_CHUNKS_PER_ARTIFACT) {
        chunks.push(current);
    }
    return chunks.flatMap((chunk) => splitLongTextIntoChunks(chunk, MAX_EXTRACTED_CHUNK_CHARS)).slice(0, MAX_EXTRACTED_CHUNKS_PER_ARTIFACT);
}

function extractChunksFromSlideDeckSpec(deck: SlideDeckSpecLike): string[] {
    const chunks: string[] = [];

    const headerParts: string[] = [];
    if (typeof deck.Title === 'string' && deck.Title.trim()) {
        headerParts.push(`Deck: ${deck.Title.trim()}`);
    }
    if (typeof deck.Subtitle === 'string' && deck.Subtitle.trim()) {
        headerParts.push(deck.Subtitle.trim());
    }
    if (deck.Master && typeof deck.Master === 'object') {
        if (typeof deck.Master.OrganizationName === 'string' && deck.Master.OrganizationName.trim()) {
            headerParts.push(`Organization: ${deck.Master.OrganizationName.trim()}`);
        }
        if (typeof deck.Master.HeaderText === 'string' && deck.Master.HeaderText.trim()) {
            headerParts.push(deck.Master.HeaderText.trim());
        }
    }
    if (headerParts.length > 0) {
        chunks.push(normalizeWhitespace(headerParts.join(' — ')));
    }

    const slides = Array.isArray(deck.Slides) ? deck.Slides : [];
    for (let idx = 0; idx < slides.length && chunks.length < MAX_EXTRACTED_CHUNKS_PER_ARTIFACT; idx++) {
        const slide = slides[idx];
        if (!slide || typeof slide !== 'object') continue;
        const slideNum = typeof slide.SlideNumber === 'number' && Number.isFinite(slide.SlideNumber) ? slide.SlideNumber : idx + 1;
        const parts: string[] = [];

        const titlePart = typeof slide.Title === 'string' && slide.Title.trim() ? slide.Title.trim() : '';
        const subtitlePart = typeof slide.Subtitle === 'string' && slide.Subtitle.trim() ? slide.Subtitle.trim() : '';
        if (titlePart && subtitlePart) {
            parts.push(`Slide ${slideNum} (${titlePart} — ${subtitlePart})`);
        } else if (titlePart) {
            parts.push(`Slide ${slideNum} (${titlePart})`);
        } else {
            parts.push(`Slide ${slideNum}`);
        }

        if (Array.isArray(slide.Regions)) {
            for (const region of slide.Regions) {
                if (!region || typeof region !== 'object') continue;
                const regionBits: string[] = [];
                if (typeof region.Label === 'string' && region.Label.trim()) {
                    regionBits.push(region.Label.trim());
                }
                const hasBigNum =
                    (typeof region.BigNumberValue === 'string' && region.BigNumberValue.trim().length > 0) ||
                    (typeof region.BigNumberValue === 'number' && Number.isFinite(region.BigNumberValue));
                if (hasBigNum) {
                    const val = String(region.BigNumberValue).trim();
                    const lbl = typeof region.BigNumberLabel === 'string' ? region.BigNumberLabel.trim() : '';
                    const delta = typeof region.BigNumberDelta === 'string' ? region.BigNumberDelta.trim() : '';
                    const kpiStr = [lbl ? `${lbl}: ${val}` : val, delta ? `(${delta})` : ''].filter(Boolean).join(' ');
                    if (kpiStr) regionBits.push(kpiStr);
                }
                if (typeof region.MarkdownContent === 'string' && region.MarkdownContent.trim()) {
                    const cleaned = cleanMarkdownSnippet(region.MarkdownContent);
                    if (cleaned) regionBits.push(cleaned);
                }
                if (typeof region.Text === 'string' && region.Text.trim()) {
                    const cleaned = cleanMarkdownSnippet(region.Text);
                    if (cleaned) regionBits.push(cleaned);
                }
                if (typeof region.Body === 'string' && region.Body.trim()) {
                    const cleaned = cleanMarkdownSnippet(region.Body);
                    if (cleaned) regionBits.push(cleaned);
                }
                if (Array.isArray(region.Bullets)) {
                    const bullets: string[] = [];
                    for (const entry of region.Bullets) {
                        if (typeof entry === 'string' && entry.trim().length > 0) {
                            const cleaned = cleanMarkdownSnippet(entry);
                            if (cleaned) bullets.push(cleaned);
                        }
                    }
                    if (bullets.length > 0) regionBits.push(bullets.join('; '));
                }
                if (Array.isArray(region.Items)) {
                    const items: string[] = [];
                    for (const entry of region.Items) {
                        if (typeof entry === 'string' && entry.trim().length > 0) {
                            const cleaned = cleanMarkdownSnippet(entry);
                            if (cleaned) items.push(cleaned);
                        }
                    }
                    if (items.length > 0) regionBits.push(items.join('; '));
                }
                if (Array.isArray(region.Metrics)) {
                    const metrics: string[] = [];
                    for (const metric of region.Metrics) {
                        if (!metric || typeof metric !== 'object') continue;
                        const mLabel = typeof metric.Label === 'string' ? metric.Label.trim() : '';
                        const mVal = metric.Value != null ? String(metric.Value).trim() : '';
                        const mDelta = typeof metric.Delta === 'string' ? metric.Delta.trim() : '';
                        const formatted = [mLabel && mVal ? `${mLabel}: ${mVal}` : mLabel || mVal, mDelta ? `(${mDelta})` : '']
                            .filter(Boolean)
                            .join(' ');
                        if (formatted) metrics.push(formatted);
                    }
                    if (metrics.length > 0) regionBits.push(metrics.join('; '));
                }
                if (typeof region.QuoteAttribution === 'string' && region.QuoteAttribution.trim()) {
                    regionBits.push(`— ${region.QuoteAttribution.trim()}`);
                }
                if (regionBits.length > 0) {
                    parts.push(regionBits.join(': '));
                }
            }
        }

        if (typeof slide.SpeakerNotes === 'string' && slide.SpeakerNotes.trim()) {
            parts.push(`Notes: ${normalizeWhitespace(slide.SpeakerNotes)}`);
        }

        const slideText = normalizeWhitespace(parts.join(' | '));
        if (slideText) {
            chunks.push(...splitLongTextIntoChunks(slideText, MAX_EXTRACTED_CHUNK_CHARS));
        }
    }

    return chunks.slice(0, MAX_EXTRACTED_CHUNKS_PER_ARTIFACT);
}

function extractChunksFromMarkdownOrText(raw: string): string[] {
    const normalized = raw.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    // Split on markdown headings while keeping each heading attached to its body
    const sections: string[] = [];
    const lines = normalized.split('\n');
    let currentLines: string[] = [];
    for (const line of lines) {
        if (/^#{1,3}\s+/.test(line) && currentLines.length > 0) {
            const sectionText = cleanMarkdownSnippet(currentLines.join('\n'));
            if (sectionText) sections.push(sectionText);
            currentLines = [line];
        } else {
            currentLines.push(line);
        }
    }
    if (currentLines.length > 0) {
        const sectionText = cleanMarkdownSnippet(currentLines.join('\n'));
        if (sectionText) sections.push(sectionText);
    }

    const chunks: string[] = [];
    for (const section of sections) {
        if (chunks.length >= MAX_EXTRACTED_CHUNKS_PER_ARTIFACT) break;
        chunks.push(...splitLongTextIntoChunks(section, MAX_EXTRACTED_CHUNK_CHARS));
    }
    return chunks.slice(0, MAX_EXTRACTED_CHUNKS_PER_ARTIFACT);
}

/**
 * Extracts clean, human-readable, bounded text chunks from an `MJ: Artifact Versions.Content`
 * payload across Markdown/plain text, `SlideDeckSpec` JSON, and base64/binary PDF payloads.
 *
 * Guarantees:
 * - Never throws on malformed JSON or corrupt base64/PDF streams.
 * - Never emits raw `data:...;base64,...` or binary bytes into prompts.
 */
export function extractArtifactVersionChunks(content: string | null | undefined): string[] {
    if (typeof content !== 'string') return [];
    const trimmed = content.trim();
    if (!trimmed) return [];

    // 1. Base64-encoded PDF data URI
    if (PDF_DATA_URI_PREFIX.test(trimmed)) {
        const base64Body = trimmed.replace(PDF_DATA_URI_PREFIX, '').replace(/\s+/g, '');
        if (!base64Body) return [];
        try {
            const buf = Buffer.from(base64Body, 'base64');
            return extractReadableChunksFromPdfBuffer(buf);
        } catch {
            return [];
        }
    }

    // 2. Raw PDF stream string
    if (trimmed.startsWith('%PDF-')) {
        try {
            return extractReadableChunksFromPdfBuffer(Buffer.from(trimmed, 'latin1'));
        } catch {
            return [];
        }
    }

    // 3. Any other binary base64 data URI (images, audio, octet-stream) — never dump raw base64
    if (ANY_BASE64_DATA_URI_PREFIX.test(trimmed)) {
        return [];
    }

    // 4. SlideDeckSpec JSON (`SchemaVersion: "1.0"` & `Slides` array, or any object with a `Slides` array)
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed) as SlideDeckSpecLike | null;
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.Slides)) {
                return extractChunksFromSlideDeckSpec(parsed);
            }
        } catch {
            // Malformed JSON: fall through only if it looks like readable text, never throw
            return extractChunksFromMarkdownOrText(trimmed);
        }
    }

    // 5. Plain Markdown / text
    return extractChunksFromMarkdownOrText(trimmed);
}

function cleanTargetRecordId(raw: string | null | undefined): string {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return '';
    return trimmed.toLowerCase().startsWith('id|') ? trimmed.slice(3).trim() : trimmed;
}

function formatDurableRecordReference(entityName: string | null | undefined, recordId: string | null | undefined, displayTitle: string): string {
    const cleanEntity = (entityName ?? '').trim();
    const cleanId = cleanTargetRecordId(recordId);
    const cleanTitle = displayTitle.trim() || 'Untitled';
    if (cleanEntity && cleanId) {
        return `[[${cleanEntity}|${cleanId}|${cleanTitle}]]`;
    }
    return cleanTitle;
}

function formatAuthorizedSpaceItemLine(item: SpaceAgentCandidateItem): string {
    const ref = formatDurableRecordReference(item.EntityName, item.RecordID, item.Name);
    const bandTag = `[Band: ${item.Band}]`;
    const descPart = item.Description ? ` — ${item.Description}` : '';
    const chunksPart = item.ChunkTexts && item.ChunkTexts.length > 0 ? `\n  Content Excerpts: ${item.ChunkTexts.join(' | ')}` : '';

    if (item.EntityName === 'MJ_BizApps_Tasks: Tasks') {
        const statusPart = `Status: ${item.Status ?? 'Open'}`;
        const priorityPart = item.Priority ? ` | Priority: ${item.Priority}` : '';
        const ownerPart = ` | Owner: ${item.Assignees && item.Assignees.length > 0 ? item.Assignees.join(', ') : 'Unassigned'}`;
        const duePart = item.DueAt ? ` | Due: ${item.DueAt}` : '';
        const progressPart = typeof item.PercentComplete === 'number' ? ` | Progress: ${item.PercentComplete}%` : '';
        return `- [Task] ${ref} ${bandTag} [${statusPart}${priorityPart}${ownerPart}${duePart}${progressPart}]${descPart}${chunksPart}`;
    }

    const typeLabel = item.EntityName ? `[${item.EntityName}] ` : '';
    return `- ${typeLabel}${ref} ${bandTag}${descPart}${chunksPart}`;
}

function truncateLineToBudget(text: string, remainingTokens: number): string {
    if (remainingTokens <= 0) return '';
    const maxChars = remainingTokens * CHARS_PER_TOKEN;
    if (text.length <= maxChars) return text;
    if (maxChars <= 4) return '';
    return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Builds the token-bounded Authorized Space Context system message injected into non-default
 * agents (such as platform `Sage` or other general MJ agents whose prompt template does not
 * reference `{{ allowedItems }}` or `{{ typeInstructions }}`).
 *
 * Returns `null` when there are no space instructions, authorized items, granted knowledge hits,
 * granted space data queries/views, or bound actions to inject.
 */
export function buildSpaceAgentContextSystemMessage(params: SpaceAgentContextMessageParams): string | null {
    const typeInstructions = (params.typeInstructions ?? []).map((s) => s.trim()).filter(Boolean);
    const allowedItems = params.allowedItems ?? [];
    const grantedKnowledgeHits = params.grantedKnowledgeHits ?? [];
    const spaceData = params.spaceData ?? [];
    const boundActions = params.boundActions ?? [];

    if (
        typeInstructions.length === 0 &&
        allowedItems.length === 0 &&
        grantedKnowledgeHits.length === 0 &&
        spaceData.length === 0 &&
        boundActions.length === 0
    ) {
        return null;
    }

    const maxTokens =
        typeof params.maxTokens === 'number' && Number.isFinite(params.maxTokens) && params.maxTokens >= 256
            ? Math.floor(params.maxTokens)
            : DEFAULT_SPACE_CONTEXT_SYSTEM_MESSAGE_MAX_TOKENS;

    const header = [
        '## Authorized Collaboration Space Context',
        `Conversation Audience Band: ${params.audience}`,
        'Maintain all Collaboration Space boundaries. Never disclose or quote Team-band items in a Shared conversation.',
    ].join('\n');

    const footer =
        'The authorized materials in this Collaboration Space (and its in-scope sub-spaces) are already provided above. ' +
        'Answer directly from them and cite referenced records using `[[EntityName|RecordID|Display Title]]`; ' +
        'only call `Scoped Search` if you need additional search beyond the provided materials.';

    let usedTokens = estimateTokenCount(header) + estimateTokenCount(footer) + 16;
    const sections: string[] = [header];

    const appendSection = (heading: string, lines: readonly string[]): void => {
        if (lines.length === 0) return;
        const headingTokens = estimateTokenCount(heading) + 2;
        if (usedTokens + headingTokens >= maxTokens) return;

        const kept: string[] = [heading];
        usedTokens += headingTokens;

        for (const line of lines) {
            const lineTokens = estimateTokenCount(line) + 1;
            const remaining = maxTokens - usedTokens;
            if (remaining < 8) break;
            if (lineTokens <= remaining) {
                kept.push(line);
                usedTokens += lineTokens;
            } else {
                const clipped = truncateLineToBudget(line, remaining);
                if (clipped) {
                    kept.push(clipped);
                    usedTokens += estimateTokenCount(clipped) + 1;
                }
                break;
            }
        }
        if (kept.length > 1) {
            sections.push(kept.join('\n'));
        }
    };

    if (typeInstructions.length > 0) {
        appendSection(
            '### Space Instructions',
            typeInstructions.map((line) => `- ${line}`),
        );
    }

    if (allowedItems.length > 0) {
        appendSection(
            '### Authorized Space Materials',
            allowedItems.map((item) => formatAuthorizedSpaceItemLine(item)),
        );
    }

    if (grantedKnowledgeHits.length > 0) {
        appendSection(
            '### Granted Knowledge Sources',
            grantedKnowledgeHits.map((hit) => {
                const ref = formatDurableRecordReference(hit.entityName, hit.recordId, hit.title);
                const snippet = hit.snippet?.trim() ? `: ${hit.snippet.trim()}` : '';
                return `- [${hit.scopeName}] ${ref}${snippet}`;
            }),
        );
    }

    if (spaceData.length > 0) {
        appendSection(
            '### Granted Space Data Queries & Views ("Collaboration: Run Space Data")',
            spaceData.map((grant) => {
                const desc = grant.Description ? `: ${grant.Description}` : '';
                const paramsNote = grant.Parameters.length > 0
                    ? ` (parameters you may set in Values: ${grant.Parameters.join(', ')})`
                    : ' (no parameters)';
                return `- "${grant.Name}"${desc}${paramsNote}`;
            }),
        );
    }

    if (boundActions.length > 0) {
        appendSection(
            '### Granted Space Actions',
            boundActions.map((action) => {
                const desc = action.description ? `: ${action.description}` : '';
                const paramNames = action.parameters
                    .map((p) => `${p.Name}${p.IsRequired ? '*' : ''} (${p.ValueType})`)
                    .join(', ');
                const paramsNote = paramNames ? ` [parameters: ${paramNames}]` : ' [no user parameters]';
                return `- ${action.name}${desc}${paramsNote}`;
            }),
        );
    }

    sections.push(footer);
    return sections.join('\n\n');
}
