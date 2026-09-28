/**
 * Common presentation interfaces for Collaboration widgets.
 */

export interface AvatarItem {
  id?: string;
  initials: string;
  name?: string;
  avatarUrl?: string;
  colorClass?: string;
  isOutside?: boolean;
  isOnline?: boolean;
}

export interface TabItem {
  id: string;
  label: string;
  iconClass?: string;
  count?: number;
}

export interface BreadcrumbItem {
  label: string;
  url?: string;
  active?: boolean;
  spaceId?: string;
}

export interface RailSpaceNode {
  id: string;
  name: string;
  iconClass: string;
  color?: string;
  level?: 0 | 1 | 2;
  unread?: boolean;
  isLocked?: boolean;
  meta?: string | number;
  isDim?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
}

export type SpaceBand = 'Shared' | 'Team';

export type FileKind = 'pdf' | 'doc' | 'xls' | 'ppt' | 'img' | 'txt' | 'zip' | string;

export interface ItemCardModel {
  id: string;
  kind: FileKind;
  title: string;
  meta: string;
  stamp: string;
  openers?: AvatarItem[];
  citationCount?: number;
  isImage?: boolean;
  fileId?: string;
}

export interface ItemRowModel {
  id: string;
  fileId?: string;
  kind: FileKind;
  title: string;
  author: string;
  timestamp: string;
  flagCount?: number;
  statusLabel?: string;
  canShare?: boolean;
}

export interface NeedsYouItemModel {
  id: string;
  variant: 'blue' | 'warn' | 'red';
  iconClass?: string;
  isSpark?: boolean;
  title: string;
  subtitle: string;
  actionLabel: string;
}

export interface FindingModel {
  id: string;
  quotation: string;
  originalPhrase: string;
  suggestedPhrase: string;
  status: 'Flagged' | 'Applied' | 'Dismissed';
}

export interface LibraryRowModel {
  id: string;
  fileId?: string;
  kind: FileKind;
  name: string;
  folder: string;
  band: SpaceBand;
  who: string;
  when: string;
  flagCount?: number;
  openers?: AvatarItem[];
  aiSeenCount?: number;
  selected?: boolean;
}

export interface RecentUseModel {
  id: string;
  isSpark?: boolean;
  avatar?: AvatarItem;
  text: string;
  timestamp: string;
}

export interface RecipientPersonModel {
  id: string;
  avatar: AvatarItem;
  name: string;
  role: string;
  isMore?: boolean;
  moreCount?: number;
  moreSubtitle?: string;
}

export type ChatPrivacyType = 'Shared' | 'Internal' | 'Direct' | 'Assistant';

export interface ChatSummaryModel {
  id: string;
  title: string;
  privacy: ChatPrivacyType;
  timestamp: string;
  avatars: AvatarItem[];
  audienceLabel: string;
  unreadCount?: number;
  lastSender?: string;
  lastMessage: string;
  isActive?: boolean;
}

export interface SpaceConversationItem {
  id: string;
  name: string;
  kind: 'General' | 'Topic' | 'Private' | string;
  band: SpaceBand;
  unreadCount?: number;
  lastMessageSnippet?: string;
  lastMessageTime?: string;
  isActive?: boolean;
}

export interface ChatMessageCitation {
  id: string;
  label: string;
  kind: FileKind;
  page?: number | string;
}

export interface ChatMessageSplitCard {
  sharedTitle: string;
  sharedText: string;
  sharedCitations?: ChatMessageCitation[];
  internalTitle: string;
  internalText: string;
  internalCitation?: ChatMessageCitation;
}

export interface ChatMessageAction {
  id: string;
  label: string;
  iconClass?: string;
}

export interface ChatAnswerReceiptModel {
  sharedCount: number;
  teamCount: number;
  isInternal: boolean;
  clientOrgName?: string;
  thumbsUpCount?: number;
}

export interface ChatMessageModel {
  id: string;
  authorName: string;
  authorAvatar: AvatarItem;
  orgBadge?: string;
  isAssistant?: boolean;
  timestamp: string;
  text: string;
  bullets?: { text: string; citation?: ChatMessageCitation }[];
  splitCards?: ChatMessageSplitCard;
  suggestedActions?: ChatMessageAction[];
  answerReceipt?: ChatAnswerReceiptModel;
}

export interface ChatLensPinnedItem {
  id: string;
  kind: FileKind;
  title: string;
  meta: string;
}

export interface ChatLensAudienceGroup {
  name: string;
  count: number;
  members: AvatarItem[];
}

export interface TaskItemModel {
  id: string;
  name: string;
  description?: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Deferred' | 'Blocked' | string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
  band: SpaceBand;
  assigneeName?: string;
  assigneeInitials?: string;
  assigneeAvatarUrl?: string;
  dueDate?: string;
  percentComplete?: number;
  subtaskCount?: number;
}

export interface SpaceMemberModel {
  id: string;
  userId: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string;
  colorClass?: string;
  roleName: string;
  roleCode: string;
  roleId?: string;
  canContribute?: boolean;
  band: SpaceBand;
  status: 'Active' | 'Invited' | 'Removed' | string;
  joinedDate?: string;
}

export interface SpaceSettingsModel {
  id: string;
  name: string;
  description: string;
  spaceType: string;
  spaceTypeId: string;
  iconClass: string;
  color: string;
  backgroundImageUrl: string;
  inheritsMembership: boolean;
  agentRetrieval: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely' | string;
  retention: 'Month' | 'Year' | 'Indefinite' | string;
  status: string;
}



