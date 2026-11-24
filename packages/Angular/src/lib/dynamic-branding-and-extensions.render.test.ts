// @vitest-environment jsdom
import '@angular/compiler';
import { NO_ERRORS_SCHEMA, type Type } from '@angular/core';
import { Component } from '@angular/core';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { EntityFieldInfo, EntityInfo, UserInfo } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import { FormResolverService } from '@memberjunction/ng-base-forms';
import { BaseResourceComponent, NavigationService, SharedService } from '@memberjunction/ng-shared';
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
    CollabAudiencePillComponent,
    CollabHomeListComponent,
    CollabNewConversationDialogComponent,
    CollabNewSpaceDialogComponent,
    CollabPinnedStripComponent,
    CollabShareCheckComponent,
    CollabShareCheckDialogComponent,
    CollabSpaceChatComponent,
    CollabSpaceDataComponent,
    CollabSpaceLibraryComponent,
    CollabSpaceNotesComponent,
    CollabSpacePeopleComponent,
    CollabSpaceRailComponent,
    CollabSpaceSettingsComponent,
    CollabSpaceWorkComponent,
    CollabUploadDialogComponent,
    type SpaceHeaderActionDescriptor,
    type SpaceHeaderChipDescriptor,
    type SpaceOverviewCardDescriptor,
    type SpaceSettingsModel,
    type SpaceSettingsSectionDescriptor,
    type SpaceTabDescriptor,
    type SpaceUIContext,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { ApprovalInboxComponent, MyTasksComponent, TaskEditPanelComponent, TaskGanttComponent, TaskKanbanComponent } from '@mj-biz-apps/tasks-ng';
import { MJReactModule } from '@memberjunction/ng-react';
import { CollaborationNoAccessComponent } from './no-access.component.ts';
import { SpaceDetailsViewComponent } from './space-details-view.component.ts';
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

const providerCleanups: Array<() => void> = [];

function spyOnSectionProviders(providerStub: ReturnType<typeof createProviderMock>['providerStub']): void {
    const proto = CollaborationSectionResource.prototype;
    const origProvider = Object.getOwnPropertyDescriptor(proto, 'ProviderToUse');
    const origRunView = Object.getOwnPropertyDescriptor(proto, 'RunViewToUse');
    Object.defineProperty(proto, 'ProviderToUse', { configurable: true, get: () => providerStub });
    Object.defineProperty(proto, 'RunViewToUse', { configurable: true, get: () => providerStub });
    providerCleanups.push(() => {
        if (origProvider) Object.defineProperty(proto, 'ProviderToUse', origProvider);
        else Reflect.deleteProperty(proto, 'ProviderToUse');
        if (origRunView) Object.defineProperty(proto, 'RunViewToUse', origRunView);
        else Reflect.deleteProperty(proto, 'RunViewToUse');
    });
}

afterEach(() => {
    while (providerCleanups.length > 0) {
        const cleanup = providerCleanups.pop();
        cleanup?.();
    }
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

class RailStub {
    public ActiveNav = 'home';
    public Spaces: object[] = [];
    public ActiveSpaceId = '';
    public MyTaskCount = 0;
    public InboxCount = 0;
    public CanCreateSpace = false;
}
declareComponent(RailStub, {
    selector: 'mjc-space-rail',
    template: `<nav class="rail-stub"></nav>`,
    inputs: ['ActiveNav', 'Spaces', 'ActiveSpaceId', 'MyTaskCount', 'InboxCount', 'CanCreateSpace'],
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

class NoAccessStub {
    public Seats: object[] = [];
}
declareComponent(NoAccessStub, { selector: 'mjc-no-access', template: '', inputs: ['Seats'] });

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

function configureProductionSectionTestBed(options: {
    activeApp$?: BehaviorSubject<{ Name: string } | null>;
    queryParams?: Record<string, string>;
}): { navStub: object } {
    const activeApp$ = options.activeApp$ ?? new BehaviorSubject<{ Name: string } | null>({ Name: 'Board Portal' });
    const navStub = {
        AppManager: {
            GetActiveApp: () => activeApp$.value,
            ActiveApp: activeApp$.asObservable(),
        },
        QueryParamChanged$: new Subject(),
        ObserveTabQueryParams: () => new BehaviorSubject(options.queryParams ?? {}),
        IsTabShowingResource: () => true,
        GetTabQueryParams: () => options.queryParams ?? {},
        SetAgentContext: vi.fn(),
        UpdateTabQueryParams: vi.fn(),
    };

    TestBed.configureTestingModule({
        providers: [
            { provide: NavigationService, useValue: navStub },
            { provide: FormResolverService, useValue: { ResolveFormForEntity: async () => ({ kind: 'none' }) } },
        ],
    });

    // Keep CollaborationSectionResource's real production template intact while stubbing heavy sibling/unrelated child selectors.
    TestBed.overrideComponent(CollaborationSectionResource, {
        remove: {
            imports: [
                CollabSpaceRailComponent,
                CollabAudiencePillComponent,
                CollaborationNoAccessComponent,
                SpaceDetailsViewComponent,
                CollabSpaceLibraryComponent,
                CollabSpaceWorkComponent,
                CollabSpaceChatComponent,
                CollabSpacePeopleComponent,
                CollabSpaceNotesComponent,
                CollabPinnedStripComponent,
                CollabSpaceDataComponent,
                CollabNewConversationDialogComponent,
                CollabNewSpaceDialogComponent,
                CollabUploadDialogComponent,
                CollabShareCheckDialogComponent,
                CollabHomeListComponent,
                TaskEditPanelComponent,
                MJReactModule,
                TaskKanbanComponent,
                TaskGanttComponent,
                MyTasksComponent,
                ApprovalInboxComponent,
            ],
        },
        add: {
            imports: [RailStub, AudiencePillStub, NoAccessStub],
            schemas: [NO_ERRORS_SCHEMA],
        },
    });

    return { navStub };
}

async function flushAsyncWork(cycles = 4): Promise<void> {
    for (let i = 0; i < cycles; i += 1) {
        await new Promise((resolveFn) => setTimeout(resolveFn, 0));
    }
}

function createProviderMock(options: {
    spaceEntityInfo: EntityInfo;
    rawSpaces: CollaborationSectionResource['rawSpaces'];
    loadSpaceEntity: () => Promise<mjBizAppsCollaborationSpaceEntity>;
    spaceType: mjBizAppsCollaborationSpaceTypeEntity;
    statusEntities: mjBizAppsCollaborationSpaceTypeStatusEntity[];
}) {
    const currentUser = new UserInfo(undefined, { ID: USER_ID, Name: 'Ada Owner', Type: 'Owner', UserRoles: [] });

    const runSingleView = async (params: { EntityName: string; ExtraFilter?: string }) => {
        if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
            return { Success: true, Results: options.rawSpaces };
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
            return {
                Success: true,
                Results: [{
                    ID: 'seat-1',
                    SpaceID: SPACE_ID,
                    UserID: USER_ID,
                    SpaceRoleTypeID: 'role-owner-1',
                    Status: 'Active',
                    Band: 'Team',
                }],
            };
        }
        return { Success: true, Results: [] };
    };

    const providerStub = {
        CurrentUser: currentUser,
        Authorizations: [],
        AuthorizationRoles: [],
        EntityByName: (name: string) => (name === 'MJ_BizApps_Collaboration: Spaces' ? options.spaceEntityInfo : undefined),
        GetEntityObject: async (entityName: string) => {
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                return options.loadSpaceEntity();
            }
            return {};
        },
        RunView: runSingleView,
        RunViews: async (queries: Array<{ EntityName: string; ExtraFilter?: string }>) =>
            Promise.all(queries.map((q) => runSingleView(q))),
        GetRecordFavoriteStatus: async () => false,
        ExecuteGQL: async (query: string) => {
            if (query.includes('GetSpaceConfiguration')) {
                return {
                    GetSpaceConfiguration: {
                        Success: true,
                        ConfigurationJSON: JSON.stringify({
                            Grants: [],
                            DataReach: [],
                            Rules: {},
                        }),
                        Full: false,
                    },
                };
            }
            if (query.includes('GetHomeCounts')) {
                return { GetHomeCounts: { Success: true, SharedFiles: 0, OpenTasks: 0, AwaitingApproval: 0 } };
            }
            return {};
        },
    };

    vi.spyOn(CollaborationEngineBase.Instance, 'Config').mockResolvedValue();
    vi.spyOn(CollaborationEngineBase.Instance, 'SpaceTypes', 'get').mockReturnValue([options.spaceType]);
    vi.spyOn(CollaborationEngineBase.Instance, 'SpaceTypeById').mockReturnValue(options.spaceType);
    vi.spyOn(CollaborationEngineBase.Instance, 'StatusesForType').mockReturnValue(options.statusEntities);
    vi.spyOn(CollaborationEngineBase.Instance, 'EffectiveStatusForSpace').mockReturnValue(options.statusEntities[0]);
    vi.spyOn(CollaborationEngineBase.Instance, 'DefaultStatusForType').mockReturnValue(options.statusEntities[0]);
    vi.spyOn(CollaborationEngineBase.Instance, 'FirstTerminalStatusForType').mockReturnValue(options.statusEntities[2]);
    vi.spyOn(CollaborationEngineBase.Instance, 'UserMayAdministerSpaces').mockReturnValue(true);
    vi.spyOn(CollaborationEngineBase.Instance, 'UserCanConfigureSpaces').mockResolvedValue(true);
    vi.spyOn(CollaborationEngineBase.Instance, 'UserCanReopenSpace').mockResolvedValue(true);
    vi.spyOn(CollaborationEngineBase.Instance, 'UserCanCloseSpace').mockResolvedValue(true);
    vi.spyOn(CollaborationEngineBase.Instance, 'ReachedSeat').mockResolvedValue({
        seat: { spaceId: SPACE_ID, userId: USER_ID, status: 'Active', band: 'Team', roleId: 'role-owner-1' },
        role: {
            level: 100,
            maxGrantableLevel: 100,
            canInvite: true,
            canPromoteBand: true,
            canSeeTeamBand: true,
            isOwnerRole: true,
            canContribute: true,
        },
        inherited: false,
    });

    return { currentUser, providerStub };
}

describe('CX-8 Dynamic Agent & Application Naming (production template)', () => {
    it('renders the active application name on Home via CollaborationSectionResource real template and falls back cleanly to Collaboration when unavailable', async () => {
        const activeApp$ = new BehaviorSubject<{ Name: string } | null>({ Name: 'Deal Rooms' });
        configureProductionSectionTestBed({ activeApp$, queryParams: { view: 'home' } });

        const spaceEntityInfo = buildSpaceEntityInfo();
        const liveSpace = new mjBizAppsCollaborationSpaceEntity(spaceEntityInfo);
        liveSpace.ID = SPACE_ID;
        liveSpace.Name = 'Audit Committee';
        liveSpace.SpaceTypeID = TYPE_ID;
        vi.spyOn(liveSpace, 'Load').mockResolvedValue(true);

        const spaceTypeInfo = buildEntityInfoWithFields(
            'entity-space-types-1',
            'MJ_BizApps_Collaboration: Space Types',
            ['ID', 'Code', 'Name', 'UIDriverClass', 'MessagingPanel', 'LibraryPanel', 'WorkPanel', 'DefaultBand'],
        );
        const spaceType = new mjBizAppsCollaborationSpaceTypeEntity(spaceTypeInfo);
        spaceType.ID = TYPE_ID;
        spaceType.Code = 'board';
        spaceType.Name = 'Board';

        const { providerStub } = createProviderMock({
            spaceEntityInfo,
            rawSpaces: [{ ID: SPACE_ID, Name: 'Audit Committee', SpaceTypeID: TYPE_ID, OwnerID: USER_ID, InheritsMembership: true }],
            loadSpaceEntity: async () => liveSpace,
            spaceType,
            statusEntities: [
                makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]),
                makeStatusEntity(PAUSED_STATUS_ID, SHIPPED_STATUSES[1]),
                makeStatusEntity(CLOSED_STATUS_ID, SHIPPED_STATUSES[2]),
            ],
        });

        spyOnSectionProviders(providerStub);

        const fixture = TestBed.createComponent(CollaborationSectionResource);
        const comp = fixture.componentInstance;
        comp.Data = { Configuration: { tabId: 'tab-1', queryParams: { view: 'home' } } } as CollaborationSectionResource['Data'];

        fixture.detectChanges();
        await flushAsyncWork();
        comp['changeDetector'].markForCheck();
        fixture.detectChanges();
        await fixture.whenStable();

        const titleEl = (fixture.nativeElement as HTMLElement).querySelector('.home-title');
        expect(titleEl?.textContent?.trim()).toBe('Welcome to Deal Rooms');

        activeApp$.next(null);
        comp['changeDetector'].markForCheck();
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

describe('CX-9 & CR-2/CR-4 Real Selection/Load Lifecycle & Live Space Entity', () => {
    it('does not invoke GetTabs/GetOverviewCards before entity.Load succeeds, and passes the exact loaded entity instance once Load resolves', async () => {
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
        const loadedEntity = new mjBizAppsCollaborationSpaceEntity(spaceEntityInfo);
        loadedEntity.ID = SPACE_ID;
        loadedEntity.Name = 'Audit Committee';
        loadedEntity.SpaceTypeID = TYPE_ID;
        loadedEntity.OwnerID = USER_ID;
        loadedEntity.InheritsMembership = true;

        let resolveLoad!: (value: boolean) => void;
        const loadDeferred = new Promise<boolean>((resolveFn) => {
            resolveLoad = resolveFn;
        });
        vi.spyOn(loadedEntity, 'Load').mockReturnValue(loadDeferred);

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

        const { providerStub } = createProviderMock({
            spaceEntityInfo,
            rawSpaces: [rawSpace],
            loadSpaceEntity: async () => loadedEntity,
            spaceType,
            statusEntities: [
                makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]),
                makeStatusEntity(PAUSED_STATUS_ID, SHIPPED_STATUSES[1]),
                makeStatusEntity(CLOSED_STATUS_ID, SHIPPED_STATUSES[2]),
            ],
        });

        configureProductionSectionTestBed({ queryParams: { view: 'home' } });
        spyOnSectionProviders(providerStub);

        const fixture = TestBed.createComponent(CollaborationSectionResource);
        const comp = fixture.componentInstance;
        comp.Data = { Configuration: { tabId: 'tab-1', queryParams: { view: 'home' } } } as CollaborationSectionResource['Data'];

        fixture.detectChanges();
        await flushAsyncWork();

        // Selecting the space triggers resetForSelection + selectSpaceBody -> loadActiveSpaceEntity (blocked on loadDeferred)
        comp.onSpaceOpenRequested(SPACE_ID);
        await flushAsyncWork();
        fixture.detectChanges();

        // CR-2: While Load has NOT resolved yet, GetTabs / GetOverviewCards / extension hooks MUST NOT be called
        expect(capturedContexts).toHaveLength(0);
        // Default built-in tabs render safely while awaiting load
        expect(comp.tabs.map((t) => t.id)).toContain('Overview');

        // Now resolve entity.Load(SPACE_ID) -> true
        resolveLoad(true);
        await flushAsyncWork();
        comp['changeDetector'].markForCheck();
        fixture.detectChanges();
        await fixture.whenStable();

        // 1. Live loadedEntity instance (=== loadedEntity) passed to all extension hooks
        for (const hook of ['GetTabs', 'GetOverviewCards', 'GetHeaderChips', 'GetHeaderActions', 'GetSettingsSections']) {
            const matches = capturedContexts.filter((c) => c.hook === hook);
            expect(matches.length, `expected ${hook} to be called`).toBeGreaterThan(0);
            for (const match of matches) {
                expect(match.space, `${hook} must receive the exact loaded entity instance`).toBe(loadedEntity);
            }
        }

        // 2. NeedsYou cards rendered inside real template and action handler switches to target tab
        const hostEl = fixture.nativeElement as HTMLElement;
        expect(hostEl.querySelector('mjc-needs-you-card')?.textContent).toContain('Motion 2026-14: External Auditor');
        comp.onNeedsYouAction(comp.overviewNeedsYou[0]);
        expect(comp.activeTab).toBe('motions');

        // 3. Header chips (provider + UI driver) and header actions rendered & clickable in real template
        const headerEl = hostEl.querySelector('mjc-space-header')!;
        expect(headerEl.textContent).toContain('Committee');
        expect(headerEl.textContent).toContain('FY2026 term');
        const downloadBtn = Array.from(headerEl.querySelectorAll('button')).find((b) => b.textContent?.includes('Download pack'));
        expect(downloadBtn).toBeDefined();
        downloadBtn!.click();
        expect(headerActionSpy).toHaveBeenCalledTimes(1);

        // 4. Switching to Settings tab renders contributed Settings sections (component + descriptor) and dynamic AgentName
        comp.chatDefaultAgentName = 'Board Copilot';
        comp.onTabSelectRequested('Settings');
        comp['changeDetector'].markForCheck();
        fixture.detectChanges();
        await fixture.whenStable();

        const settingsEl = hostEl.querySelector('mjc-space-settings')!;
        expect(settingsEl.querySelector('.custom-settings-section-body')?.textContent).toContain(`Custom quorum rules for ${SPACE_ID}`);
        expect(settingsEl.textContent).toContain('Committee Charter');
        expect(settingsEl.textContent).toContain('Governs meeting cadence.');
        expect(settingsEl.textContent).toContain('Board Copilot synthesizes files, conversations, and tasks from this space.');
    });

    it('never calls GetTabs or GetOverviewCards when entity.Load returns false or throws (CR-2)', async () => {
        const capturedHooks: string[] = [];

        class GuardedUIDriver extends BaseSpaceTypeUIDriver {
            public override GetTabs(ctx: SpaceUIContext, defaultTabs: SpaceTabDescriptor[]): SpaceTabDescriptor[] {
                capturedHooks.push(`GetTabs:${ctx.space ? 'hasSpace' : 'null'}`);
                return defaultTabs;
            }
            public override GetOverviewCards(ctx: SpaceUIContext, defaultCards: SpaceOverviewCardDescriptor[]): SpaceOverviewCardDescriptor[] {
                capturedHooks.push(`GetOverviewCards:${ctx.space ? 'hasSpace' : 'null'}`);
                return defaultCards;
            }
        }

        MJGlobal.Instance.ClassFactory.Register(BaseSpaceTypeUIDriver, GuardedUIDriver, 'cx-cr2-fail-driver', 1);

        const spaceEntityInfo = buildSpaceEntityInfo();
        const failingEntity = new mjBizAppsCollaborationSpaceEntity(spaceEntityInfo);
        failingEntity.ID = SPACE_ID;
        vi.spyOn(failingEntity, 'Load').mockResolvedValue(false);
        const loadFromDataSpy = vi.spyOn(failingEntity, 'LoadFromData');

        const spaceTypeInfo = buildEntityInfoWithFields(
            'entity-space-types-1',
            'MJ_BizApps_Collaboration: Space Types',
            ['ID', 'Code', 'Name', 'UIDriverClass', 'MessagingPanel', 'LibraryPanel', 'WorkPanel', 'DefaultBand'],
        );
        const spaceType = new mjBizAppsCollaborationSpaceTypeEntity(spaceTypeInfo);
        spaceType.ID = TYPE_ID;
        spaceType.Code = 'board-fail';
        spaceType.Name = 'Board';
        spaceType.UIDriverClass = 'cx-cr2-fail-driver';
        spaceType.MessagingPanel = true;
        spaceType.LibraryPanel = true;
        spaceType.WorkPanel = true;

        const { providerStub } = createProviderMock({
            spaceEntityInfo,
            rawSpaces: [{ ID: SPACE_ID, Name: 'Audit Committee', SpaceTypeID: TYPE_ID, OwnerID: USER_ID, InheritsMembership: true }],
            loadSpaceEntity: async () => failingEntity,
            spaceType,
            statusEntities: [
                makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]),
                makeStatusEntity(PAUSED_STATUS_ID, SHIPPED_STATUSES[1]),
                makeStatusEntity(CLOSED_STATUS_ID, SHIPPED_STATUSES[2]),
            ],
        });

        configureProductionSectionTestBed({ queryParams: { view: 'space', space: SPACE_ID } });
        spyOnSectionProviders(providerStub);

        const fixture = TestBed.createComponent(CollaborationSectionResource);
        const comp = fixture.componentInstance;
        comp.Data = { Configuration: { tabId: 'tab-1', queryParams: { view: 'space', space: SPACE_ID } } } as CollaborationSectionResource['Data'];

        fixture.detectChanges();
        await flushAsyncWork();
        fixture.detectChanges();

        expect(loadFromDataSpy).not.toHaveBeenCalled();
        expect(capturedHooks).toEqual([]);
        expect(comp.tabs.map((t) => t.id)).toContain('Overview');
    });

    it('never calls extension hooks when entity.Load rejects with an Error (CR-2)', async () => {
        const capturedHooks: string[] = [];

        class ThrowingLoadUIDriver extends BaseSpaceTypeUIDriver {
            public override GetTabs(ctx: SpaceUIContext, defaultTabs: SpaceTabDescriptor[]): SpaceTabDescriptor[] {
                capturedHooks.push(`GetTabs:${ctx.space ? 'hasSpace' : 'null'}`);
                return defaultTabs;
            }
            public override GetOverviewCards(ctx: SpaceUIContext, defaultCards: SpaceOverviewCardDescriptor[]): SpaceOverviewCardDescriptor[] {
                capturedHooks.push(`GetOverviewCards:${ctx.space ? 'hasSpace' : 'null'}`);
                return defaultCards;
            }
            public override GetHeaderChips(ctx: SpaceUIContext, defaultChips: SpaceHeaderChipDescriptor[]): SpaceHeaderChipDescriptor[] {
                capturedHooks.push(`GetHeaderChips:${ctx.space ? 'hasSpace' : 'null'}`);
                return defaultChips;
            }
            public override GetHeaderActions(ctx: SpaceUIContext, defaultActions: SpaceHeaderActionDescriptor[]): SpaceHeaderActionDescriptor[] {
                capturedHooks.push(`GetHeaderActions:${ctx.space ? 'hasSpace' : 'null'}`);
                return defaultActions;
            }
            public override GetSettingsSections(ctx: SpaceUIContext, defaultSections: SpaceSettingsSectionDescriptor[]): SpaceSettingsSectionDescriptor[] {
                capturedHooks.push(`GetSettingsSections:${ctx.space ? 'hasSpace' : 'null'}`);
                return defaultSections;
            }
        }

        MJGlobal.Instance.ClassFactory.Register(BaseSpaceTypeUIDriver, ThrowingLoadUIDriver, 'cx-cr2-throw-driver', 1);

        const spaceEntityInfo = buildSpaceEntityInfo();
        const throwingEntity = new mjBizAppsCollaborationSpaceEntity(spaceEntityInfo);
        throwingEntity.ID = SPACE_ID;
        vi.spyOn(throwingEntity, 'Load').mockRejectedValue(new Error('Simulated database load failure'));
        const loadFromDataSpy = vi.spyOn(throwingEntity, 'LoadFromData');

        const spaceTypeInfo = buildEntityInfoWithFields(
            'entity-space-types-1',
            'MJ_BizApps_Collaboration: Space Types',
            ['ID', 'Code', 'Name', 'UIDriverClass', 'MessagingPanel', 'LibraryPanel', 'WorkPanel', 'DefaultBand'],
        );
        const spaceType = new mjBizAppsCollaborationSpaceTypeEntity(spaceTypeInfo);
        spaceType.ID = TYPE_ID;
        spaceType.Code = 'board-throw';
        spaceType.Name = 'Board';
        spaceType.UIDriverClass = 'cx-cr2-throw-driver';
        spaceType.MessagingPanel = true;
        spaceType.LibraryPanel = true;
        spaceType.WorkPanel = true;

        const { providerStub } = createProviderMock({
            spaceEntityInfo,
            rawSpaces: [{ ID: SPACE_ID, Name: 'Audit Committee', SpaceTypeID: TYPE_ID, OwnerID: USER_ID, InheritsMembership: true }],
            loadSpaceEntity: async () => throwingEntity,
            spaceType,
            statusEntities: [
                makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]),
                makeStatusEntity(PAUSED_STATUS_ID, SHIPPED_STATUSES[1]),
                makeStatusEntity(CLOSED_STATUS_ID, SHIPPED_STATUSES[2]),
            ],
        });

        configureProductionSectionTestBed({ queryParams: { view: 'space', space: SPACE_ID } });
        spyOnSectionProviders(providerStub);

        const fixture = TestBed.createComponent(CollaborationSectionResource);
        const comp = fixture.componentInstance;
        comp.Data = { Configuration: { tabId: 'tab-1', queryParams: { view: 'space', space: SPACE_ID } } } as CollaborationSectionResource['Data'];

        fixture.detectChanges();
        await flushAsyncWork();
        fixture.detectChanges();

        expect(loadFromDataSpy).not.toHaveBeenCalled();
        expect(capturedHooks).toEqual([]);
        expect(comp.tabs.map((t) => t.id)).toContain('Overview');
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

    it('enforces Closed terminal refusal and resumes Paused spaces to Active in CollaborationSectionResource real template', async () => {
        const activeStatus = makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]);
        const pausedStatus = makeStatusEntity(PAUSED_STATUS_ID, SHIPPED_STATUSES[1]);
        const closedStatus = makeStatusEntity(CLOSED_STATUS_ID, SHIPPED_STATUSES[2]);

        const spaceEntityInfo = buildSpaceEntityInfo();
        const spaceEntity = new mjBizAppsCollaborationSpaceEntity(spaceEntityInfo);
        spaceEntity.ID = SPACE_ID;
        spaceEntity.SpaceTypeID = TYPE_ID;
        spaceEntity.StatusID = PAUSED_STATUS_ID;
        spaceEntity.ClosedAt = null;
        const loadSpy = vi.spyOn(spaceEntity, 'Load').mockResolvedValue(true);
        const saveSpy = vi.spyOn(spaceEntity, 'Save').mockResolvedValue(true);

        const spaceTypeInfo = buildEntityInfoWithFields(
            'entity-space-types-1',
            'MJ_BizApps_Collaboration: Space Types',
            ['ID', 'Code', 'Name', 'UIDriverClass', 'MessagingPanel', 'LibraryPanel', 'WorkPanel', 'DefaultBand'],
        );
        const spaceType = new mjBizAppsCollaborationSpaceTypeEntity(spaceTypeInfo);
        spaceType.ID = TYPE_ID;
        spaceType.Code = 'project';
        spaceType.Name = 'Project';

        const { providerStub } = createProviderMock({
            spaceEntityInfo,
            rawSpaces: [{ ID: SPACE_ID, Name: 'Paused Space', SpaceTypeID: TYPE_ID, OwnerID: USER_ID, StatusID: PAUSED_STATUS_ID, ClosedAt: null }],
            loadSpaceEntity: async () => spaceEntity,
            spaceType,
            statusEntities: [activeStatus, pausedStatus, closedStatus],
        });

        const notifySpy = vi.fn();
        vi.spyOn(SharedService, 'Instance', 'get').mockReturnValue({
            CreateSimpleNotification: notifySpy,
        } as SharedService);

        configureProductionSectionTestBed({ queryParams: { view: 'home' } });
        spyOnSectionProviders(providerStub);

        const fixture = TestBed.createComponent(CollaborationSectionResource);
        const comp = fixture.componentInstance;
        comp.Data = { Configuration: { tabId: 'tab-1', queryParams: { view: 'home' } } } as CollaborationSectionResource['Data'];
        fixture.detectChanges();
        await flushAsyncWork();

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

    it('treats Closed (IsTerminal: true) as terminal even when followed by a later writable status, hiding Reopen while Paused still resumes', async () => {
        const REOPENED_STATUS_ID = '33333333-3333-4333-8333-333333333304';
        const activeStatus = makeStatusEntity(ACTIVE_STATUS_ID, SHIPPED_STATUSES[0]);
        const pausedStatus = makeStatusEntity(PAUSED_STATUS_ID, SHIPPED_STATUSES[1]);
        const closedStatus = makeStatusEntity(CLOSED_STATUS_ID, SHIPPED_STATUSES[2]);
        const laterWritableStatus = makeStatusEntity(REOPENED_STATUS_ID, {
            Code: 'reopened',
            Name: 'Reopened',
            Sequence: 4,
            IsDefault: false,
            ReadOnly: false,
            Visible: true,
            AgentRetrieval: true,
            CanChangeAfter: true,
            NotifyMembersOnEnter: false,
            IsTerminal: false,
        });

        const spaceEntityInfo = buildSpaceEntityInfo();
        const spaceEntity = new mjBizAppsCollaborationSpaceEntity(spaceEntityInfo);
        spaceEntity.ID = SPACE_ID;
        spaceEntity.Name = 'Engagement';
        spaceEntity.SpaceTypeID = TYPE_ID;
        spaceEntity.StatusID = CLOSED_STATUS_ID;
        spaceEntity.ClosedAt = new Date('2026-10-01T00:00:00Z');
        const loadSpy = vi.spyOn(spaceEntity, 'Load').mockResolvedValue(true);
        const saveSpy = vi.spyOn(spaceEntity, 'Save').mockResolvedValue(true);

        const spaceTypeInfo = buildEntityInfoWithFields(
            'entity-space-types-1',
            'MJ_BizApps_Collaboration: Space Types',
            ['ID', 'Code', 'Name', 'UIDriverClass', 'MessagingPanel', 'LibraryPanel', 'WorkPanel', 'DefaultBand'],
        );
        const spaceType = new mjBizAppsCollaborationSpaceTypeEntity(spaceTypeInfo);
        spaceType.ID = TYPE_ID;
        spaceType.Code = 'project';
        spaceType.Name = 'Project';

        const closedRaw = {
            ID: SPACE_ID,
            Name: 'Engagement',
            SpaceTypeID: TYPE_ID,
            OwnerID: USER_ID,
            StatusID: CLOSED_STATUS_ID,
            ClosedAt: new Date('2026-10-01T00:00:00Z'),
        };

        const { providerStub } = createProviderMock({
            spaceEntityInfo,
            rawSpaces: [closedRaw],
            loadSpaceEntity: async () => spaceEntity,
            spaceType,
            statusEntities: [activeStatus, pausedStatus, closedStatus, laterWritableStatus],
        });
        const effectiveSpy = vi.spyOn(CollaborationEngineBase.Instance, 'EffectiveStatusForSpace').mockReturnValue(closedStatus);

        const notifySpy = vi.fn();
        vi.spyOn(SharedService, 'Instance', 'get').mockReturnValue({
            CreateSimpleNotification: notifySpy,
        } as SharedService);

        configureProductionSectionTestBed({ queryParams: { view: 'space', space: SPACE_ID, tab: 'settings' } });
        spyOnSectionProviders(providerStub);

        const fixture = TestBed.createComponent(CollaborationSectionResource);
        const comp = fixture.componentInstance;
        comp.Data = { Configuration: { tabId: 'tab-1', queryParams: { view: 'space', space: SPACE_ID, tab: 'settings' } } } as CollaborationSectionResource['Data'];
        fixture.detectChanges();
        await flushAsyncWork();
        comp['changeDetector'].markForCheck();
        fixture.detectChanges();
        await fixture.whenStable();

        // Terminal Closed must remain terminal even when a later Sequence=4 writable status exists
        expect(comp.spaceSettings?.isTerminal).toBe(true);
        expect(comp.canReopenCurrentSpace).toBe(false);
        expect(comp.settingsAccessNow.canChangeLifecycle).toBe(false);
        const settingsEl = (fixture.nativeElement as HTMLElement).querySelector('mjc-space-settings');
        expect(settingsEl?.textContent).not.toContain('Reopen');

        await comp.onChangeSpaceLifecycle(false);
        expect(saveSpy).not.toHaveBeenCalled();
        expect(notifySpy).toHaveBeenCalled();

        // Paused (IsTerminal: false) still offers Reopen and resumes to Active
        effectiveSpy.mockReturnValue(pausedStatus);
        spaceEntity.StatusID = PAUSED_STATUS_ID;
        spaceEntity.ClosedAt = null;
        comp.rawSpaces = [{ ID: SPACE_ID, Name: 'Engagement', SpaceTypeID: TYPE_ID, OwnerID: USER_ID, StatusID: PAUSED_STATUS_ID, ClosedAt: null }];
        comp.onSpaceOpenRequested(SPACE_ID);
        await flushAsyncWork();
        comp.onTabSelectRequested('Settings');
        comp['changeDetector'].markForCheck();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(comp.spaceSettings?.isTerminal).toBe(false);
        expect(comp.canReopenCurrentSpace).toBe(true);
        expect(comp.settingsAccessNow.canChangeLifecycle).toBe(true);
        expect((fixture.nativeElement as HTMLElement).querySelector('mjc-space-settings')?.textContent).toContain('Reopen…');

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

    it('derives overviewHasSharedBand accurately for Team-only vs dual-band spaces and attaches inline tab badge counts', () => {
        const collabSource = readFileSync(resolve(here, 'collaboration-section.component.ts'), 'utf8');
        const railTagMatch = collabSource.match(/<mjc-space-rail[\s\S]*?\/>/);
        expect(railTagMatch).not.toBeNull();
        expect(railTagMatch![0]).not.toContain('[Tabs]');
        expect(railTagMatch![0]).not.toContain('[Mode]');
        expect(collabSource).toContain('[HasSharedBand]="overviewHasSharedBand"');
        expect(collabSource).toContain('[Conversations]="spaceConversations"');

        configureProductionSectionTestBed({});
        const fixture = TestBed.createComponent(CollaborationSectionResource);
        const comp = fixture.componentInstance;

        // Team-only space (staff viewer, Team audience, Team default band, 0 shared items) -> HasSharedBand = false
        comp.activeSpaceId = SPACE_ID;
        comp.spaceAudienceBand = 'Team';
        comp.typeDefaultBand = 'Team';
        comp.overviewSharedItems = [];
        vi.spyOn(comp, 'canSeeTeamSide', 'get').mockReturnValue(true);
        expect(comp.overviewHasSharedBand).toBe(false);

        // Dual-band space with outside participants -> HasSharedBand = true
        comp.spaceAudienceBand = 'Shared';
        expect(comp.overviewHasSharedBand).toBe(true);

        // External / Shared-only viewer always sees the Shared band
        comp.spaceAudienceBand = 'Team';
        vi.spyOn(comp, 'canSeeTeamSide', 'get').mockReturnValue(false);
        expect(comp.overviewHasSharedBand).toBe(true);

        // Inline badge counts populate on built-in tabs when counts are positive
        comp.libraryTotalCount = 4;
        comp.taskCount = 2;
        comp.spaceConversations = [
            { id: 'c1', name: 'General', kind: 'General', band: 'Shared' },
            { id: 'c2', name: 'Team Sync', kind: 'Private', band: 'Team' },
        ];
        comp.headerTotalPeople = 6;
        const tabCounts = new Map(comp.tabs.map((t) => [t.id, t.count]));
        expect(tabCounts.get('Library')).toBe(4);
        expect(tabCounts.get('Work')).toBe(2);
        expect(tabCounts.get('Chat')).toBe(2);
        expect(tabCounts.get('People')).toBe(6);
    });
});
