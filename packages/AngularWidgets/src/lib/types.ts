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
