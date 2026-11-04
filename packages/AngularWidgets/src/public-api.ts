export { BaseSpaceTab } from './lib/base-space-tab';
export { BaseSpaceOverviewCard } from './lib/base-space-overview-card';
export {
    BaseSpacePageBlock,
    assembleSpacePageBlocks,
    defaultBlocksForBuiltInTab,
    BUILT_IN_SPACE_PAGE_BLOCKS,
    CollabPinnedPageBlockComponent,
    CollabNeedsYouPageBlockComponent,
    CollabSharedFilesPageBlockComponent,
    CollabTeamFilesPageBlockComponent,
    CollabOpenTasksPageBlockComponent,
    CollabAskPageBlockComponent,
    CollabDiscussionPageBlockComponent,
    CollabSubSpacesPageBlockComponent,
    CollabAboutPageBlockComponent,
    CollabMainViewPageBlockComponent,
    type SpacePageBlockConfig,
    type SpacePageBlockEmptyAction,
    type SpacePageBlockContext,
    type SpacePageBlockMetadata,
    type SpacePageBlockDescriptor,
} from './lib/base-space-page-block';
export { BaseSpaceSettingsSection } from './lib/base-space-settings-section';
export {
    BaseSpaceTypeUIDriver,
    UIDriverRegistry,
    assembleSpaceContributions,
    overlayDescriptors,
} from './lib/base-space-type-ui-driver';
export type {
    SpaceUIContext,
    SpaceTabDescriptor,
    SpaceOverviewCardDescriptor,
    SpaceHeaderChipDescriptor,
    SpaceHeaderActionDescriptor,
    SpaceSettingsSectionDescriptor,
    SpaceNewStepDescriptor,
    SpaceDetailsFormDescriptor,
    SpaceContributionMetadata,
    CancellableSpaceUIEvent,
    BeforeInviteEvent,
    BeforeCreateChildSpaceEvent,
    BeforeStartChatEvent,
    BeforeAddToChatEvent,
    BeforePostMessageEvent,
    BeforeCloseSpaceEvent,
    AfterSpaceOpenedEvent,
} from './lib/base-space-type-ui-driver';

export * from './lib/types';
export { CollabAvatarComponent, AvatarSize } from './lib/avatar.component';
export { CollabAvatarStackComponent } from './lib/avatar-stack.component';
export { CollabTypeTileComponent, TileSize } from './lib/type-tile.component';
export { CollabBandChipComponent } from './lib/band-chip.component';
export { CollabAudiencePillComponent } from './lib/audience-pill.component';
export { CollabSpaceHeaderComponent } from './lib/space-header.component';
export { CollabSpaceTabsComponent } from './lib/space-tabs.component';
export { CollabSpaceRailComponent, type SpaceRailCustomPage, type TreeGuideInfo } from './lib/space-rail.component';
export { CollabFileIconComponent } from './lib/file-icon.component';
export { CollabItemCardComponent } from './lib/item-card.component';
export { CollabSpaceNotesComponent } from './lib/space-notes.component';
export { CollabPinnedStripComponent } from './lib/pinned-strip.component';
export { CollabSpaceDataComponent } from './lib/space-data.component';
export { CollabItemRowComponent } from './lib/item-row.component';
export { CollabAskBoxComponent } from './lib/ask-box.component';
export { CollabNeedsYouCardComponent } from './lib/needs-you-card.component';
export { CollabItemPreviewComponent } from './lib/item-preview.component';
export { CollabShareCheckComponent } from './lib/share-check.component';
export { CollabSpaceOverviewComponent, RoomMiniMessage, SubSpaceSummary, type OverviewSectionKind } from './lib/space-overview.component';
export { CollabSpaceLibraryComponent, LibraryCollection, LibrarySmartView } from './lib/space-library.component';
export { CollabShareCheckDialogComponent } from './lib/share-check-dialog.component';
export { CollabUploadDialogComponent, CollabUploadSubmitPayload } from './lib/upload-dialog.component';
export {
    CollabNewConversationDialogComponent,
    NewConversationSubmitPayload,
    type WorkstreamLinkTaskOption,
    type WorkstreamLinkFileOption,
    type WorkstreamActionLinkPayload,
} from './lib/new-conversation-dialog.component';
export { CollabNewSpaceDialogComponent, NewSpaceTypeOption, NewSpaceSubmitPayload } from './lib/new-space-dialog.component';
export { CollabHomeListComponent, HomeListRow } from './lib/home-list.component';
export { CollabSpaceWorkComponent } from './lib/space-work.component';
export {
    CollabSpaceChatComponent,
    CollabChatScopeBarComponent,
    type SpaceChatCitationModel,
    type WorkstreamLinkedItem,
    type ChatThreadMessageLike,
    type PendingAgentPromptState,
} from './lib/space-chat.component';
export { CollabSpacePeopleComponent } from './lib/space-people.component';
export { CollabSpaceSettingsComponent } from './lib/space-settings.component';
export {
    CollabSpacePagesComponent,
    COLLAB_BLOCK_OPTIONS,
    COLLAB_PAGE_ICONS,
    type CollabPageModel,
    type CollabPageBlock,
    type CollabContentBlockType,
    type CollabPageBlockType,
    type CollabBlockWidth,
    type CollabPageComment,
    type CollabPageType,
    type CollabCalloutVariant,
    type CollabFactPair,
    type CollabContactCard,
    type CollabLinkItem,
    type CollabChecklistItem,
    type CollabFaqItem,
} from './lib/space-pages.component';
export { DiffWords, HasTextChange, SummarizeDiff, type DiffSegment, type DiffOp } from './lib/page-diff';
export { COLLAB_TOKENS_CSS } from './lib/tokens';

