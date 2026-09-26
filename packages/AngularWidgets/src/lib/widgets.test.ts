import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { CollabAvatarComponent } from './avatar.component.ts';
import { CollabAvatarStackComponent } from './avatar-stack.component.ts';
import { CollabTypeTileComponent } from './type-tile.component.ts';
import { CollabBandChipComponent } from './band-chip.component.ts';
import { CollabAudiencePillComponent } from './audience-pill.component.ts';
import { CollabSpaceTabsComponent } from './space-tabs.component.ts';
import { CollabSpaceRailComponent } from './space-rail.component.ts';
import { CollabFileIconComponent } from './file-icon.component.ts';
import { CollabItemCardComponent } from './item-card.component.ts';
import { CollabItemRowComponent } from './item-row.component.ts';
import { CollabAskBoxComponent } from './ask-box.component.ts';
import { CollabNeedsYouCardComponent } from './needs-you-card.component.ts';
import { CollabItemPreviewComponent } from './item-preview.component.ts';
import { CollabShareCheckComponent } from './share-check.component.ts';
import { CollabSpaceOverviewComponent } from './space-overview.component.ts';
import { CollabSpaceLibraryComponent } from './space-library.component.ts';
import { CollabShareCheckDialogComponent } from './share-check-dialog.component.ts';
import { FindingModel, LibraryRowModel, RailSpaceNode } from './types.ts';

describe('CollabAvatarComponent', () => {
  it('uses explicit ColorClass when provided', () => {
    const comp = new CollabAvatarComponent();
    comp.Initials = 'AL';
    comp.ColorClass = 'c5';
    expect(comp.computedColorClass).toBe('c5');
  });

  it('computes stable colorClass from PersonId when ColorClass not provided', () => {
    const comp = new CollabAvatarComponent();
    comp.Initials = 'SO';
    comp.PersonId = 'user-sam-okafor';
    const computed = comp.computedColorClass;
    expect(computed).toMatch(/^c([1-9]|10)$/);
  });

  it('computes stable colorClass from Name as fallback', () => {
    const comp = new CollabAvatarComponent();
    comp.Name = 'Priya Shah';
    const computed = comp.computedColorClass;
    expect(computed).toMatch(/^c([1-9]|10)$/);
  });

  it('defaults to c1 when no identifier provided', () => {
    const comp = new CollabAvatarComponent();
    expect(comp.computedColorClass).toBe('c1');
  });
});

describe('CollabAvatarStackComponent', () => {
  it('slices visible avatars to Max and computes moreCount', () => {
    const comp = new CollabAvatarStackComponent();
    comp.Max = 3;
    comp.Avatars = [
      { initials: 'A', name: 'Alice' },
      { initials: 'B', name: 'Bob' },
      { initials: 'C', name: 'Charlie' },
      { initials: 'D', name: 'David' },
      { initials: 'E', name: 'Eve' }
    ];

    expect(comp.visibleAvatars.length).toBe(3);
    expect(comp.computedMoreCount).toBe(2);
  });

  it('respects explicit MoreCount when provided', () => {
    const comp = new CollabAvatarStackComponent();
    comp.Max = 4;
    comp.MoreCount = 10;
    comp.Avatars = [{ initials: 'A' }];
    expect(comp.computedMoreCount).toBe(10);
  });

  it('handles empty avatars gracefully', () => {
    const comp = new CollabAvatarStackComponent();
    comp.Avatars = [];
    expect(comp.visibleAvatars.length).toBe(0);
    expect(comp.computedMoreCount).toBe(0);
  });
});

describe('CollabTypeTileComponent', () => {
  it('has defaults and accepts custom inputs', () => {
    const comp = new CollabTypeTileComponent();
    expect(comp.IconClass).toBe('fa-solid fa-shapes');
    expect(comp.Size).toBe('md');
    expect(comp.IsClosed).toBe(false);

    comp.IconClass = 'fa-solid fa-compass';
    comp.Size = 'xl';
    comp.Color = '#0076b6';
    comp.IsClosed = true;

    expect(comp.IconClass).toBe('fa-solid fa-compass');
    expect(comp.Size).toBe('xl');
    expect(comp.Color).toBe('#0076b6');
    expect(comp.IsClosed).toBe(true);
  });
});

describe('CollabBandChipComponent', () => {
  it('correctly reports isShared and defaults label', () => {
    const comp = new CollabBandChipComponent();
    comp.Band = 'Shared';
    expect(comp.isShared).toBe(true);

    comp.Band = 'Team';
    expect(comp.isShared).toBe(false);
  });
});

describe('CollabAudiencePillComponent', () => {
  it('accepts staff and outside avatar arrays and summary', () => {
    const comp = new CollabAudiencePillComponent();
    comp.StaffAvatars = [{ initials: 'AL' }];
    comp.OutsideAvatars = [{ initials: 'CM', isOutside: true }];
    comp.TotalPeople = 9;
    comp.Summary = '3 Meridian · 6 Northwind';

    expect(comp.TotalPeople).toBe(9);
    expect(comp.Summary).toBe('3 Meridian · 6 Northwind');
    expect(comp.StaffAvatars.length).toBe(1);
    expect(comp.OutsideAvatars.length).toBe(1);
  });
});

describe('CollabSpaceTabsComponent', () => {
  it('emits TabSelectRequested when selectTab is called with new tab id without mutating ActiveTab internally', () => {
    const comp = new CollabSpaceTabsComponent();
    comp.Tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'library', label: 'Library', count: 24 }
    ];
    comp.ActiveTab = 'overview';

    let emittedPascal: string | null = null;
    comp.TabSelectRequested.subscribe(id => {
      emittedPascal = id;
    });

    comp.selectTab('library');
    // ActiveTab remains controlled by the host, not mutated internally
    expect(comp.ActiveTab).toBe('overview');
    expect(emittedPascal).toBe('library');

    // Selecting already active tab does not re-emit
    emittedPascal = null;
    comp.selectTab('overview');
    expect(emittedPascal).toBeNull();
  });

  it('handles onTabActivateRequested from keyboard directive', () => {
    const comp = new CollabSpaceTabsComponent();
    comp.Tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'library', label: 'Library' },
      { id: 'work', label: 'Work' }
    ];
    comp.ActiveTab = 'overview';

    let emitted: string | null = null;
    comp.TabSelectRequested.subscribe(id => {
      emitted = id;
    });

    comp.onTabActivateRequested({ Index: 2 });
    expect(emitted).toBe('work');
  });
});

describe('CollabSpaceRailComponent', () => {
  it('emits NavSelectRequested when selectNav is called', () => {
    const comp = new CollabSpaceRailComponent();
    let emitted: string | null = null;
    comp.NavSelectRequested.subscribe(nav => {
      emitted = nav;
    });

    comp.selectNav('inbox');
    expect(emitted).toBe('inbox');
  });

  it('emits SpaceOpenRequested when selectSpace is called', () => {
    const comp = new CollabSpaceRailComponent();
    let emitted: string | null = null;
    comp.SpaceOpenRequested.subscribe(id => {
      emitted = id;
    });

    comp.selectSpace('space-123');
    expect(emitted).toBe('space-123');
  });

  it('toggles expansion without mutating the input node and emits SpaceToggleRequested', () => {
    const comp = new CollabSpaceRailComponent();
    const node: RailSpaceNode = {
      id: 'space-northwind',
      name: 'Northwind',
      iconClass: 'fa-solid fa-building',
      hasChildren: true,
      isExpanded: false
    };

    let emittedNode: RailSpaceNode | null = null;
    comp.SpaceToggleRequested.subscribe(n => {
      emittedNode = n;
    });

    let stopped = false;
    const mockEvent = {
      stopPropagation: () => {
        stopped = true;
      }
    };

    expect(comp.isNodeExpanded(node)).toBe(false);
    comp.toggleSpace(node, mockEvent);
    expect(stopped).toBe(true);
    // Pure: caller's node is NOT mutated
    expect(node.isExpanded).toBe(false);
    // Component tracks expansion internally
    expect(comp.isNodeExpanded(node)).toBe(true);
    expect(emittedNode).toBe(node);
  });

  it('expands with onArrowRight and collapses with onArrowLeft without mutating node', () => {
    const comp = new CollabSpaceRailComponent();
    const node: RailSpaceNode = {
      id: 'space-northwind',
      name: 'Northwind',
      iconClass: 'fa-solid fa-building',
      hasChildren: true,
      isExpanded: false
    };

    let emittedNode: RailSpaceNode | null = null;
    comp.SpaceToggleRequested.subscribe(n => {
      emittedNode = n;
    });

    const mockEvent = new Event('keydown', { cancelable: true });

    expect(comp.isNodeExpanded(node)).toBe(false);
    comp.onArrowRight(node, mockEvent);
    expect(mockEvent.defaultPrevented).toBe(true);
    expect(comp.isNodeExpanded(node)).toBe(true);
    expect(emittedNode).toBe(node);

    emittedNode = null;
    const mockEventLeft = new Event('keydown', { cancelable: true });
    comp.onArrowLeft(node, mockEventLeft);
    expect(mockEventLeft.defaultPrevented).toBe(true);
    expect(comp.isNodeExpanded(node)).toBe(false);
    expect(emittedNode).toBe(node);
  });

  it('collapsing a parent space hides its descendants and expanding it shows them in visibleSpaces', () => {
    const comp = new CollabSpaceRailComponent();
    const northwind: RailSpaceNode = { id: 'northwind', name: 'Northwind', iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: true };
    const discovery: RailSpaceNode = { id: 'discovery', name: 'Discovery', iconClass: 'fa-solid fa-compass', level: 1, hasChildren: true, isExpanded: true };
    const fieldnotes: RailSpaceNode = { id: 'fieldnotes', name: 'Field notes', iconClass: 'fa-solid fa-clipboard', level: 2, hasChildren: false, isExpanded: false };
    const delivery: RailSpaceNode = { id: 'delivery', name: 'Delivery', iconClass: 'fa-solid fa-truck-fast', level: 1, hasChildren: true, isExpanded: false };
    const closed: RailSpaceNode = { id: 'closed', name: 'Closed', iconClass: 'fa-solid fa-box-archive', level: 1, hasChildren: true, isExpanded: false };
    const committee: RailSpaceNode = { id: 'committee', name: 'Audit Committee', iconClass: 'fa-solid fa-landmark', level: 0, hasChildren: true, isExpanded: false };

    comp.Spaces = [northwind, discovery, fieldnotes, delivery, closed, committee];

    // Initially Northwind is expanded: all 6 spaces visible
    expect(comp.visibleSpaces.map(s => s.id)).toEqual(['northwind', 'discovery', 'fieldnotes', 'delivery', 'closed', 'committee']);

    // Collapse Northwind via onArrowLeft
    const mockEventLeft = new Event('keydown', { cancelable: true });
    comp.onArrowLeft(northwind, mockEventLeft);

    // Collapsing Northwind hides its 4 descendants (discovery, fieldnotes, delivery, closed)
    expect(comp.visibleSpaces.map(s => s.id)).toEqual(['northwind', 'committee']);

    // Re-expand Northwind via onArrowRight
    const mockEventRight = new Event('keydown', { cancelable: true });
    comp.onArrowRight(northwind, mockEventRight);

    // Descendants are visible again
    expect(comp.visibleSpaces.map(s => s.id)).toEqual(['northwind', 'discovery', 'fieldnotes', 'delivery', 'closed', 'committee']);
  });
});

describe('CollabFileIconComponent', () => {
  it('computes correct icon classes for various file types', () => {
    const comp = new CollabFileIconComponent();

    comp.Kind = 'pdf';
    expect(comp.iconClass).toBe('fa-solid fa-file-pdf');
    expect(comp.kindClass).toBe('pdf sm');

    comp.Kind = 'doc';
    expect(comp.iconClass).toBe('fa-solid fa-file-word');

    comp.Kind = 'xls';
    expect(comp.iconClass).toBe('fa-solid fa-file-excel');

    comp.Kind = 'ppt';
    expect(comp.iconClass).toBe('fa-solid fa-file-powerpoint');

    comp.Kind = 'img';
    expect(comp.iconClass).toBe('fa-solid fa-images');

    comp.Kind = 'txt';
    expect(comp.iconClass).toBe('fa-solid fa-file-lines');

    comp.Kind = 'zip';
    expect(comp.iconClass).toBe('fa-solid fa-folder');

    comp.Kind = 'unknown-type';
    expect(comp.iconClass).toBe('fa-solid fa-file');
  });
});

describe('CollabItemCardComponent', () => {
  it('emits ItemSelected when card is clicked', () => {
    const comp = new CollabItemCardComponent();
    let emitted = false;
    comp.ItemSelected.subscribe(() => {
      emitted = true;
    });

    comp.onSelect();
    expect(emitted).toBe(true);
  });
});

describe('CollabItemRowComponent', () => {
  it('emits RowSelected when row is clicked', () => {
    const comp = new CollabItemRowComponent();
    let rowEmitted = false;
    comp.RowSelected.subscribe(() => {
      rowEmitted = true;
    });

    comp.onSelect();
    expect(rowEmitted).toBe(true);
  });

  it('emits ShareRequested and stops event propagation when share button is clicked', () => {
    const comp = new CollabItemRowComponent();
    let shareEmitted = false;
    comp.ShareRequested.subscribe(() => {
      shareEmitted = true;
    });

    let stopped = false;
    const mockEvent = {
      stopPropagation: () => {
        stopped = true;
      }
    } as unknown as MouseEvent;

    comp.onShareClick(mockEvent);
    expect(stopped).toBe(true);
    expect(shareEmitted).toBe(true);
  });
});

describe('CollabAskBoxComponent', () => {
  it('emits AskRequested when query is provided and clears query', () => {
    const comp = new CollabAskBoxComponent();
    let queryResult = '';
    comp.AskRequested.subscribe(q => {
      queryResult = q;
    });

    comp.Query = 'What is the readout schedule?';
    comp.onSend();
    expect(queryResult).toBe('What is the readout schedule?');
    expect(comp.Query).toBe('');
  });

  it('selects suggestion and sends immediately', () => {
    const comp = new CollabAskBoxComponent();
    let queryResult = '';
    comp.AskRequested.subscribe(q => {
      queryResult = q;
    });

    comp.onSelectSuggestion('Draft this week’s note to Casey');
    expect(queryResult).toBe('Draft this week’s note to Casey');
  });
});

describe('CollabNeedsYouCardComponent', () => {
  it('emits ActionTriggered on action button click', () => {
    const comp = new CollabNeedsYouCardComponent();
    let actionEmitted = false;
    comp.ActionTriggered.subscribe(() => {
      actionEmitted = true;
    });

    comp.onAction();
    expect(actionEmitted).toBe(true);
  });
});

describe('CollabItemPreviewComponent', () => {
  it('emits CloseRequested and ShareRequested', () => {
    const comp = new CollabItemPreviewComponent();
    let closed = false;
    let shared = false;

    comp.CloseRequested.subscribe(() => {
      closed = true;
    });
    comp.ShareRequested.subscribe(() => {
      shared = true;
    });

    comp.onClose();
    expect(closed).toBe(true);

    comp.onShare();
    expect(shared).toBe(true);
  });
});

describe('CollabShareCheckComponent', () => {
  it('calculates pending count, formats quotation, and applies fix', () => {
    const comp = new CollabShareCheckComponent();
    const fix1: FindingModel = {
      id: 'f1',
      quotation: 'As the Dayton plant manager told us, tool is bad.',
      originalPhrase: 'As the Dayton plant manager told us',
      suggestedPhrase: 'as one plant leader told us',
      status: 'Flagged',
    };
    const fix2: FindingModel = {
      id: 'f2',
      quotation: 'Jim in Finance described it.',
      originalPhrase: 'Jim in Finance',
      suggestedPhrase: 'a finance team member',
      status: 'Flagged',
    };

    comp.Findings = [fix1, fix2];
    expect(comp.pendingCount).toBe(2);
    expect(comp.primaryButtonText).toBe('Apply 2 fixes and share');

    const formatted = comp.formatQuotation(fix1);
    expect(formatted).toContain('<mark>As the Dayton plant manager told us</mark>');

    let appliedFinding: FindingModel | null = null;
    comp.ApplyFixRequested.subscribe(f => {
      appliedFinding = f;
    });

    comp.onApplyFix(fix1);
    expect(fix1.status).toBe('Applied');
    expect(appliedFinding).toBe(fix1);
    expect(comp.pendingCount).toBe(1);

    const formattedApplied = comp.formatQuotation(fix1);
    expect(formattedApplied).toContain('as one plant leader told us');
  });

  it('emits ShareCompleted with applyFixes true on onApplyAndShare', () => {
    const comp = new CollabShareCheckComponent();
    comp.Note = 'Test note';
    comp.NotifyRecipients = true;

    let result: { applyFixes: boolean; note: string; notify: boolean } | null = null;
    comp.ShareCompleted.subscribe(r => {
      result = r;
    });

    comp.onApplyAndShare();
    expect(result).toEqual({ applyFixes: true, note: 'Test note', notify: true });
  });

  it('emits ShareCompleted with applyFixes false on onShareAsIs', () => {
    const comp = new CollabShareCheckComponent();
    comp.Note = 'Raw note';
    comp.NotifyRecipients = false;

    let result: { applyFixes: boolean; note: string; notify: boolean } | null = null;
    comp.ShareCompleted.subscribe(r => {
      result = r;
    });

    comp.onShareAsIs();
    expect(result).toEqual({ applyFixes: false, note: 'Raw note', notify: false });
  });

  it('emits CancelRequested on cancel', () => {
    const comp = new CollabShareCheckComponent();
    let cancelled = false;
    comp.CancelRequested.subscribe(() => {
      cancelled = true;
    });

    comp.onCancel();
    expect(cancelled).toBe(true);
  });
});

describe('CollabSpaceOverviewComponent', () => {
  it('emits PreviewAsRequested with lowercased persona', () => {
    const comp = new CollabSpaceOverviewComponent();
    comp.ClientPersonaName = 'Casey';

    let previewPersona = '';
    comp.PreviewAsRequested.subscribe(p => {
      previewPersona = p;
    });
    comp.onPreviewAsCasey();
    expect(previewPersona).toBe('casey');
  });

  it('emits OpenLibraryRequested, OpenChatRequested, and NewSubSpaceRequested', () => {
    const comp = new CollabSpaceOverviewComponent();
    let libOpened = false;
    let chatOpened = false;
    let newSub = false;

    comp.OpenLibraryRequested.subscribe(() => {
      libOpened = true;
    });
    comp.OpenChatRequested.subscribe(() => {
      chatOpened = true;
    });
    comp.NewSubSpaceRequested.subscribe(() => {
      newSub = true;
    });

    comp.onOpenLibrary();
    expect(libOpened).toBe(true);

    comp.onOpenChat();
    expect(chatOpened).toBe(true);

    comp.onNewSubSpace();
    expect(newSub).toBe(true);
  });
});

describe('CollabSpaceLibraryComponent', () => {
  it('filters rows correctly by band', () => {
    const comp = new CollabSpaceLibraryComponent();
    const rowShared: LibraryRowModel = { id: '1', kind: 'pdf', name: 'Readout', folder: 'Deliv', band: 'Shared', who: 'Ada', when: 'Sep 24' };
    const rowTeam: LibraryRowModel = { id: '2', kind: 'doc', name: 'Synthesis', folder: 'Interviews', band: 'Team', who: 'Sam', when: '2h ago' };

    comp.Rows = [rowShared, rowTeam];

    comp.ActiveBandFilter = 'All';
    expect(comp.FilteredRows.length).toBe(2);

    comp.ActiveBandFilter = 'Shared';
    expect(comp.FilteredRows).toEqual([rowShared]);

    comp.ActiveBandFilter = 'Team';
    expect(comp.FilteredRows).toEqual([rowTeam]);
  });

  it('selects row and opens drawer', () => {
    const comp = new CollabSpaceLibraryComponent();
    const row: LibraryRowModel = { id: '1', kind: 'pdf', name: 'Readout', folder: 'Deliv', band: 'Shared', who: 'Ada', when: 'Sep 24' };
    comp.Rows = [row];

    let emittedRow: LibraryRowModel | null = null;
    comp.RowSelected.subscribe(r => {
      emittedRow = r;
    });

    comp.onSelectRow(row);
    expect(comp.SelectedRowId).toBe('1');
    expect(comp.ShowDrawer).toBe(true);
    expect(emittedRow).toBe(row);

    comp.onCloseDrawer();
    expect(comp.ShowDrawer).toBe(false);
  });
});

describe('CollabShareCheckDialogComponent', () => {
  it('emits CancelRequested on onCancel', () => {
    const comp = new CollabShareCheckDialogComponent();
    let cancelled = false;
    comp.CancelRequested.subscribe(() => {
      cancelled = true;
    });

    comp.onCancel();
    expect(cancelled).toBe(true);
  });

  it('emits ShareCompleted on onShareCompleted', () => {
    const comp = new CollabShareCheckDialogComponent();
    let payload: { applyFixes: boolean; note: string; notify: boolean } | null = null;
    comp.ShareCompleted.subscribe(p => {
      payload = p;
    });

    comp.onShareCompleted({ applyFixes: true, note: 'Done', notify: true });
    expect(payload).toEqual({ applyFixes: true, note: 'Done', notify: true });
  });
});

