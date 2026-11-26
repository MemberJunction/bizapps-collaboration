export {
    CollabArtifactSlideoverComponent,
    COLLAB_OPEN_ARTIFACT,
    normalizeArtifactOpenRequest,
    type SpaceArtifactOpenRequest,
    type SpaceArtifactOpenCallback,
} from './lib/artifact-slideover.component';
export { BaseSpaceTab } from './lib/base-space-tab';
export { BaseSpaceOverviewCard } from './lib/base-space-overview-card';
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
    SpaceOverviewCardPlacement,
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
export { CollabSpaceRailComponent, type SpaceRailPref } from './lib/space-rail.component';
export { CollabFileIconComponent } from './lib/file-icon.component';
export { CollabItemCardComponent } from './lib/item-card.component';
export {
    CollabSpaceNotesComponent,
    formatNotePreviewText,
    type PromotedNoteDocLink,
} from './lib/space-notes.component';
export { CollabPinnedStripComponent } from './lib/pinned-strip.component';
export { CollabSpaceDataComponent } from './lib/space-data.component';
export { CollabItemRowComponent } from './lib/item-row.component';
export { CollabAskBoxComponent } from './lib/ask-box.component';
export { CollabNeedsYouCardComponent } from './lib/needs-you-card.component';
export { CollabItemPreviewComponent } from './lib/item-preview.component';
export { CollabShareCheckComponent } from './lib/share-check.component';
export { CollabSpaceOverviewComponent, RoomMiniMessage, SubSpaceSummary } from './lib/space-overview.component';
export { CollabSpaceLibraryComponent, LibraryCollection, LibrarySmartView } from './lib/space-library.component';
export { CollabShareCheckDialogComponent } from './lib/share-check-dialog.component';
export { CollabUploadDialogComponent, CollabUploadSubmitPayload } from './lib/upload-dialog.component';
export {
    CollabUploadIngestDisclosureComponent,
    UploadIngestDisclosureComponent,
    buildUploadIngestDisclosureModel,
    type UploadIngestBandDisplay,
    type UploadIngestDisclosureInput,
    type UploadIngestDisclosureItem,
    type UploadIngestDisclosureModel,
    type UploadIngestMode,
} from './lib/upload-ingest-disclosure.component';
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
    type ChatRecordLink,
    type ChatMessagePart,
    type PendingAgentPromptState,
} from './lib/space-chat.component';
export {
    CollabAnswerSourceReceiptsComponent,
    canDisplaySourceReceiptInAudience,
    sortAnswerSourceReceipts,
    stripCitationMarkdown,
} from './lib/answer-source-receipts.component';
export { CollabSpacePeopleComponent } from './lib/space-people.component';
export { CollabSpaceSettingsComponent } from './lib/space-settings.component';
export {
    CollabSpaceAvatarStudioComponent,
    buildSpaceAvatarPrompt,
    extractGeneratedImageSource,
    convertDataUrlToPngBase64,
    buildSourceImageForEdit,
    downscaleImageToSquareWebp,
    SPACE_AVATAR_STYLE_PRESETS,
    SPACE_AVATAR_QUICK_REFINEMENTS,
    CURATED_SPACE_ICONS,
    CURATED_SPACE_COLORS,
    GENERATE_IMAGE_ACTION_FALLBACK_ID,
    SPACE_AVATAR_MAX_UNDO_STEPS,
    SPACE_AVATAR_DIMENSION,
    SPACE_AVATAR_WEBP_QUALITY,
    SPACE_AVATAR_REFINE_PNG_SIZE,
    type SpaceAvatarStudioTab,
    type SpaceAvatarChangePayload,
    type SpaceAvatarStylePreset,
    type CachedAvatarPngSource,
    type MediaOutputEntry,
    type ActionParamResultEntry,
    type RunActionResultLike,
    type ExtractImageSourceInput,
} from './lib/space-avatar-studio.component';
export { COLLAB_TOKENS_CSS } from './lib/tokens';
export {
    SpaceMeetingsTabComponent,
    buildMeetingIcsContent,
    computeMeetingPermissions,
    createDefaultSpaceMeetingDraft,
    filterSpaceMeetings,
    isUpcomingMeeting,
    loadSpaceChildSpaces,
    loadSpaceMeetingCards,
    loadSpaceMeetingDetail,
    loadSpaceMeetingsWithRollup,
    meetingVisibilityToSpaceBand,
    toMeetingRow,
    validateNewSpaceMeetingDraft,
    type MeetingDrawerSection,
    type NewSpaceMeetingDraft,
    type SpaceChildSummary,
    type SpaceMeetingCardItem,
    type SpaceMeetingDetailBundle,
    type SpaceMeetingsBandFilter,
    type SpaceMeetingsFilterMode,
} from './lib/space-meetings-tab.component';
export {
    SpaceComingUpCardComponent,
    SpaceMeetingsWidgetAgendaProvider,
    collectSpaceAgendaItems,
} from './lib/space-coming-up-card.component';

