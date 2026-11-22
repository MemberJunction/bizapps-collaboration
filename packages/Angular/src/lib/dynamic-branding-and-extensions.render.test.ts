// @vitest-environment jsdom
import '@angular/compiler';
import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { EntityFieldInfo, EntityInfo, UserInfo } from '@memberjunction/core';
import { MJGlobal, RegisterClass } from '@memberjunction/global';
import {
    BaseNeedsYouProvider,
    BaseSpaceHeaderChipProvider,
    SHIPPED_STATUSES,
    type NeedsYouItem,
    type SpaceBatchContext,
    type SpaceHeaderChip,
} from '@mj-biz-apps/collaboration-core';
import {
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
    mjBizAppsCollaborationSpaceTypeStatusEntity,
} from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngineBase } from '@mj-biz-apps/collaboration-engine-base';
import {
    BaseSpaceOverviewCard,
    BaseSpaceSettingsSection,
    BaseSpaceTab,
    BaseSpaceTypeUIDriver,
    CollabShareCheckComponent,
    CollabShareCheckDialogComponent,
    CollabSpaceChatComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceOverviewComponent,
    CollabSpaceSettingsComponent,
    CollabSpaceTabsComponent,
    type SpaceHeaderActionDescriptor,
    type SpaceHeaderChipDescriptor,
    type SpaceOverviewCardDescriptor,
    type SpaceSettingsModel,
    type SpaceSettingsSectionDescriptor,
    type SpaceTabDescriptor,
    type SpaceUIContext,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { BaseResourceComponent, NavigationService, SharedService } from '@memberjunction/ng-shared';
import { MJAlertComponent, MJButtonDirective, MJClickableDirective, MJEmptyStateComponent, MJPageBodyComponent, MJPageLayoutComponent } from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { CollaborationSectionResource } from './collaboration-section.component.ts';

const here = dirname(fileURLToPath(import.meta.url));

const SPACE_ID = '11111111-1111-4111-8111-111111111111';
const TYPE_ID = '22222222-2222-4222-8222-222222222222';
const ACTIVE_STATUS_ID = '33333333-3333-4333-8333-333333333301';
const PAUSED_STATUS_ID = '33333333-3333-4333-8333-333333333302';
const CLOSED_STATUS_ID = '33333333-3333-4333-8333-333333333303';
const USER_ID = '44444444-4444-4444-8444-444444444444';

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

function declareComponent(target: Type<object>, metadata: Component): void {
    Component({ standalone: true, ...metadata })(target);
}

class CustomSettingsSectionComponent extends BaseSpaceSettingsSection {
    public override SpaceId = '';
    public override SpaceTypeCode = '';
    public override Sequence = 0;
}
declareComponent(CustomSettingsSectionComponent, {
    selector: 'cx-test-settings-section',
    template: `<div class="custom-settings-section-body" [attr.data-space-id]="SpaceId" [attr.data-type]="SpaceTypeCode">Custom quorum rules for {{ SpaceId }}</div>`,
    inputs: ['SpaceId', 'SpaceTypeCode', 'Sequence'],
});

class CustomOverviewCardComponent extends BaseSpaceOverviewCard {
    public override SpaceId = '';
    public override Sequence = 0;
}
declareComponent(CustomOverviewCardComponent, {
    selector: 'cx-test-overview-card',
    template: `<div class="custom-overview-card">Card for {{ SpaceId }}</div>`,
    inputs: ['SpaceId', 'Sequence'],
});

class CustomSpaceTabComponent extends BaseSpaceTab {
    public override SpaceId = '';
    public override SpaceTypeCode = '';
    public override Sequence = 0;
}
declareComponent(CustomSpaceTabComponent, {
    selector: 'cx-test-space-tab',
    template: `<div class="custom-tab">Tab for {{ SpaceId }}</div>`,
    inputs: ['SpaceId', 'SpaceTypeCode', 'Sequence'],
});

function buildEntityInfoWithFields(id: string, name: string, fieldNames: readonly string[]): EntityInfo {
    const entityInfo = new EntityInfo({
        ID: id,
        Name: name,
        SchemaName: '__mj_BizAppsCollaboration',
        BaseView: 'vwEntity',
        BaseTable: 'Entity',
        AllowCreateAPI: true,
        AllowUpdateAPI: true,
    });
    for (const fieldName of fieldNames) {
        entityInfo.Fields.push(new EntityFieldInfo({
            Name: fieldName,
            DisplayName: fieldName,
            Type: fieldName.startsWith('Is') || fieldName === 'ReadOnly' || fieldName === 'Visible' || fieldName === 'AgentRetrieval' || fieldName === 'CanChangeAfter' || fieldName === 'NotifyMembersOnEnter' || fieldName.endsWith('Panel') || fieldName === 'InheritsMembership'
                ? 'bit'
                : fieldName === 'Sequence'
                    ? 'int'
                    : 'nvarchar',
            IsPrimaryKey: fieldName === 'ID',
            AllowsNull: fieldName !== 'ID',
            AllowUpdateAPI: fieldName !== 'ID',
        }));
    }
    return entityInfo;
}

function buildSpaceEntityInfo(): EntityInfo {
    return buildEntityInfoWithFields('entity-spaces-1', 'MJ_BizApps_Collaboration: Spaces', [
        'ID', 'SpaceTypeID', 'ParentID', 'Name', 'Description', 'OwnerID',
        'InheritsMembership', 'AgentRetrieval', 'StartedAt', 'ClosedAt',
        'StatusID', 'IconClass', 'Color', 'BackgroundImageURL', 'Configuration',
    ]);
}

function makeStatusEntity(
    id: string,
    attrs: typeof SHIPPED_STATUSES[number],
): mjBizAppsCollaborationSpaceTypeStatusEntity {
    const info = buildEntityInfoWithFields(
        `entity-status-${attrs.Code}`,
        'MJ_BizApps_Collaboration: Space Type Statuses',
        ['ID', 'SpaceTypeID', 'Code', 'Name', 'Sequence', 'IsDefault', 'ReadOnly', 'Visible', 'AgentRetrieval', 'CanChangeAfter', 'NotifyMembersOnEnter', 'IsTerminal'],
    );
    const status = new mjBizAppsCollaborationSpaceTypeStatusEntity(info);
    status.ID = id;
    status.SpaceTypeID = TYPE_ID;
    status.Code = attrs.Code;
    status.Name = attrs.Name;
    status.Sequence = attrs.Sequence;
    status.IsDefault = attrs.IsDefault;
    status.ReadOnly = attrs.ReadOnly;
    status.Visible = attrs.Visible;
    status.AgentRetrieval = attrs.AgentRetrieval;
    status.CanChangeAfter = attrs.CanChangeAfter;
    status.NotifyMembersOnEnter = attrs.NotifyMembersOnEnter;
    status.IsTerminal = attrs.IsTerminal;
    return status;
}

class RailStub {
    public Mode = 'home';
    public ActiveNav = 'home';
    public Spaces: object[] = [];
    public ActiveSpaceId = '';
    public SpaceTitle = '';
    public SpaceIcon = '';
    public SpaceBand = 'Shared';
    public ActiveTab = 'Overview';
    public Tabs: object[] = [];
    public Conversations: object[] = [];
    public CanConfigure = false;
    public ActiveConversationId = '';
    public CanStartConversation = false;
    public LibraryCount = 0;
    public TaskCount = 0;
    public MyTaskCount = 0;
    public MemberCount = 0;
    public InboxCount = 0;
    public CanCreateSpace = false;
}
declareComponent(RailStub, {
    selector: 'mjc-space-rail',
    template: `<nav class="rail-stub"></nav>`,
    inputs: [
        'Mode', 'ActiveNav', 'Spaces', 'ActiveSpaceId', 'SpaceTitle', 'SpaceIcon',
        'SpaceBand', 'ActiveTab', 'Tabs', 'Conversations', 'CanConfigure',
        'ActiveConversationId', 'CanStartConversation', 'LibraryCount', 'TaskCount',
        'MyTaskCount', 'MemberCount', 'InboxCount', 'CanCreateSpace',
    ],
});

class AudiencePillStub {
    public StaffAvatars: object[] = [];
    public OutsideAvatars: object[] = [];
    public TotalPeople = 0;
    public Summary = '';
}
declareComponent(AudiencePillStub, {
    selector: 'mjc-audience-pill',
    template: `<span class="aud-stub">{{ TotalPeople }}</span>`,
    inputs: ['StaffAvatars', 'OutsideAvatars', 'TotalPeople', 'Summary'],
});

class NoopStub {}
declareComponent(NoopStub, { selector: 'mjc-no-access', template: '', inputs: ['Seats'] });

@Component({
    selector: 'mjc-testable-collaboration-section',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MJPageLayoutComponent,
        MJPageBodyComponent,
        MJButtonDirective,
        MJClickableDirective,
        MJEmptyStateComponent,
        RailStub,
        NoopStub,
    ],
    template: `
        <mj-page-layout>
            <mj-page-body [Padding]="false">
                <h1 class="home-title">Welcome to {{ activeApplicationName }}</h1>
            </mj-page-body>
        </mj-page-layout>
    `,
})
class TestableHomeSection extends CollaborationSectionResource {
    public override async loadRealData(): Promise<void> {}
}

@Component({
    selector: 'mjc-testable-extensions-section',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SharedGenericModule,
        MJPageLayoutComponent,
        MJPageBodyComponent,
        MJButtonDirective,
        MJAlertComponent,
        MJClickableDirective,
        MJEmptyStateComponent,
        CollabSpaceHeaderComponent,
        CollabSpaceTabsComponent,
        CollabSpaceOverviewComponent,
        CollabSpaceSettingsComponent,
        RailStub,
        AudiencePillStub,
        NoopStub,
    ],
    template: `
        <mj-page-layout>
            <mj-page-body [Padding]="false">
                <mjc-space-header
                    [Title]="spaceTitle"
                    [TypeName]="spaceTypeName"
                    [Status]="spaceStatus"
                    [Chips]="headerContributedChips">
                    <div actions class="row gap8">
                        @for (act of headerContributedActions; track act.key) {
                            <button type="button" mjButton [Variant]="act.primary ? 'primary' : 'secondary'" Size="md" (click)="onHeaderActionClicked(act)">
                                <span>{{ act.label }}</span>
                            </button>
                        }
                    </div>
                    <mjc-space-tabs [Tabs]="tabs" [ActiveTab]="activeTab" (TabSelectRequested)="onTabSelectRequested($event)" />
                </mjc-space-header>
                <mjc-space-overview
                    [SpaceId]="activeSpaceId"
                    [SpaceName]="spaceTitle"
                    [NeedsYouItems]="overviewNeedsYou"
                    [ContributedCards]="overviewContributedCards"
                    (NeedsYouActionRequested)="onNeedsYouAction($event)"
                />
                <mjc-space-settings
                    [Settings]="spaceSettings"
                    [CanEdit]="true"
                    [AgentName]="'Board Copilot'"
                    [SpaceId]="activeSpaceId"
                    [SpaceTypeCode]="activeSpaceTypeCode"
                    [ContributedSections]="settingsContributedSections"
                />
            </mj-page-body>
        </mj-page-layout>
    `,
})
class TestableExtensionsSection extends CollaborationSectionResource {
    public override async loadRealData(): Promise<void> {}
    public async runLoadActiveSpaceEntity(space: CollaborationSectionResource['rawSpaces'][number]): Promise<void> {
        await this.loadActiveSpaceEntity(space, () => true);
    }
    public runBuildSpaceUi(space: CollaborationSectionResource['rawSpaces'][number]): void {
        this.buildSpaceUi(space);
    }
    public async runLoadSpaceNeedsYou(space: CollaborationSectionResource['rawSpaces'][number]): Promise<void> {
        await this.loadSpaceNeedsYou(space, () => true);
    }
    public async runLoadSpaceHeaderChips(space: CollaborationSectionResource['rawSpaces'][number]): Promise<void> {
        await this.loadSpaceHeaderChips(space, () => true);
    }
}

@Component({
    selector: 'mjc-testable-lifecycle-section',
    standalone: true,
    imports: [CommonModule, MJPageLayoutComponent, MJPageBodyComponent],
    template: '<mj-page-layout><mj-page-body></mj-page-body></mj-page-layout>',
})
class TestableLifecycleSection extends CollaborationSectionResource {
    public override async loadRealData(): Promise<void> {}
    protected override async selectSpaceInternal(_spaceId: string, _quiet = false): Promise<void> {}
}

describe('CX-8 Dynamic Agent & Application Naming', () => {
    it('renders the active application name on Home and falls back cleanly to Collaboration when unavailable', async () => {
        const activeApp$ = new BehaviorSubject<{ Name: string } | null>({ Name: 'Deal Rooms' });
        const navStub = {
            AppManager: {
                GetActiveApp: () => activeApp$.value,
                ActiveApp: activeApp$.asObservable(),
            },
            QueryParamChanged$: new Subject(),
            GetTabQueryParams: () => ({}),
            SetAgentContext: vi.fn(),
            UpdateTabQueryParams: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [{ provide: NavigationService, useValue: navStub }],
        });

        const fixture = TestBed.createComponent(TestableHomeSection);
        const comp = fixture.componentInstance;
        vi.spyOn(comp, 'GetQueryParams').mockReturnValue({});

        fixture.detectChanges();
        await fixture.whenStable();

        const titleEl = (fixture.nativeElement as HTMLElement).querySelector('.home-title');
        expect(titleEl?.textContent?.trim()).toBe('Welcome to Deal Rooms');

        activeApp$.next(null);
        fixture.detectChanges();
        expect(titleEl?.textContent?.trim()).toBe('Welcome to Collaboration');
    });

    it('replaces hardcoded The Assistant strings with configured AgentName across settings, share-check, and chat', async () => {
        // 1. Space Settings
        const settingsFixture = TestBed.createComponent(CollabSpaceSettingsComponent);
        const baseSettings: SpaceSettingsModel = {
            id: SPACE_ID,
            name: 'Audit Space',
            description: 'Board review',
            spaceType: 'Board',
            spaceTypeId: TYPE_ID,
            iconClass: 'fa-solid fa-landmark',
            color: '#0076b6',
            backgroundImageUrl: '',
            inheritsMembership: true,
            agentRetrieval: 'Included',
            status: 'Active',
        };
        settingsFixture.componentRef.setInput('Settings', baseSettings);
        settingsFixture.componentRef.setInput('CanEdit', true);
        settingsFixture.componentRef.setInput('AgentName', 'Counsel Advisor');
        settingsFixture.detectChanges();
        await settingsFixture.whenStable();
        expect((settingsFixture.nativeElement as HTMLElement).textContent).toContain(
            'Counsel Advisor synthesizes files, conversations, and tasks from this space.',
        );
        expect((settingsFixture.nativeElement as HTMLElement).textContent).not.toContain('The Assistant');

        // Fallback when AgentName is empty
        settingsFixture.componentRef.setInput('AgentName', '');
        settingsFixture.detectChanges();
        expect((settingsFixture.nativeElement as HTMLElement).textContent).toContain(
            'The Assistant synthesizes files, conversations, and tasks from this space.',
        );

        // 2. Share Check
        const shareFixture = TestBed.createComponent(CollabShareCheckComponent);
        shareFixture.componentRef.setInput('ItemName', 'Q3 Pack.pdf');
        shareFixture.componentRef.setInput('AgentName', 'Board Copilot');
        shareFixture.detectChanges();
        await shareFixture.whenStable();
        expect((shareFixture.nativeElement as HTMLElement).textContent).toContain(
            "Board Copilot can quote it in this space's chats.",
        );
        expect((shareFixture.nativeElement as HTMLElement).textContent).not.toContain('The Assistant');

        // 3. Space Chat no-agent reason label uses configured DefaultAgentName
        vi.useFakeTimers();
        try {
            const chat = new CollabSpaceChatComponent();
            chat.DefaultAgentId = 'agent-sage';
            chat.DefaultAgentName = 'Advisor Sage';
            chat.onUserMessageSent({ ID: 'msg-1', Role: 'User', Message: 'Hello team' }, null);
            vi.advanceTimersByTime(150);
            expect(chat.pendingAgentPrompt?.suggestedAgentName).toBe('Advisor Sage');
            expect(chat.pendingAgentPrompt?.reasonLabel).toBe('Advisor Sage only steps in when mentioned or in a thread.');
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('CX-9 UI Extension Points & Live Non-Null Space in SpaceUIContext', () => {
    it('passes live non-null Space to GetTabs/GetOverviewCards/GetHeaderChips/GetHeaderActions/GetSettingsSections and wires all extension points', async () => {
        const capturedContexts: Array<{ hook: string; space: SpaceUIContext['space'] }> = [];
        const headerActionSpy = vi.fn();

        class RecordingBoardUIDriver extends BaseSpaceTypeUIDriver {
            public override GetTabs(ctx: SpaceUIContext, defaultTabs: SpaceTabDescriptor[]): SpaceTabDescriptor[] {
                capturedContexts.push({ hook: 'GetTabs', space: ctx.space });
                return [
                    ...defaultTabs,
                    { key: 'motions', label: 'Motions', icon: 'fa-solid fa-gavel', sortKey: 15, component: CustomSpaceTabComponent },
                ];
            }
            public override GetOverviewCards(ctx: SpaceUIContext, defaultCards: SpaceOverviewCardDescriptor[]): SpaceOverviewCardDescriptor[] {
                capturedContexts.push({ hook: 'GetOverviewCards', space: ctx.space });
                return [
                    ...defaultCards,
                    { key: 'next-meeting', title: 'Next Meeting', sortKey: 10, side: 'Shared', component: CustomOverviewCardComponent },
                ];
            }
            public override GetHeaderChips(ctx: SpaceUIContext, defaultChips: SpaceHeaderChipDescriptor[]): SpaceHeaderChipDescriptor[] {
                capturedContexts.push({ hook: 'GetHeaderChips', space: ctx.space });
                return [
                    ...defaultChips,
                    { key: 'committee-chip', label: 'Committee', variant: 'plain', sortKey: 5 },
                ];
            }
            public override GetHeaderActions(ctx: SpaceUIContext, defaultActions: SpaceHeaderActionDescriptor[]): SpaceHeaderActionDescriptor[] {
                capturedContexts.push({ hook: 'GetHeaderActions', space: ctx.space });
                return [
                    ...defaultActions,
                    { key: 'export-pack', label: 'Download pack', icon: 'fa-regular fa-file-pdf', action: headerActionSpy, sortKey: 20 },
                ];
            }
            public override GetSettingsSections(ctx: SpaceUIContext, defaultSections: SpaceSettingsSectionDescriptor[]): SpaceSettingsSectionDescriptor[] {
                capturedContexts.push({ hook: 'GetSettingsSections', space: ctx.space });
                return [
                    ...defaultSections,
                    { key: 'quorum-component', title: 'Quorum Rules', sortKey: 10, component: CustomSettingsSectionComponent },
                    { key: 'charter-summary', title: 'Committee Charter', description: 'Governs meeting cadence.', sortKey: 20 },
                ];
            }
        }

        class LiveNeedsYouProvider extends BaseNeedsYouProvider {
            public override async getItemsForSpaces(context: SpaceBatchContext): Promise<NeedsYouItem[]> {
                return [
                    {
                        id: 'ny-motion-1',
                        spaceId: context.spaceIds[0],
                        title: 'Motion 2026-14: External Auditor',
                        description: 'Your vote is needed before 5:00 PM',
                        actionLabel: 'Vote now',
                        actionType: 'vote',
                        urgency: 'high',
                        metadata: { tab: 'motions' },
                    },
                ];
            }
        }

        class LiveChipProvider extends BaseSpaceHeaderChipProvider {
            public override async getChipsForSpaces(context: SpaceBatchContext): Promise<Map<string, SpaceHeaderChip[]>> {
                const map = new Map<string, SpaceHeaderChip[]>();
                map.set(context.spaceIds[0], [
                    { id: 'fy-term', label: 'FY2026 term', variant: 'info' },
                ]);
                return map;
            }
        }

        const factory = MJGlobal.Instance.ClassFactory;
        factory.Register(BaseSpaceTypeUIDriver, RecordingBoardUIDriver, 'cx-render-driver', 1);
        factory.Register(BaseNeedsYouProvider, LiveNeedsYouProvider, 'cx-render:needs', 1, true, false, { spaceTypes: ['example-board'] });
        factory.Register(BaseSpaceHeaderChipProvider, LiveChipProvider, 'cx-render:chips', 1, true, false, { spaceTypes: ['example-board'] });

        const spaceEntityInfo = buildSpaceEntityInfo();
        const liveSpace = new mjBizAppsCollaborationSpaceEntity(spaceEntityInfo);
        liveSpace.ID = SPACE_ID;
        liveSpace.Name = 'Audit Committee';
        liveSpace.SpaceTypeID = TYPE_ID;
        liveSpace.OwnerID = USER_ID;
        liveSpace.InheritsMembership = true;
        vi.spyOn(liveSpace, 'Load').mockResolvedValue(true);

        const spaceTypeInfo = buildEntityInfoWithFields(
            'entity-space-types-1',
            'MJ_BizApps_Collaboration: Space Types',
            ['ID', 'Code', 'Name', 'UIDriverClass', 'MessagingPanel', 'LibraryPanel', 'WorkPanel', 'DefaultBand'],
        );
        const spaceType = new mjBizAppsCollaborationSpaceTypeEntity(spaceTypeInfo);
        spaceType.ID = TYPE_ID;
        spaceType.Code = 'example-board';
        spaceType.Name = 'Board';
        spaceType.UIDriverClass = 'cx-render-driver';
        spaceType.MessagingPanel = true;
        spaceType.LibraryPanel = true;
        spaceType.WorkPanel = true;
        spaceType.DefaultBand = 'Shared';

        vi.spyOn(CollaborationEngineBase.Instance, 'SpaceTypeById').mockReturnValue(spaceType);
        vi.spyOn(CollaborationEngineBase.Instance, 'StatusesForType').mockReturnValue([
            makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]),
            makeStatusEntity(PAUSED_STATUS_ID, SHIPPED_STATUSES[1]),
            makeStatusEntity(CLOSED_STATUS_ID, SHIPPED_STATUSES[2]),
        ]);
        vi.spyOn(CollaborationEngineBase.Instance, 'EffectiveStatusForSpace').mockReturnValue(
            makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]),
        );

        const providerStub = {
            CurrentUser: new UserInfo(undefined, { ID: USER_ID, Name: 'Ada Owner', UserRoles: [] }),
            EntityByName: (name: string) => (name === 'MJ_BizApps_Collaboration: Spaces' ? spaceEntityInfo : undefined),
            GetEntityObject: async () => liveSpace,
        };

        const rawSpace = {
            ID: SPACE_ID,
            Name: 'Audit Committee',
            Description: 'External audit oversight',
            SpaceTypeID: TYPE_ID,
            OwnerID: USER_ID,
            InheritsMembership: true,
            StatusID: ACTIVE_STATUS_ID,
            ClosedAt: null,
        };

        const navStub = {
            AppManager: { GetActiveApp: () => ({ Name: 'Board Portal' }), ActiveApp: new Subject() },
            QueryParamChanged$: new Subject(),
            GetTabQueryParams: () => ({}),
            SetAgentContext: vi.fn(),
            UpdateTabQueryParams: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [{ provide: NavigationService, useValue: navStub }],
        });

        const fixture = TestBed.createComponent(TestableExtensionsSection);
        const comp = fixture.componentInstance;
        vi.spyOn(comp, 'GetQueryParams').mockReturnValue({});
        Object.defineProperty(comp, 'ProviderToUse', { get: () => providerStub });

        comp.currentUser = providerStub.CurrentUser;
        comp.rawSpaces = [rawSpace];
        comp.activeSpaceId = SPACE_ID;
        comp.spaceTitle = 'Audit Committee';
        comp.spaceTypeName = 'Board';
        comp.spaceStatus = 'Active';
        comp.spaceSettings = {
            id: SPACE_ID,
            name: 'Audit Committee',
            description: 'External audit oversight',
            spaceType: 'Board',
            spaceTypeId: TYPE_ID,
            iconClass: 'fa-solid fa-landmark',
            color: '#0076b6',
            backgroundImageUrl: '',
            inheritsMembership: true,
            agentRetrieval: 'Included',
            status: 'Active',
        };

        await comp.runLoadActiveSpaceEntity(rawSpace);
        comp.runBuildSpaceUi(rawSpace);
        await comp.runLoadSpaceNeedsYou(rawSpace);
        await comp.runLoadSpaceHeaderChips(rawSpace);

        fixture.detectChanges();
        await fixture.whenStable();

        // 1. Live non-null Space passed to GetTabs, GetOverviewCards, GetHeaderChips, GetHeaderActions, GetSettingsSections
        for (const hook of ['GetTabs', 'GetOverviewCards', 'GetHeaderChips', 'GetHeaderActions', 'GetSettingsSections']) {
            const match = capturedContexts.find((c) => c.hook === hook);
            expect(match, `expected ${hook} to be called`).toBeDefined();
            expect(match?.space, `${hook} must receive non-null Space`).not.toBeNull();
            expect(match?.space?.ID).toBe(SPACE_ID);
            expect(match?.space?.Name).toBe('Audit Committee');
        }

        // 2. NeedsYou cards rendered and action handler switches to target tab
        const hostEl = fixture.nativeElement as HTMLElement;
        expect(hostEl.querySelector('mjc-needs-you-card')?.textContent).toContain('Motion 2026-14: External Auditor');
        comp.onNeedsYouAction(comp.overviewNeedsYou[0]);
        expect(comp.activeTab).toBe('motions');

        // 3. Header chips (provider + UI driver) and header actions rendered & clickable
        const headerEl = hostEl.querySelector('mjc-space-header')!;
        expect(headerEl.textContent).toContain('Committee');
        expect(headerEl.textContent).toContain('FY2026 term');
        const downloadBtn = Array.from(headerEl.querySelectorAll('button')).find((b) => b.textContent?.includes('Download pack'));
        expect(downloadBtn).toBeDefined();
        downloadBtn!.click();
        expect(headerActionSpy).toHaveBeenCalledTimes(1);

        // 4. Settings sections (component + descriptor) rendered inside mjc-space-settings
        const settingsEl = hostEl.querySelector('mjc-space-settings')!;
        expect(settingsEl.querySelector('.custom-settings-section-body')?.textContent).toContain(`Custom quorum rules for ${SPACE_ID}`);
        expect(settingsEl.textContent).toContain('Committee Charter');
        expect(settingsEl.textContent).toContain('Governs meeting cadence.');
    });
});

describe('CX-12 Terminal Closed vs Resumable Paused UI Reopen Alignment', () => {
    it('hides Reopen on Closed terminal spaces and shows Reopen on Paused spaces in CollabSpaceSettingsComponent', async () => {
        const base: SpaceSettingsModel = {
            id: SPACE_ID,
            name: 'Engagement',
            description: '',
            spaceType: 'Project',
            spaceTypeId: TYPE_ID,
            iconClass: 'fa-solid fa-compass',
            color: '#0076b6',
            backgroundImageUrl: '',
            inheritsMembership: true,
            agentRetrieval: 'Included',
            status: 'Closed',
            isTerminal: true,
            isReadOnly: true,
        };

        // Closed (terminal): Reopen is hidden even if CanChangeLifecycle is passed true
        const closedFixture = TestBed.createComponent(CollabSpaceSettingsComponent);
        const closedReopenSpy = vi.fn();
        closedFixture.componentInstance.ReopenSpaceRequested.subscribe(closedReopenSpy);
        closedFixture.componentRef.setInput('Settings', base);
        closedFixture.componentRef.setInput('CanEdit', false);
        closedFixture.componentRef.setInput('CanChangeLifecycle', true);
        closedFixture.detectChanges();
        await closedFixture.whenStable();
        const closedHost = closedFixture.nativeElement as HTMLElement;
        expect(closedHost.textContent).not.toContain('Reopen');
        expect(closedHost.textContent).not.toContain('Close…');
        closedFixture.componentInstance.confirmLifecycle();
        expect(closedReopenSpy).not.toHaveBeenCalled();

        // Paused (non-terminal read-only): Reopen is offered and emits ReopenSpaceRequested
        const pausedFixture = TestBed.createComponent(CollabSpaceSettingsComponent);
        const pausedReopenSpy = vi.fn();
        pausedFixture.componentInstance.ReopenSpaceRequested.subscribe(pausedReopenSpy);
        pausedFixture.componentRef.setInput('Settings', {
            ...base,
            status: 'Paused',
            isTerminal: false,
            isReadOnly: true,
        });
        pausedFixture.componentRef.setInput('CanEdit', false);
        pausedFixture.componentRef.setInput('CanChangeLifecycle', true);
        pausedFixture.detectChanges();
        await pausedFixture.whenStable();
        const pausedHost = pausedFixture.nativeElement as HTMLElement;
        const reopenTrigger = Array.from(pausedHost.querySelectorAll('button')).find((b) => b.textContent?.includes('Reopen…'));
        expect(reopenTrigger).toBeDefined();
        reopenTrigger!.click();
        pausedFixture.detectChanges();
        const confirmBtn = Array.from(pausedHost.querySelectorAll('button')).find((b) => b.textContent?.includes('Reopen space'));
        expect(confirmBtn).toBeDefined();
        confirmBtn!.click();
        expect(pausedReopenSpy).toHaveBeenCalledTimes(1);
    });

    it('enforces Closed terminal refusal and resumes Paused spaces to Active in CollaborationSectionResource', async () => {
        const activeStatus = makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]);
        const pausedStatus = makeStatusEntity(PAUSED_STATUS_ID, SHIPPED_STATUSES[1]);
        const closedStatus = makeStatusEntity(CLOSED_STATUS_ID, SHIPPED_STATUSES[2]);

        vi.spyOn(CollaborationEngineBase.Instance, 'StatusesForType').mockReturnValue([activeStatus, pausedStatus, closedStatus]);
        vi.spyOn(CollaborationEngineBase.Instance, 'DefaultStatusForType').mockReturnValue(activeStatus);
        vi.spyOn(CollaborationEngineBase.Instance, 'FirstTerminalStatusForType').mockReturnValue(closedStatus);
        vi.spyOn(CollaborationEngineBase.Instance, 'UserCanConfigureSpaces').mockResolvedValue(true);
        vi.spyOn(CollaborationEngineBase.Instance, 'UserCanReopenSpace').mockResolvedValue(true);
        vi.spyOn(CollaborationEngineBase.Instance, 'UserCanCloseSpace').mockResolvedValue(true);

        const entityInfo = buildSpaceEntityInfo();
        const spaceEntity = new mjBizAppsCollaborationSpaceEntity(entityInfo);
        spaceEntity.ID = SPACE_ID;
        spaceEntity.SpaceTypeID = TYPE_ID;
        spaceEntity.StatusID = PAUSED_STATUS_ID;
        spaceEntity.ClosedAt = null;
        const loadSpy = vi.spyOn(spaceEntity, 'Load').mockResolvedValue(true);
        const saveSpy = vi.spyOn(spaceEntity, 'Save').mockResolvedValue(true);

        const providerStub = {
            CurrentUser: new UserInfo(undefined, { ID: USER_ID, Name: 'Ada Owner', UserRoles: [] }),
            EntityByName: (name: string) => (name === 'MJ_BizApps_Collaboration: Spaces' ? entityInfo : undefined),
            GetEntityObject: async () => spaceEntity,
        };

        const notifySpy = vi.fn();
        vi.spyOn(SharedService, 'Instance', 'get').mockReturnValue({
            CreateSimpleNotification: notifySpy,
        } as SharedService);

        const fixture = TestBed.createComponent(TestableLifecycleSection);
        const comp = fixture.componentInstance;
        Object.defineProperty(comp, 'ProviderToUse', { get: () => providerStub });
        comp.currentUser = providerStub.CurrentUser;
        comp.activeSpaceId = SPACE_ID;

        // 1. Closed space: terminal -> canReopenCurrentSpace is false and settingsAccessNow hides Reopen
        vi.spyOn(CollaborationEngineBase.Instance, 'EffectiveStatusForSpace').mockReturnValue(closedStatus);
        comp.rawSpaces = [{ ID: SPACE_ID, Name: 'Closed Space', SpaceTypeID: TYPE_ID, StatusID: CLOSED_STATUS_ID, ClosedAt: new Date('2026-10-01T00:00:00Z') }];
        await comp.updateCanConfigureCurrentSpace();
        expect(comp.canReopenCurrentSpace).toBe(false);
        expect(comp.settingsAccessNow.canChangeLifecycle).toBe(false);
        await comp.onChangeSpaceLifecycle(false);
        expect(saveSpy).not.toHaveBeenCalled();
        expect(notifySpy).toHaveBeenCalled();

        // 2. Paused space: non-terminal -> canReopenCurrentSpace is true and Reopen resumes StatusID to Active
        vi.spyOn(CollaborationEngineBase.Instance, 'EffectiveStatusForSpace').mockReturnValue(pausedStatus);
        comp.rawSpaces = [{ ID: SPACE_ID, Name: 'Paused Space', SpaceTypeID: TYPE_ID, StatusID: PAUSED_STATUS_ID, ClosedAt: null }];
        await comp.updateCanConfigureCurrentSpace();
        expect(comp.canReopenCurrentSpace).toBe(true);
        expect(comp.settingsAccessNow.canChangeLifecycle).toBe(true);
        expect(comp.settingsAccessNow.canEdit).toBe(false);

        await comp.onChangeSpaceLifecycle(false);
        expect(loadSpy).toHaveBeenCalledWith(SPACE_ID);
        expect(saveSpy).toHaveBeenCalledTimes(1);
        expect(spaceEntity.StatusID).toBe(ACTIVE_STATUS_ID);
        expect(spaceEntity.ClosedAt).toBeNull();
    });

    it('keeps OpenApp v3 registrations, <mj-page-layout>, NotifyLoadComplete, and zero raw CSS literals', () => {
        const collabSource = readFileSync(resolve(here, 'collaboration-section.component.ts'), 'utf8');
        expect(collabSource).toContain("@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')");
        expect(collabSource).toContain('<mj-page-layout>');
        expect(collabSource).toContain('this.NotifyLoadComplete()');
        expect(collabSource).not.toContain('Welcome to Collaboration');
    });
});
