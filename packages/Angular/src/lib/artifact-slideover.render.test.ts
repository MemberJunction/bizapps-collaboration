/**
 * SPDX-License-Identifier: BUSL-1.1
 *
 * Tests for in-place `<mjc-artifact-slideover>` wiring in `CollaborationSectionResource` across:
 * (a) `<mjc-pinned-strip>` (`onPinOpen` / `showPinTarget`),
 * (b) `Home -> My pins` (`loadHomePins` + `onHomeRowSelected`),
 * (c) Space `Overview` & `Library` `MJ: Artifacts` items,
 * (d) Space Chat cited `SourceReceipts` & durable `[[` artifact links, and
 * (e) `CollabContributedTabHostDirective` custom `BaseSpaceTab` artifact handoff.
 */
// @vitest-environment jsdom
import '@angular/compiler';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import {
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    UserInfo,
} from '@memberjunction/core';
import { SharedService } from '@memberjunction/ng-shared';
import {
    BaseSpaceTab,
    type LibraryRowModel,
    type PinModel,
    type SpaceArtifactOpenCallback,
    type SpaceArtifactOpenRequest,
    type SpaceChatAnswerSourceReceipt,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { CollaborationSectionResource } from './collaboration-section.component.ts';
import { CollabContributedTabHostDirective } from './contributed-tab-host.directive.ts';

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SPACE_ID = '22222222-2222-4222-8222-222222222222';
const ARTIFACT_ENTITY_ID = '33333333-3333-4333-8333-333333333333';
const SPACE_ITEMS_ENTITY_ID = '44444444-4444-4444-8444-444444444444';
const NOTES_ENTITY_ID = '55555555-5555-4555-8555-555555555555';
const ARTIFACT_1_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ARTIFACT_2_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const SPACE_ITEM_1_ID = 'cccccccc-3333-4333-8333-333333333333';

interface ResourceInternals {
    ProviderToUse: IMetadataProvider;
    RunViewToUse: IRunViewProvider;
    currentUser: UserInfo | null;
    rawSpaces: Array<{ ID: string; Name: string; SpaceTypeID: string }>;
    libraryRows: LibraryRowModel[];
    homePins: PinModel[];
    homeList: 'approvals' | 'tasks' | 'pins' | null;
    activeView: string;
    activeSpaceId: string;
    activeTab: string;
    isArtifactSlideoverOpen: boolean;
    activeArtifactSlideoverId: string | null;
    activeArtifactSlideoverTitle: string;
    changeDetector: ChangeDetectorRef;
    UpdateQueryParams: (params: Record<string, string | null>) => void;
    RefreshView: () => void;
    recordSpaceItemOpen: (itemId: string) => Promise<boolean>;
    homeListLoadToken: number;
    isLoadingHomeList: boolean;
    homeListError: string;
    refreshHomeListRows: () => void;
    logOnce: () => void;
    hasTab: (name: string) => boolean;
    onPinOpen: (pin: PinModel) => void;
    loadHomePins: () => Promise<void>;
    onHomeRowSelected: (key: string) => void;
    onItemSelected: (item: { id: string; kind: string; title: string; meta: string; stamp: string; artifactId?: string }) => void;
    onRowSelected: (row: LibraryRowModel) => void;
    onChatSourceReceiptOpen: (receipt: SpaceChatAnswerSourceReceipt) => void;
    onOpenRecordLink: (link: { entityName: string; keys: Record<string, string | number> }) => void;
    closeArtifactSlideover: () => void;
}

function createHostHarness(runViewImpl?: (params: RunViewParams) => Promise<RunViewResult<object>>) {
    const entityMap = new Map<string, EntityInfo>([
        ['MJ: Artifacts', { ID: ARTIFACT_ENTITY_ID, Name: 'MJ: Artifacts', PrimaryKeys: [{ Name: 'ID' }] } as EntityInfo],
        ['MJ_BizApps_Collaboration: Space Items', { ID: SPACE_ITEMS_ENTITY_ID, Name: 'MJ_BizApps_Collaboration: Space Items', PrimaryKeys: [{ Name: 'ID' }] } as EntityInfo],
        ['MJ_BizApps_Collaboration: Space Notes', { ID: NOTES_ENTITY_ID, Name: 'MJ_BizApps_Collaboration: Space Notes', PrimaryKeys: [{ Name: 'ID' }] } as EntityInfo],
    ]);

    const provider = {
        EntityByName: (name: string) => entityMap.get(name),
    } as IMetadataProvider;

    const runViewProvider: IRunViewProvider = {
        RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
            if (runViewImpl) {
                return (await runViewImpl(params)) as RunViewResult<T>;
            }
            return { Success: true, Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 0, ErrorMessage: '' };
        },
        RunViews: async <T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> =>
            Promise.all(paramsList.map((p) => runViewProvider.RunView<T>(p))),
    };

    const instance = Object.create(CollaborationSectionResource.prototype) as ResourceInternals;
    Object.defineProperty(instance, 'ProviderToUse', { value: provider, configurable: true });
    Object.defineProperty(instance, 'RunViewToUse', { value: runViewProvider, configurable: true });
    instance.currentUser = Object.assign(new UserInfo(), { ID: USER_ID, Name: 'Dana Whitfield' });
    instance.rawSpaces = [{ ID: SPACE_ID, Name: 'Executive Briefing', SpaceTypeID: 'st-1' }];
    instance.libraryRows = [
        {
            id: SPACE_ITEM_1_ID,
            artifactId: ARTIFACT_2_ID,
            entityName: 'MJ: Artifacts',
            artifactType: 'Presentation',
            kind: 'ppt',
            name: 'Q4 Strategy Deck',
            folder: 'Briefings',
            band: 'Shared',
            who: 'Dana',
            when: 'Today',
        },
    ];
    instance.homePins = [];
    instance.homeList = null;
    instance.activeView = 'space';
    instance.activeSpaceId = SPACE_ID;
    instance.activeTab = 'Overview';
    instance.isArtifactSlideoverOpen = false;
    instance.activeArtifactSlideoverId = null;
    instance.activeArtifactSlideoverTitle = '';
    const updateQueryParams = vi.fn();
    const recordOpen = vi.fn().mockResolvedValue(true);
    instance.UpdateQueryParams = updateQueryParams;
    instance.RefreshView = vi.fn();
    instance.recordSpaceItemOpen = recordOpen;
    instance.homeListLoadToken = 0;
    instance.isLoadingHomeList = false;
    instance.homeListError = '';
    instance.refreshHomeListRows = vi.fn();
    instance.logOnce = vi.fn();
    instance.hasTab = () => true;

    const openEntitySpy = vi.fn();
    vi.spyOn(SharedService, 'Instance', 'get').mockReturnValue({
        OpenEntityRecord: openEntitySpy,
        CreateSimpleNotification: vi.fn(),
    } as Partial<SharedService> as SharedService);

    return { instance, updateQueryParams, recordOpen, openEntitySpy };
}

@Component({
    selector: 'mjc-test-custom-artifact-tab',
    standalone: true,
    template: `<button type="button" data-testid="custom-tab-open" (click)="trigger()">Open</button>`,
})
class CustomArtifactTabStub extends BaseSpaceTab {
    @Input() public override OpenArtifact?: SpaceArtifactOpenCallback;
    @Output() public override OpenArtifactRequested = new EventEmitter<SpaceArtifactOpenRequest>();

    public trigger(): void {
        this.OpenArtifactRequested.emit({ artifactId: ARTIFACT_1_ID, title: 'Custom Tab Deck' });
    }
}

@Component({
    selector: 'mjc-test-tab-host-wrapper',
    standalone: true,
    imports: [CollabContributedTabHostDirective],
    template: `
        <ng-container
            [mjcContributedTabHost]="tabType"
            [TabInputs]="{ SpaceId: 'sp-1', OpenArtifact: openCb }"
            (OpenArtifactRequested)="opened.push($event)"
        ></ng-container>
    `,
})
class TabHostWrapperComponent {
    public tabType = CustomArtifactTabStub;
    public opened: SpaceArtifactOpenRequest[] = [];
    public openCb: SpaceArtifactOpenCallback = vi.fn();
}

describe('CollaborationSectionResource in-place artifact slide-over wiring', () => {
    it('(a) opens <mjc-artifact-slideover> in-place from onPinOpen for direct MJ: Artifacts pins and SpaceItem-wrapped artifacts without altering the route', () => {
        const { instance, updateQueryParams, openEntitySpy } = createHostHarness();

        // Direct artifact pin
        instance.onPinOpen({
            id: 'pin-1',
            kind: 'Record',
            title: 'Board Memo',
            subtitle: 'Markdown Document',
            iconClass: 'fa-solid fa-file-lines',
            target: `artifact:${ARTIFACT_1_ID}`,
            spaceId: SPACE_ID,
            spaceName: 'Executive Briefing',
        });
        expect(instance.isArtifactSlideoverOpen).toBe(true);
        expect(instance.activeArtifactSlideoverId).toBe(ARTIFACT_1_ID);
        expect(instance.activeArtifactSlideoverTitle).toBe('Board Memo');
        expect(instance.activeTab).toBe('Overview');
        expect(updateQueryParams).not.toHaveBeenCalled();
        expect(openEntitySpy).not.toHaveBeenCalled();

        instance.closeArtifactSlideover();
        expect(instance.isArtifactSlideoverOpen).toBe(false);

        // SpaceItem pin wrapping an MJ: Artifacts record
        instance.onPinOpen({
            id: 'pin-2',
            kind: 'Record',
            title: 'Q4 Strategy Deck',
            subtitle: 'Presentation',
            iconClass: 'fa-solid fa-file-powerpoint',
            target: `item:${SPACE_ITEM_1_ID}`,
            spaceId: SPACE_ID,
            spaceName: 'Executive Briefing',
        });
        expect(instance.isArtifactSlideoverOpen).toBe(true);
        expect(instance.activeArtifactSlideoverId).toBe(ARTIFACT_2_ID);
        expect(instance.activeTab).toBe('Overview');
        expect(updateQueryParams).not.toHaveBeenCalled();
    });

    it('(b) resolves Artifact titles in Home -> My pins for both direct MJ: Artifacts pins and Space Items wrapping MJ: Artifacts, and opens the slide-over in-place', async () => {
        const { instance, updateQueryParams, openEntitySpy } = createHostHarness(async (params) => {
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Member Pins') {
                return {
                    Success: true,
                    Results: [
                        {
                            ID: 'pin-direct-art',
                            SpaceID: SPACE_ID,
                            UserID: USER_ID,
                            Kind: 'Record',
                            TargetEntityID: ARTIFACT_ENTITY_ID,
                            TargetRecordID: `ID|${ARTIFACT_1_ID}`,
                            GrantID: null,
                            Sequence: 1,
                        },
                        {
                            ID: 'pin-wrapped-art',
                            SpaceID: SPACE_ID,
                            UserID: USER_ID,
                            Kind: 'Record',
                            TargetEntityID: SPACE_ITEMS_ENTITY_ID,
                            TargetRecordID: SPACE_ITEM_1_ID,
                            GrantID: null,
                            Sequence: 2,
                        },
                    ],
                    RowCount: 2,
                    TotalRowCount: 2,
                    ExecutionTime: 0,
                    ErrorMessage: '',
                };
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                return {
                    Success: true,
                    Results: [
                        {
                            ID: SPACE_ITEM_1_ID,
                            EntityID: ARTIFACT_ENTITY_ID,
                            Entity: 'MJ: Artifacts',
                            RecordID: `ID|${ARTIFACT_2_ID}`,
                        },
                    ],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 0,
                    ErrorMessage: '',
                };
            }
            if (params.EntityName === 'MJ: Artifacts') {
                return {
                    Success: true,
                    Results: [
                        { ID: ARTIFACT_1_ID, Name: 'Annual Operating Plan', Type: 'Markdown Document' },
                        { ID: ARTIFACT_2_ID, Name: 'Q4 Strategy Deck', Type: 'Presentation' },
                    ],
                    RowCount: 2,
                    TotalRowCount: 2,
                    ExecutionTime: 0,
                    ErrorMessage: '',
                };
            }
            return { Success: true, Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 0, ErrorMessage: '' };
        });

        instance.activeView = 'home';
        instance.homeList = 'pins';
        await instance.loadHomePins();

        expect(instance.homePins).toHaveLength(2);
        expect(instance.homePins[0]).toMatchObject({
            id: 'pin-direct-art',
            title: 'Annual Operating Plan',
            subtitle: 'Markdown Document',
            target: `artifact:${ARTIFACT_1_ID}`,
        });
        expect(instance.homePins[1]).toMatchObject({
            id: 'pin-wrapped-art',
            title: 'Q4 Strategy Deck',
            subtitle: 'Presentation',
            iconClass: 'fa-solid fa-file-powerpoint',
            target: `artifact:${ARTIFACT_2_ID}`,
        });

        instance.onHomeRowSelected('pin-wrapped-art');
        expect(instance.activeView).toBe('home');
        expect(instance.isArtifactSlideoverOpen).toBe(true);
        expect(instance.activeArtifactSlideoverId).toBe(ARTIFACT_2_ID);
        expect(instance.activeArtifactSlideoverTitle).toBe('Q4 Strategy Deck');
        expect(updateQueryParams).not.toHaveBeenCalled();
        expect(openEntitySpy).not.toHaveBeenCalled();
    });

    it('(c) opens Overview and Library MJ: Artifacts items in-place without switching tabs or mutating query params', () => {
        const { instance, updateQueryParams, recordOpen } = createHostHarness();

        instance.onItemSelected({
            id: SPACE_ITEM_1_ID,
            kind: 'ppt',
            title: 'Q4 Strategy Deck',
            meta: 'Briefings · Shared',
            stamp: 'Today',
        });
        expect(instance.isArtifactSlideoverOpen).toBe(true);
        expect(instance.activeArtifactSlideoverId).toBe(ARTIFACT_2_ID);
        expect(instance.activeTab).toBe('Overview');
        expect(recordOpen).toHaveBeenCalledWith(SPACE_ITEM_1_ID);
        expect(updateQueryParams).not.toHaveBeenCalled();

        instance.closeArtifactSlideover();
        instance.onRowSelected(instance.libraryRows[0]);
        expect(instance.isArtifactSlideoverOpen).toBe(true);
        expect(instance.activeArtifactSlideoverId).toBe(ARTIFACT_2_ID);
        expect(updateQueryParams).not.toHaveBeenCalled();
    });

    it('(d) opens cited Space Chat SourceReceipts and durable [[ MJ: Artifacts record links in-place', () => {
        const { instance, updateQueryParams, openEntitySpy } = createHostHarness();

        instance.onChatSourceReceiptOpen({
            id: 'rcpt-art-1',
            conversationDetailId: 'detail-1',
            spaceId: SPACE_ID,
            sourceKind: 'SpaceItem',
            spaceItemId: SPACE_ITEM_1_ID,
            contentSourceId: null,
            targetEntityId: ARTIFACT_ENTITY_ID,
            targetRecordId: `ID|${ARTIFACT_1_ID}`,
            sourceTitle: 'Annual Operating Plan',
            band: 'Shared',
            wasSupplied: true,
            wasCited: true,
            retrievalRank: 1,
            relevanceScore: 0.95,
            rankingMode: 'vector',
            citationOrdinal: 1,
            estimatedTokens: 150,
            wasTruncated: false,
            sequence: 1,
        });
        expect(instance.isArtifactSlideoverOpen).toBe(true);
        expect(instance.activeArtifactSlideoverId).toBe(ARTIFACT_1_ID);
        expect(instance.activeArtifactSlideoverTitle).toBe('Annual Operating Plan');
        expect(updateQueryParams).not.toHaveBeenCalled();
        expect(openEntitySpy).not.toHaveBeenCalled();

        instance.closeArtifactSlideover();
        instance.onOpenRecordLink({ entityName: 'MJ: Artifacts', keys: { ID: ARTIFACT_2_ID } });
        expect(instance.isArtifactSlideoverOpen).toBe(true);
        expect(instance.activeArtifactSlideoverId).toBe(ARTIFACT_2_ID);
        expect(openEntitySpy).not.toHaveBeenCalled();
    });

    it('(e) forwards OpenArtifactRequested and OpenArtifact callback through CollabContributedTabHostDirective for custom BaseSpaceTab components', () => {
        const fixture = TestBed.createComponent(TabHostWrapperComponent);
        fixture.detectChanges();

        const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="custom-tab-open"]')!;
        expect(btn).not.toBeNull();
        btn.click();
        expect(fixture.componentInstance.opened).toEqual([{ artifactId: ARTIFACT_1_ID, title: 'Custom Tab Deck' }]);
    });
});
