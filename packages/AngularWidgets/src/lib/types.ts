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
}

export interface ItemRowModel {
  id: string;
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

