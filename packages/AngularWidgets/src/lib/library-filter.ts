import type { LibraryRowModel, SpaceBand } from './types';

/** The collection fields the filter reads. */
export interface FilterCollection {
  id: string;
  name: string;
}

export interface LibraryFilter {
  band: 'All' | SpaceBand;
  search: string;
  /** 'all', a smart view ('recent', 'shared', 'team') or a collection's id. */
  folderId: string;
  collections: readonly FilterCollection[];
}

/** The rows the band tab, the search text and the chosen collection or smart view leave. Order is kept. */
export function filterLibraryRows(rows: readonly LibraryRowModel[], filter: LibraryFilter): LibraryRowModel[] {
  const needle = filter.search.trim().toLowerCase();
  const collectionName = filter.collections.find((c) => c.id === filter.folderId)?.name;
  const matching = rows.filter((row) => {
    if (filter.band !== 'All' && row.band !== filter.band) return false;
    if (filter.folderId === 'shared' && row.band !== 'Shared') return false;
    if (filter.folderId === 'team' && row.band !== 'Team') return false;
    if (collectionName !== undefined && row.folder !== collectionName) return false;
    if (needle && ![row.name, row.folder, row.who].some((text) => text.toLowerCase().includes(needle))) return false;
    return true;
  });
  // "Recently updated" lists the ten most recently changed, newest first
  if (filter.folderId === 'recent') {
    return [...matching].sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? '')).slice(0, RECENT_LIMIT);
  }
  return matching;
}

export const RECENT_LIMIT = 10;
