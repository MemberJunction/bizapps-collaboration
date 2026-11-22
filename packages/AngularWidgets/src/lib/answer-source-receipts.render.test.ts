// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { CollabAnswerSourceReceiptsComponent } from './answer-source-receipts.component.ts';
import type { SpaceChatAnswerSourceReceipt } from './types.ts';

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
});

function sampleReceipt(overrides: Partial<SpaceChatAnswerSourceReceipt>): SpaceChatAnswerSourceReceipt {
    return {
        id: 'rcpt-1',
        conversationDetailId: 'msg-ai-1',
        spaceId: 'space-1',
        sourceKind: 'SpaceItem',
        spaceItemId: 'item-1',
        contentSourceId: null,
        targetEntityId: null,
        targetRecordId: null,
        sourceTitle: 'Q3 Financial Controls.pdf',
        band: 'Shared',
        wasSupplied: true,
        wasCited: true,
        retrievalRank: 1,
        relevanceScore: 0.91,
        rankingMode: 'lexical',
        citationOrdinal: 1,
        estimatedTokens: 240,
        wasTruncated: false,
        sequence: 1,
        ...overrides,
    };
}

describe('CollabAnswerSourceReceiptsComponent', () => {
    it('renders cited chips first, strips raw Markdown syntax, toggles receipt inspector, and emits ReceiptOpenRequested', async () => {
        const fixture = TestBed.createComponent(CollabAnswerSourceReceiptsComponent);
        const opened: SpaceChatAnswerSourceReceipt[] = [];
        fixture.componentInstance.ReceiptOpenRequested.subscribe((r) => opened.push(r));

        fixture.componentRef.setInput('MessageId', 'msg-ai-1');
        fixture.componentRef.setInput('AudienceBand', 'Team');
        fixture.componentRef.setInput('Receipts', [
            sampleReceipt({
                id: 'r-supplied',
                sourceTitle: '`Internal Controls Draft`',
                band: 'Team',
                wasCited: false,
                citationOrdinal: null,
                retrievalRank: 2,
                relevanceScore: 0.72,
                rankingMode: 'lexical',
                sequence: 2,
            }),
            sampleReceipt({
                id: 'r-cited-2',
                sourceKind: 'KnowledgeSource',
                spaceItemId: null,
                contentSourceId: 'cs-1',
                sourceTitle: '**IFRS Audit Handbook** [cite:cs-1]',
                band: 'Shared',
                wasCited: true,
                citationOrdinal: 2,
                retrievalRank: null,
                relevanceScore: null,
                rankingMode: 'grant',
                estimatedTokens: 0,
                sequence: 3,
            }),
            sampleReceipt({
                id: 'r-cited-1',
                sourceTitle: '### Q3 Financial Controls.pdf',
                band: 'Shared',
                wasCited: true,
                citationOrdinal: 1,
                retrievalRank: 1,
                relevanceScore: 0.95,
                rankingMode: 'vector',
                estimatedTokens: 350,
                wasTruncated: true,
                sequence: 1,
            }),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('[data-testid="answer-receipt-summary"]')?.textContent).toContain('Used 3 in-reach sources · 2 cited · Team + Shared reach');

        const chips = host.querySelectorAll<HTMLButtonElement>('[data-testid="answer-citation-chip"]');
        expect(chips).toHaveLength(2);
        expect(chips[0].textContent).toContain('[1]');
        expect(chips[0].textContent).toContain('Q3 Financial Controls.pdf');
        expect(chips[1].textContent).toContain('[2]');
        expect(chips[1].textContent).toContain('IFRS Audit Handbook');

        // Zero raw Markdown syntax in rendered DOM
        expect(host.textContent).not.toContain('###');
        expect(host.textContent).not.toContain('**');
        expect(host.textContent).not.toContain('[cite:');
        expect(host.textContent).not.toContain('`');

        // Expand inspector drawer
        const toggle = host.querySelector<HTMLButtonElement>('[data-testid="receipt-inspect-toggle"]')!;
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        toggle.click();
        fixture.detectChanges();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        const rows = host.querySelectorAll('[data-testid="answer-receipt-row"]');
        expect(rows).toHaveLength(3);
        expect(rows[0].textContent).toContain('Vector match');
        expect(rows[0].textContent).toContain('Excerpt truncated');
        expect(rows[2].textContent).toContain('Supplied');

        // Click Open button on the supplied Team row
        const openBtns = host.querySelectorAll<HTMLButtonElement>('[data-testid="receipt-open-btn"]');
        openBtns[2].click();
        expect(opened).toHaveLength(1);
        expect(opened[0].id).toBe('r-supplied');
    });

    it('hides Team receipts when AudienceBand is Shared even if passed in input', async () => {
        const fixture = TestBed.createComponent(CollabAnswerSourceReceiptsComponent);
        fixture.componentRef.setInput('MessageId', 'msg-ai-2');
        fixture.componentRef.setInput('AudienceBand', 'Shared');
        fixture.componentRef.setInput('Receipts', [
            sampleReceipt({ id: 'r-team-only', band: 'Team', sourceTitle: 'Private Salary Table.xlsx', wasCited: true, citationOrdinal: 1 }),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('[data-testid="answer-source-receipts"]')).toBeNull();
        expect(host.textContent).not.toContain('Private Salary Table.xlsx');
    });
});
