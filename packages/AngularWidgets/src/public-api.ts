export { BaseSpaceTab } from './lib/base-space-tab';
export { BaseSpaceOverviewCard } from './lib/base-space-overview-card';
export { BaseSpaceSettingsSection } from './lib/base-space-settings-section';
export {
    BaseSpaceTypeUIDriver,
    UIDriverRegistry,
    assembleSpaceContributions,
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
export { CollabSpaceRailComponent } from './lib/space-rail.component';
export { CollabFileIconComponent } from './lib/file-icon.component';
export { CollabItemCardComponent } from './lib/item-card.component';
export { CollabItemRowComponent } from './lib/item-row.component';
export { CollabAskBoxComponent } from './lib/ask-box.component';
export { CollabNeedsYouCardComponent } from './lib/needs-you-card.component';
export { CollabItemPreviewComponent } from './lib/item-preview.component';
export { CollabShareCheckComponent } from './lib/share-check.component';
export { CollabSpaceOverviewComponent, RoomMiniMessage, SubSpaceSummary } from './lib/space-overview.component';
export { CollabSpaceLibraryComponent, LibraryCollection, LibrarySmartView } from './lib/space-library.component';
export { CollabShareCheckDialogComponent } from './lib/share-check-dialog.component';
export { CollabUploadDialogComponent, CollabUploadSubmitPayload } from './lib/upload-dialog.component';
export { CollabSpaceWorkComponent } from './lib/space-work.component';
export { CollabSpaceChatComponent, RoomMessageItem } from './lib/space-chat.component';
export { CollabSpacePeopleComponent } from './lib/space-people.component';
export { CollabSpaceSettingsComponent } from './lib/space-settings.component';
export { COLLAB_TOKENS_CSS } from './lib/tokens';
