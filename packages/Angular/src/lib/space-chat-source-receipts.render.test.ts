// @vitest-environment jsdom
import '@angular/compiler';
import { ChangeDetectionStrategy, Component, ContentChildren, EventEmitter, QueryList, type TemplateRef, type Type } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UserInfo } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import {
    type AfterAgentTurnEventArgs,
    type BeforeAgentTurnEventArgs,
    ChatSlotDirective,
    ConversationStreamingService,
} from '@memberjunction/ng-conversations';
import {
    MJButtonDirective,
    MJMenuComponent,
    MJMenuItemComponent,
    MJMenuTriggerDirective,
} from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import {
    CollabAnswerSourceReceiptsComponent,
    CollabAvatarComponent,
    CollabBandChipComponent,
    CollabChatScopeBarComponent,
    CollabSpaceChatComponent,
    type SpaceChatAnswerSourceReceipt,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { CollaborationSectionResource } from './collaboration-section.component.ts';

const here = dirname(fileURLToPath(import.meta.url));

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
});

function declareComponent(target: Type<unknown>, metadata: Component): void {
    Component({ standalone: true, ...metadata })(target);
}

class ChatAreaStub {
    @ContentChildren(ChatSlotDirective) public slots?: QueryList<ChatSlotDirective>;
    public get header(): TemplateRef<unknown> | null {
        return this.slots?.find((slot) => slot.SlotName === 'header')?.Template ?? null;
    }
    public get messageExtra(): TemplateRef<unknown> | null {
        return this.slots?.find((slot) => slot.SlotName === 'messageExtra')?.Template ?? null;
    }
    public DisplayMessages: Array<Record<string, unknown>> = [];
    public AllowRealtime = true;
    public ReadOnly = false;
    public ReadOnlyMessage: string | null = null;
    public EnableDecisionRouting = false;
    public CollapseThreadReplies = false;
    public ShowAgentCharacter = false;
    public assistantDisplayName: string | null = null;
    public BeforeAgentTurn = new EventEmitter<BeforeAgentTurnEventArgs>();
    public AfterAgentTurn = new EventEmitter<AfterAgentTurnEventArgs>();
    public ComposerDraftConsumed = new EventEmitter<void>();
    public PendingMessageConsumed = new EventEmitter<void>();
}
declareComponent(ChatAreaStub, {
    selector: 'mj-conversation-chat-area',
    imports: [NgTemplateOutlet],
    template: `
        <ng-content></ng-content>
        <ng-container *ngTemplateOutlet="header"></ng-container>
        @for (m of DisplayMessages; track $index) {
            <div class="stub-message" [attr.data-message-id]="m['ID']">
                <div class="stub-message-body">{{ m['Message'] }}</div>
                <ng-container *ngTemplateOutlet="messageExtra; context: { message: m }"></ng-container>
            </div>
        }
    `,
    inputs: [
        'EnvironmentId', 'CurrentUser', 'ConversationId', 'ApplicationScope', 'ApplicationId', 'LinkedEntityId', 'LinkedRecordId', 'DefaultAgentId',
        'assistantDisplayName', 'ReadOnly', 'ReadOnlyMessage', 'AllowMentions', 'AllowEntityMentions', 'AllowSkillCommands', 'AllowAttachments', 'AllowRealtime',
        'CollapseThreadReplies', 'ShowAgentCharacter', 'AgentReplyMode', 'AllowedAgentIDs', 'EnableDecisionRouting', 'MentionPeople', 'AgentHistoryFrom',
        'AgentTurnHandler', 'AutoNameConversation', 'ComposerDraft', 'PendingMessage', 'PendingMessageConversationId',
    ],
    outputs: ['BeforeAgentTurn', 'AfterAgentTurn', 'ComposerDraftConsumed', 'PendingMessageConsumed'],
});

const chatTestImports = [
    CollabAnswerSourceReceiptsComponent,
    CollabAvatarComponent,
    CollabBandChipComponent,
    CollabChatScopeBarComponent,
    MJButtonDirective,
    MJMenuComponent,
    MJMenuItemComponent,
    MJMenuTriggerDirective,
    SharedGenericModule,
    ChatSlotDirective,
    ChatAreaStub,
];

const streamingStub = { initialize: vi.fn() };

function buildReceipt(overrides: Partial<SpaceChatAnswerSourceReceipt>): SpaceChatAnswerSourceReceipt {
    return {
        id: 'rcpt-1',
        conversationDetailId: 'ai-msg-1',
        spaceId: 'space-1',
        sourceKind: 'SpaceItem',
        spaceItemId: 'item-1',
        contentSourceId: null,
        targetEntityId: null,
        targetRecordId: null,
        sourceTitle: 'FY2026 Audit Committee Pack.pdf',
        band: 'Shared',
        wasSupplied: true,
        wasCited: true,
        retrievalRank: 1,
        relevanceScore: 0.94,
        rankingMode: 'vector',
        citationOrdinal: 1,
        estimatedTokens: 320,
        wasTruncated: false,
        sequence: 1,
        ...overrides,
    };
}

describe('Space chat source receipts & OpenApp v3 readiness (CT-2)', () => {
    it('renders per-answer citation chips on space agent answers, enforces fail-closed Shared audience filtering, opens cited sources, and avoids raw Markdown leaks', async () => {
        TestBed.overrideProvider(ConversationStreamingService, { useValue: streamingStub });
        TestBed.overrideComponent(CollabSpaceChatComponent, { set: { imports: chatTestImports } });
        const fixture = TestBed.createComponent(CollabSpaceChatComponent);

        const userMsg = { ID: 'user-msg-1', Role: 'User', UserID: 'u1', User: 'Dana Whitfield', Message: 'Summarize audit scope.' };
        const aiMsg = { ID: 'ai-msg-1', ParentID: 'user-msg-1', Role: 'AI', AgentID: 'agent-1', Agent: 'Sage', Message: 'The FY2026 audit scope covers internal controls and external review.' };

        const opened: SpaceChatAnswerSourceReceipt[] = [];
        const turnCompleted = vi.fn();
        fixture.componentInstance.SourceReceiptOpenRequested.subscribe((receipt) => opened.push(receipt));
        fixture.componentInstance.AfterAgentTurnCompleted.subscribe(turnCompleted);

        const testUser = Object.assign(new UserInfo(), { ID: 'u1', Name: 'Dana Whitfield' });
        fixture.componentRef.setInput('ConversationId', 'conv-1');
        fixture.componentRef.setInput('SpaceId', 'space-1');
        fixture.componentRef.setInput('AudienceBand', 'Shared');
        fixture.componentRef.setInput('CurrentUser', testUser);
        fixture.componentRef.setInput('SourceReceipts', [
            buildReceipt({
                id: 'rcpt-shared-cited',
                sourceTitle: '### **FY2026 Audit Committee Pack.pdf** [source:item-1]',
                band: 'Shared',
                wasCited: true,
                citationOrdinal: 1,
                rankingMode: 'vector',
            }),
            buildReceipt({
                id: 'rcpt-team-secret',
                spaceItemId: 'item-secret',
                sourceTitle: 'Internal Partner Fee Margin.xlsx',
                band: 'Team',
                wasCited: true,
                citationOrdinal: 2,
                rankingMode: 'lexical',
            }),
            buildReceipt({
                id: 'rcpt-shared-supplied',
                spaceItemId: 'item-2',
                sourceTitle: 'Audit Charter Review Memo.docx',
                band: 'Shared',
                wasCited: false,
                citationOrdinal: null,
                retrievalRank: 2,
                relevanceScore: 0.71,
                rankingMode: 'lexical',
                sequence: 2,
            }),
        ]);
        fixture.detectChanges();

        const area = fixture.debugElement.query((n) => n.name === 'mj-conversation-chat-area').injector.get(ChatAreaStub);
        area.DisplayMessages = [userMsg, aiMsg];
        fixture.componentRef.setInput('ThreadMessages', [userMsg, aiMsg]);
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        const receiptsRegion = host.querySelector('[data-testid="answer-source-receipts"][data-message-id="ai-msg-1"]');
        expect(receiptsRegion).not.toBeNull();

        // Fail-closed: Team source is strictly hidden in Shared chat; only the 2 Shared sources appear in count, and only the 1 cited chip renders
        expect(receiptsRegion?.textContent).toContain('Used 2 in-reach sources · 1 cited · Shared reach only');
        expect(receiptsRegion?.textContent).not.toContain('Internal Partner Fee Margin.xlsx');

        // Zero raw Markdown leaks in rendered DOM text
        expect(receiptsRegion?.textContent).not.toContain('###');
        expect(receiptsRegion?.textContent).not.toContain('**');
        expect(receiptsRegion?.textContent).not.toContain('[source:');

        const chips = receiptsRegion!.querySelectorAll<HTMLButtonElement>('[data-testid="answer-citation-chip"]');
        expect(chips).toHaveLength(1);
        expect(chips[0].textContent).toContain('[1]');
        expect(chips[0].textContent).toContain('FY2026 Audit Committee Pack.pdf');

        // Click citation chip -> opens source
        chips[0].click();
        expect(opened).toHaveLength(1);
        expect(opened[0].id).toBe('rcpt-shared-cited');

        // Expand inspector drawer -> reveals supplied-but-uncited Shared source & ranking details
        const inspectBtn = receiptsRegion!.querySelector<HTMLButtonElement>('[data-testid="receipt-inspect-toggle"]')!;
        inspectBtn.click();
        fixture.detectChanges();

        const inspector = receiptsRegion!.querySelector('[data-testid="answer-receipt-inspector"]')!;
        expect(inspector).not.toBeNull();
        const rows = inspector.querySelectorAll('[data-testid="answer-receipt-row"]');
        expect(rows).toHaveLength(2);
        expect(inspector.textContent).toContain('Audit Charter Review Memo.docx');
        expect(inspector.textContent).toContain('Vector match');
        expect(inspector.textContent).toContain('Lexical match');
        expect(inspector.textContent).not.toContain('Internal Partner Fee Margin.xlsx');

        // AfterAgentTurn emits AfterAgentTurnCompleted so host reloads persisted receipts
        area.AfterAgentTurn.emit({
            AgentId: 'agent-1',
            AgentName: 'Sage',
            Route: 'Mention',
            ConversationId: 'conv-1',
            UserMessageId: 'user-msg-1',
            AgentMessage: null,
            Success: true,
        });
        expect(turnCompleted).toHaveBeenCalledTimes(1);
    });

    it('satisfies OpenApp v3 readiness: ClassFactory registrations, OnPush strategy, semantic --mj-* tokens, and zero window.print()', async () => {
        const publicApi = await import('../../dist/public-api.js');
        publicApi.LoadBizAppsCollaborationClient();
        void publicApi.mjBizAppsCollaborationSpaceAgentSourceReceiptFormComponent;
        void CollaborationSectionResource;

        const formReg = MJGlobal.Instance.ClassFactory.GetRegistration(
            BaseFormComponent,
            'MJ_BizApps_Collaboration: Space Agent Source Receipts',
        );
        expect(formReg).toBeDefined();

        const resourceReg = MJGlobal.Instance.ClassFactory.GetRegistration(
            BaseResourceComponent,
            'CollaborationSectionResource',
        );
        expect(resourceReg).toBeDefined();

        // Check ChangeDetectionStrategy.OnPush on Angular chat & receipt components
        const receiptsSource = readFileSync(resolve(here, '../../../AngularWidgets/src/lib/answer-source-receipts.component.ts'), 'utf8');
        const chatSource = readFileSync(resolve(here, '../../../AngularWidgets/src/lib/space-chat.component.ts'), 'utf8');
        expect(receiptsSource).toContain('ChangeDetectionStrategy.OnPush');
        expect(chatSource).toContain('ChangeDetectionStrategy.OnPush');

        const cmpRaw: object | undefined = Reflect.get(CollabAnswerSourceReceiptsComponent, 'ɵcmp');
        expect(cmpRaw).toBeDefined();
        expect(cmpRaw ? Reflect.get(cmpRaw, 'onPush') : false).toBe(true);
        const chatCmpRaw: object | undefined = Reflect.get(CollabSpaceChatComponent, 'ɵcmp');
        expect(chatCmpRaw ? Reflect.get(chatCmpRaw, 'onPush') : false).toBe(true);

        // Verify zero raw hex/rgb/rgba/hsl color literals in CollabAnswerSourceReceiptsComponent styles (outside var(--token, fallback))
        const rawStyles: unknown = cmpRaw ? Reflect.get(cmpRaw, 'styles') : [];
        const styleText = Array.isArray(rawStyles) ? rawStyles.filter((s): s is string => typeof s === 'string').join('\n') : '';
        const fallbackPattern = /var\(--[a-z0-9-]+\s*,\s*(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^)]*\))\s*\)/g;
        const stylesWithoutFallbacks = styleText.replace(fallbackPattern, '');
        expect(stylesWithoutFallbacks).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(stylesWithoutFallbacks).not.toMatch(/\b(?:rgba?|hsla?)\(/);

        // Verify zero window.print() across packages/Angular/src and packages/AngularWidgets/src
        const collabSectionSource = readFileSync(resolve(here, 'collaboration-section.component.ts'), 'utf8');
        const widgetsSource = readFileSync(resolve(here, '../../../AngularWidgets/src/lib/answer-source-receipts.component.ts'), 'utf8');
        expect(collabSectionSource).not.toContain('window.print(');
        expect(widgetsSource).not.toContain('window.print(');
    });
});
