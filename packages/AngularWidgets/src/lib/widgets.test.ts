import '@angular/compiler';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { CollabDialogBase } from './dialog-base.ts';
import type { ElementRef } from '@angular/core';
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
import { CollabUploadDialogComponent, CollabUploadSubmitPayload } from './upload-dialog.component.ts';
import { CollabSpaceWorkComponent } from './space-work.component.ts';
import { CollabSpaceChatComponent } from './space-chat.component.ts';
import { CollabSpacePeopleComponent } from './space-people.component.ts';
import { CollabSpaceSettingsComponent } from './space-settings.component.ts';
import { CollabNewConversationDialogComponent, NewConversationSubmitPayload } from './new-conversation-dialog.component.ts';
import { SimpleChange } from '@angular/core';
import { filterLibraryRows } from './library-filter.ts';
import { taskPriorityClass, taskPriorityLabel, taskStatusClass, taskStatusLabel } from './task-status.ts';
import {
  FindingModel,
  LibraryRowModel,
  RailSpaceNode,
  TaskItemModel,
  SpaceMemberModel,
  SpaceSettingsModel,
} from './types.ts';

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

describe('CollabSpaceRailComponent open conversation', () => {
  const ID = 'A1B2C3D4-0000-4000-8000-000000000001';

  it('is the open one when the URL and the row differ only in case', () => {
    const comp = new CollabSpaceRailComponent();
    comp.ActiveConversationId = ID.toLowerCase();
    expect(comp.IsActiveConversation(ID)).toBe(true);
  });

  it('is not the open one for another conversation, or when none is open', () => {
    const comp = new CollabSpaceRailComponent();
    comp.ActiveConversationId = ID;
    expect(comp.IsActiveConversation('B1B2C3D4-0000-4000-8000-000000000002')).toBe(false);
    comp.ActiveConversationId = '';
    expect(comp.IsActiveConversation(ID)).toBe(false);
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

  it('toggles collapsed rail state and emits NewConversationRequested', () => {
    const comp = new CollabSpaceRailComponent();
    expect(comp.isCollapsed).toBe(false);
    comp.toggleCollapse();
    expect(comp.isCollapsed).toBe(true);
    comp.toggleCollapse();
    expect(comp.isCollapsed).toBe(false);

    let newConvoEmitted = false;
    comp.NewConversationRequested.subscribe(() => {
      newConvoEmitted = true;
    });
    comp.onNewConversation();
    expect(newConvoEmitted).toBe(true);
  });

  it('binds conversations with their bands, and highlights the open one when the URL differs in case', () => {
    const comp = new CollabSpaceRailComponent();
    const GENERAL = 'A1B2C3D4-0000-4000-8000-00000000000A';
    const INTERNAL = 'B1B2C3D4-0000-4000-8000-00000000000B';
    comp.Conversations = [
      { id: GENERAL, name: 'General', kind: 'General', band: 'Shared' },
      { id: INTERNAL, name: 'Internal Sync', kind: 'Private', band: 'Team' },
    ];
    comp.ActiveConversationId = GENERAL.toLowerCase();

    let selectedConv = '';
    comp.ConversationSelectRequested.subscribe(id => {
      selectedConv = id;
    });

    comp.onConversationClick(INTERNAL);
    expect(selectedConv).toBe(INTERNAL);
    expect(comp.Conversations[0].band).toBe('Shared');
    expect(comp.Conversations[1].band).toBe('Team');
    expect(comp.IsActiveConversation(comp.Conversations[0].id)).toBe(true);
    expect(comp.IsActiveConversation(comp.Conversations[1].id)).toBe(false);
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
  it('emits ItemSelectRequested when card is clicked', () => {
    const comp = new CollabItemCardComponent();
    let emitted = false;
    comp.ItemSelectRequested.subscribe(() => {
      emitted = true;
    });

    comp.onSelect();
    expect(emitted).toBe(true);
  });
});

describe('CollabItemRowComponent', () => {
  it('emits RowSelectRequested when row is clicked', () => {
    const comp = new CollabItemRowComponent();
    let rowEmitted = false;
    comp.RowSelectRequested.subscribe(() => {
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
  it('emits AskRequested when query is provided and preserves query until clear()', () => {
    const comp = new CollabAskBoxComponent();
    let queryResult = '';
    comp.AskRequested.subscribe(q => {
      queryResult = q;
    });

    comp.Query = 'What is the readout schedule?';
    comp.onSend();
    expect(queryResult).toBe('What is the readout schedule?');
    expect(comp.Query).toBe('What is the readout schedule?');
    comp.clear();
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
  it('emits ActionRequested on action button click', () => {
    const comp = new CollabNeedsYouCardComponent();
    let actionEmitted = false;
    comp.ActionRequested.subscribe(() => {
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

  it('parses paragraphs with <mark> tags into marked and unmarked segments', () => {
    const comp = new CollabItemPreviewComponent();
    const paragraph = 'Hello <mark>world</mark> test';
    const segments = comp.parseParagraph(paragraph);
    expect(segments).toEqual([
      { text: 'Hello ', isMarked: false },
      { text: 'world', isMarked: true },
      { text: ' test', isMarked: false },
    ]);
  });

  it('parses recent use text with <b> tags into bold and non-bold parts', () => {
    const comp = new CollabItemPreviewComponent();
    const text = 'Saved by <b>Meridian team</b> for review';
    const parts = comp.parseRecentUseText(text);
    expect(parts).toEqual([
      { text: 'Saved by ', isBold: false },
      { text: 'Meridian team', isBold: true },
      { text: ' for review', isBold: false },
    ]);
  });

  it('emits OpenFileRequested with FileId when clicked and not opening', () => {
    const comp = new CollabItemPreviewComponent();
    comp.FileId = 'file-abc-123';
    comp.IsOpeningFile = false;
    let emitted: string | null = null;
    comp.OpenFileRequested.subscribe(id => {
      emitted = id;
    });

    comp.onOpenFile();
    expect(emitted).toBe('file-abc-123');
  });

  it('does NOT emit OpenFileRequested when IsOpeningFile is true', () => {
    const comp = new CollabItemPreviewComponent();
    comp.FileId = 'file-abc-123';
    comp.IsOpeningFile = true;
    let emitted: string | null = null;
    comp.OpenFileRequested.subscribe(id => {
      emitted = id;
    });

    comp.onOpenFile();
    expect(emitted).toBeNull();
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

    const parts1 = comp.getQuotationParts(fix1);
    expect(parts1.marked).toBe('As the Dayton plant manager told us');

    let appliedFinding: FindingModel | null = null;
    comp.ApplyFixRequested.subscribe(f => {
      appliedFinding = f;
    });

    comp.onApplyFix(fix1);
    expect(appliedFinding).toBe(fix1);
    // Widget emits event without mutating finding directly
    fix1.status = 'Applied';
    expect(comp.pendingCount).toBe(1);

    const partsApplied = comp.getQuotationParts(fix1);
    expect(partsApplied.marked).toBe('as one plant leader told us');
  });

  it('emits ShareRequested with applyFixes true on onApplyAndShare', () => {
    const comp = new CollabShareCheckComponent();
    comp.Note = 'Test note';
    comp.NotifyRecipients = true;

    let result: { applyFixes: boolean; note: string; notify: boolean } | null = null;
    comp.ShareRequested.subscribe(r => {
      result = r;
    });

    comp.onApplyAndShare();
    expect(result).toEqual({ applyFixes: true, note: 'Test note', notify: true });
  });

  it('emits ShareRequested with applyFixes false on onShareAsIs', () => {
    const comp = new CollabShareCheckComponent();
    comp.Note = 'Raw note';
    comp.NotifyRecipients = false;

    let result: { applyFixes: boolean; note: string; notify: boolean } | null = null;
    comp.ShareRequested.subscribe(r => {
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

describe('CollabSpaceOverviewComponent contributed cards', () => {
    it('draws one card per key, whatever spelling or order a driver appended them in', () => {
        const comp = new CollabSpaceOverviewComponent();
        comp.ContributedCards = [
            { key: 'deal-summary', title: 'Deal', sortKey: 15 },
            { key: 'Deal-Summary', title: 'Deal again', sortKey: 16 },
            { key: 'notice', title: 'Notice', sortKey: 20 },
        ];
        expect(comp.UniqueContributedCards.map((c) => c.title)).toEqual(['Deal', 'Notice']);
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
    comp.onPreviewAsPersona();
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
    comp.RowSelectRequested.subscribe(r => {
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

  it('emits ShareRequested on onShareRequested', () => {
    const comp = new CollabShareCheckDialogComponent();
    let payload: { applyFixes: boolean; note: string; notify: boolean } | null = null;
    comp.ShareRequested.subscribe(p => {
      payload = p;
    });

    comp.onShareRequested({ applyFixes: true, note: 'Done', notify: true });
    expect(payload).toEqual({ applyFixes: true, note: 'Done', notify: true });
  });
});

describe('CollabUploadDialogComponent', () => {
  it('switches between upload and link modes and updates detection', () => {
    const comp = new CollabUploadDialogComponent();
    expect(comp.activeMode).toBe('upload');

    comp.setMode('link');
    expect(comp.activeMode).toBe('link');

    // Detect Google Docs link
    comp.linkUrl = 'https://docs.google.com/document/d/12345/edit';
    comp.onUrlChange(comp.linkUrl);
    expect(comp.detectedKind).toBe('doc');
    expect(comp.detectedService?.label).toBe('Google Docs');

    // Detect Google Sheets link
    comp.linkUrl = 'https://docs.google.com/spreadsheets/d/12345/edit';
    comp.onUrlChange(comp.linkUrl);
    expect(comp.detectedKind).toBe('xls');
    expect(comp.detectedService?.label).toBe('Google Sheets');

    // Detect Microsoft 365 link
    comp.linkUrl = 'https://contoso.sharepoint.com/:x:/r/budget.xlsx';
    comp.onUrlChange(comp.linkUrl);
    expect(comp.detectedKind).toBe('xls');
    expect(comp.detectedService?.label).toBe('Microsoft 365');
  });

  it('validates submission readiness and emits SubmitRequested payload for link mode', () => {
    const comp = new CollabUploadDialogComponent();
    comp.setMode('link');
    comp.linkUrl = 'https://docs.google.com/document/d/999/edit';
    comp.docTitle = 'Project Proposal';
    comp.docFolder = 'Deliverables';
    comp.selectedBand = 'Shared';

    expect(comp.canSubmit).toBe(true);

    let submitted: CollabUploadSubmitPayload | null = null;
    comp.SubmitRequested.subscribe(p => {
      submitted = p;
    });

    comp.onSubmit();
    expect(submitted).toEqual({
      mode: 'link',
      title: 'Project Proposal',
      band: 'Shared',
      folder: 'Deliverables',
      kind: 'doc',
      fileName: undefined,
      fileSize: undefined,
      fileType: undefined,
      file: undefined,
      url: 'https://docs.google.com/document/d/999/edit',
    });
  });

  describe('the band it starts on and offers', () => {
    function submitted(comp: CollabUploadDialogComponent): CollabUploadSubmitPayload | null {
      comp.setMode('link');
      comp.linkUrl = 'https://docs.google.com/document/d/999/edit';
      comp.docTitle = 'Plan';
      let payload: CollabUploadSubmitPayload | null = null;
      comp.SubmitRequested.subscribe(p => {
        payload = p;
      });
      comp.onSubmit();
      return payload;
    }

    it("starts on the band the space type's default gives this seat, and sends it", () => {
      // Ada in Discovery, a Team-default space, where she may choose either band
      const ada = new CollabUploadDialogComponent();
      ada.AllowedBands = ['Shared', 'Team'];
      ada.StartBand = 'Team';
      expect(ada.selectedBand).toBe('Team');
      expect(submitted(ada)?.band).toBe('Team');
    });

    it('offers a seat that can only keep material on Team just that band', () => {
      // Sam, a Member in Discovery
      const sam = new CollabUploadDialogComponent();
      sam.AllowedBands = ['Team'];
      sam.StartBand = 'Team';
      expect(sam.IsBandAllowed('Team')).toBe(true);
      expect(sam.IsBandAllowed('Shared')).toBe(false);
      expect(submitted(sam)?.band).toBe('Team');
    });

    it('offers a client just Shared', () => {
      const client = new CollabUploadDialogComponent();
      client.AllowedBands = ['Shared'];
      client.StartBand = 'Shared';
      expect(client.IsBandAllowed('Team')).toBe(false);
      expect(submitted(client)?.band).toBe('Shared');
    });

    it("sends no band when the seat wasn't resolved and nothing was chosen, so the server applies the type's default", () => {
      const unknown = new CollabUploadDialogComponent();
      unknown.StartBand = null;
      expect(unknown.selectedBand).toBeNull();
      expect(submitted(unknown)?.band).toBeNull();
    });
  });

  it('emits CancelRequested on backdrop click or cancel button', () => {
    const comp = new CollabUploadDialogComponent();
    let cancelled = false;
    comp.CancelRequested.subscribe(() => {
      cancelled = true;
    });

    comp.onCancel();
    expect(cancelled).toBe(true);
  });
});

describe('CollabSpaceWorkComponent', () => {
  const sampleTasks: TaskItemModel[] = [
    { id: 't1', name: 'Draft specification', status: 'InProgress', priority: 'High', band: 'Shared' },
    { id: 't2', name: 'Internal review', status: 'Open', priority: 'Medium', band: 'Team' },
    { id: 't3', name: 'Sign off document', status: 'Completed', priority: 'Low', band: 'Shared' },
  ];

  it('computes correct stats and filters tasks by query and band', () => {
    const comp = new CollabSpaceWorkComponent();
    comp.Tasks = sampleTasks;

    expect(comp.TotalTasks).toBe(3);
    expect(comp.InProgressCount).toBe(1);
    expect(comp.CompletedCount).toBe(1);
    expect(comp.SharedCount).toBe(2);

    // Filter by band
    comp.bandFilter = 'Shared';
    expect(comp.filteredTasks.length).toBe(2);

    // Search filter
    comp.searchQuery = 'review';
    expect(comp.filteredTasks.length).toBe(0); // 'review' is Team band
    comp.bandFilter = 'all';
    expect(comp.filteredTasks.length).toBe(1);
  });

  it('emits TaskToggleRequested and CreateTaskRequested', () => {
    const comp = new CollabSpaceWorkComponent();
    comp.Tasks = sampleTasks;

    let toggled: TaskItemModel | null = null;
    comp.TaskToggleRequested.subscribe(t => {
      toggled = t;
    });
    comp.onToggleTask(sampleTasks[0]);
    expect(toggled).toBe(sampleTasks[0]);

    let created: { name: string; band: string; priority: string } | null = null;
    comp.CreateTaskRequested.subscribe(c => {
      created = c;
    });
    comp.newTaskName = 'New delivery milestone';
    comp.newTaskBand = 'Shared';
    comp.newTaskPriority = 'Critical';
    comp.submitNewTask();

    expect(created).toEqual({
      name: 'New delivery milestone',
      band: 'Shared',
      priority: 'Critical',
    });
    expect(comp.newTaskName).toBe('');
    expect(comp.isAddingTask).toBe(false);
  });
});

describe('the Work list follows the seat and the entity', () => {
  it('reads every stored status and priority as a label with its own badge class', () => {
    expect(taskStatusLabel('InProgress')).toBe('In progress');
    expect(taskStatusLabel('Open')).toBe('Open');
    expect(taskPriorityLabel('Critical')).toBe('Critical');
    for (const status of ['Open', 'InProgress', 'Blocked', 'Cancelled', 'Completed']) {
      expect(taskStatusClass(status)).toBe(`status-${status.toLowerCase()}`);
    }
    expect(taskPriorityClass('Critical')).toBe('priority-critical');
  });

  it('counts In progress on the stored value, and treats Cancelled as closed', () => {
    const comp = new CollabSpaceWorkComponent();
    comp.Tasks = [
      { id: 'a', name: 'A', status: 'InProgress', priority: 'High', band: 'Shared' },
      { id: 'b', name: 'B', status: 'Cancelled', priority: 'Low', band: 'Shared' },
    ];
    expect(comp.InProgressCount).toBe(1);
    comp.statusFilter = 'active';
    expect(comp.filteredTasks.map((t) => t.id)).toEqual(['a']);
  });

  it('does not emit a toggle from a read-only list', () => {
    const comp = new CollabSpaceWorkComponent();
    comp.ReadOnly = true;
    const toggled = vi.fn();
    comp.TaskToggleRequested.subscribe(toggled);
    comp.onToggleTask({ id: 'a', name: 'A', status: 'Open', priority: 'Low', band: 'Shared' });
    expect(toggled).not.toHaveBeenCalled();
  });

  it('files a Team-only seat on Team and a Shared-only seat on Shared, whatever the form held', () => {
    const teamOnly = new CollabSpaceWorkComponent();
    teamOnly.AllowedBands = ['Team'];
    teamOnly.DefaultBand = 'Shared';
    const created = vi.fn();
    teamOnly.CreateTaskRequested.subscribe(created);
    teamOnly.newTaskName = 'Internal';
    teamOnly.newTaskBand = 'Shared';
    teamOnly.submitNewTask();
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ band: 'Team' }));

    const sharedOnly = new CollabSpaceWorkComponent();
    sharedOnly.AllowedBands = ['Shared'];
    sharedOnly.DefaultBand = 'Team';
    const made = vi.fn();
    sharedOnly.CreateTaskRequested.subscribe(made);
    sharedOnly.newTaskName = 'Client note';
    sharedOnly.newTaskBand = 'Team';
    sharedOnly.submitNewTask();
    expect(made).toHaveBeenCalledWith(expect.objectContaining({ band: 'Shared' }));
  });
});

describe('the Library narrows by search, collection and view', () => {
  const rows: LibraryRowModel[] = [
    { id: 'r1', kind: 'doc', name: 'Brief', folder: 'Contracts', band: 'Shared', who: 'Ada', when: 'x' },
    { id: 'r2', kind: 'image', name: 'Site photo', folder: 'Photos', band: 'Shared', who: 'Bea', when: 'x' },
    { id: 'r3', kind: 'doc', name: 'Margin notes', folder: 'Photos', band: 'Team', who: 'Ada', when: 'x' },
  ];
  const collections = [{ id: 'folder-0', name: 'Contracts' }, { id: 'folder-1', name: 'Photos' }];

  it('filters by search text over name, folder and author', () => {
    expect(filterLibraryRows(rows, { band: 'All', search: 'photo', folderId: 'all', collections }).map((r) => r.id)).toEqual(['r2', 'r3']);
    expect(filterLibraryRows(rows, { band: 'All', search: 'bea', folderId: 'all', collections }).map((r) => r.id)).toEqual(['r2']);
  });

  it('filters by collection and by smart view', () => {
    expect(filterLibraryRows(rows, { band: 'All', search: '', folderId: 'folder-1', collections }).map((r) => r.id)).toEqual(['r2', 'r3']);
    expect(filterLibraryRows(rows, { band: 'All', search: '', folderId: 'shared', collections }).map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(filterLibraryRows(rows, { band: 'All', search: '', folderId: 'team', collections }).map((r) => r.id)).toEqual(['r3']);
  });

  it("filters Ada's Discovery Library to Photos, and the band tab narrows it further", () => {
    expect(filterLibraryRows(rows, { band: 'Shared', search: '', folderId: 'folder-1', collections }).map((r) => r.id)).toEqual(['r2']);
  });

  it("lists the ten most recently updated first for the Recently updated view", () => {
    const many: LibraryRowModel[] = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, kind: 'doc', name: `n${i}`, folder: 'f', band: 'Shared', who: 'w', when: 'x', updatedAt: new Date(2026, 8, i + 1).toISOString() }));
    const recent = filterLibraryRows(many, { band: 'All', search: '', folderId: 'recent', collections });
    expect(recent).toHaveLength(10);
    expect(recent[0].id).toBe('r11');
    expect(recent[9].id).toBe('r2');
  });

  it('marks the selected row and the selected tree row in any casing', () => {
    const library = new CollabSpaceLibraryComponent();
    library.Rows = [{ ...rows[0], id: 'ABCDEF00-0000-4000-8000-000000000001' }];
    library.SelectedRowId = 'abcdef00-0000-4000-8000-000000000001';
    expect(library.IsSelected('ABCDEF00-0000-4000-8000-000000000001')).toBe(true);
    expect(library.SelectedRow?.name).toBe('Brief');
  });
});

describe('the share dialog says when nothing was reviewed', () => {
  it('starts as not reviewed, and only a review that ran and found nothing reads clean', () => {
    const dialog = new CollabShareCheckComponent();
    expect(dialog.ReviewCompleted).toBe(false);
    expect(dialog.Findings).toEqual([]);
  });
});

describe('the People tab acts on seats and shows the invite the way the seat may make it', () => {
  const pat: SpaceMemberModel = { id: 'm9', userId: 'u9', name: 'Pat Invited', email: 'pat@example.com', initials: 'PI', roleName: 'Guest', roleCode: 'guest', band: 'Shared', status: 'Invited', canApprove: true, canRemove: true, canChangeRole: false };

  it('starts the invite form on the highest role the seat may grant', () => {
    const comp = new CollabSpacePeopleComponent();
    comp.RoleOptions = [{ code: 'client-member', label: 'Outside member' }, { code: 'guest', label: 'Guest' }];
    expect(comp.inviteRole).toBe('client-member');
    expect(comp.RoleOptions.map((o) => o.code)).toEqual(['client-member', 'guest']);
  });

  it('asks before it approves, then emits once confirmed, and not at all when cancelled', () => {
    const comp = new CollabSpacePeopleComponent();
    comp.Members = [pat];
    const approved = vi.fn();
    comp.ApproveMemberRequested.subscribe(approved);
    comp.Ask(pat, 'approve');
    expect(comp.pendingQuestion(pat)).toBe('Approve Pat Invited?');
    expect(approved).not.toHaveBeenCalled();
    comp.ConfirmPending();
    expect(approved).toHaveBeenCalledWith(pat);
    comp.Ask(pat, 'remove');
    comp.pending = null;
    comp.ConfirmPending();
    expect(approved).toHaveBeenCalledTimes(1);
  });

  it('emits a role change only for a different role, once confirmed', () => {
    const comp = new CollabSpacePeopleComponent();
    comp.Members = [pat];
    const changed = vi.fn();
    comp.ChangeRoleRequested.subscribe(changed);
    comp.AskRole(pat, 'guest');
    expect(comp.pending).toBeNull();
    comp.AskRole(pat, 'client-member');
    comp.ConfirmPending();
    expect(changed).toHaveBeenCalledWith({ member: pat, roleCode: 'client-member' });
  });

  it('keeps the sign-in link for the banner when the host has no email channel', () => {
    const comp = new CollabSpacePeopleComponent();
    comp.RedemptionUrl = 'https://host.example/redeem?t=abc';
    comp.InviteOutcome = { ok: true, message: 'Sign-in link created.' };
    expect(comp.RedemptionUrl).toBe('https://host.example/redeem?t=abc');
    expect(comp.InviteOutcome?.ok).toBe(true);
  });
});

describe('the rail: Jump to a space and the new-space button', () => {
  const nodes: RailSpaceNode[] = [
    { id: 's1', name: 'Northwind relationship', color: '', iconClass: '', level: 0, hasChildren: true, isExpanded: true },
    { id: 's2', name: 'Discovery', color: '', iconClass: '', level: 1, hasChildren: false, isExpanded: false },
  ];

  it('opens on ⌘J, narrows by what is typed, and Enter opens the first match', () => {
    const rail = new CollabSpaceRailComponent();
    rail.Spaces = nodes;
    const opened = vi.fn();
    rail.SpaceOpenRequested.subscribe(opened);
    const key = { key: 'j', metaKey: true, ctrlKey: false, preventDefault: vi.fn() };
    rail.onDocumentKeyDown(key);
    expect(rail.jumpOpen).toBe(true);
    rail.jumpQuery = 'disc';
    expect(rail.jumpMatches.map((s) => s.id)).toEqual(['s2']);
    rail.jumpToFirst();
    expect(opened).toHaveBeenCalledWith('s2');
    expect(rail.jumpOpen).toBe(false);
  });

  it('ignores other keys and closes on Escape', () => {
    const rail = new CollabSpaceRailComponent();
    rail.onDocumentKeyDown({ key: 'k', metaKey: true, ctrlKey: false, preventDefault: vi.fn() });
    expect(rail.jumpOpen).toBe(false);
    rail.OpenJump();
    rail.closeJump();
    expect(rail.jumpOpen).toBe(false);
  });

  it('does not offer the new-space button until a host provides the dialog', () => {
    expect(new CollabSpaceRailComponent().CanCreateSpace).toBe(false);
  });
});

describe('the upload dialog keeps its promises', () => {
  const fileOf = (name: string, size: number): File => ({ name, size, type: 'application/pdf' } as File);

  it('refuses a 12 MB file with a readable message, before reading it', () => {
    const dialog = new CollabUploadDialogComponent();
    dialog.onFileSelected({ target: { files: [fileOf('big.pdf', 12 * 1024 * 1024)] } } as unknown as Event);
    expect(dialog.selectedFile).toBeNull();
    expect(dialog.fileError).toBe('That file is 12 MB. Files can be up to 10 MB.');
  });

  it('takes a file within the limit, and stores it under the name typed with its own extension', () => {
    const dialog = new CollabUploadDialogComponent();
    const submitted = vi.fn();
    dialog.SubmitRequested.subscribe(submitted);
    dialog.onFileSelected({ target: { files: [fileOf('scan0042.pdf', 2 * 1024 * 1024)] } } as unknown as Event);
    dialog.docTitle = 'Signed engagement letter';
    dialog.onSubmit();
    expect(dialog.fileError).toBe('');
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'Signed engagement letter.pdf', title: 'Signed engagement letter' }));
  });

  it('closes on Escape, and not while it is saving', () => {
    const dialog = new CollabUploadDialogComponent();
    const cancelled = vi.fn();
    dialog.CancelRequested.subscribe(cancelled);
    const escape = { key: 'Escape', shiftKey: false, preventDefault: vi.fn() };
    dialog.OnDialogKeyDown(escape);
    expect(cancelled).toHaveBeenCalledTimes(1);
    dialog.IsSubmitting = true;
    dialog.OnDialogKeyDown(escape);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('refuses the close button and the backdrop while it is saving, as Escape is', () => {
    const dialog = new CollabUploadDialogComponent();
    const cancelled = vi.fn();
    dialog.CancelRequested.subscribe(cancelled);
    dialog.IsSubmitting = true;
    dialog.onCancel();
    dialog.onBackdropClick({ target: { classList: { contains: () => true } } } as unknown as MouseEvent);
    expect(cancelled).not.toHaveBeenCalled();
    dialog.IsSubmitting = false;
    dialog.onCancel();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('closes the share dialog on Escape', () => {
    const dialog = new CollabShareCheckDialogComponent();
    const cancelled = vi.fn();
    dialog.CancelRequested.subscribe(cancelled);
    dialog.OnDialogKeyDown({ key: 'Escape', shiftKey: false, preventDefault: vi.fn() });
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});

describe('Copy link says how it went', () => {
  const invited = () => {
    const people = new CollabSpacePeopleComponent();
    people.RedemptionUrl = 'https://host.example/redeem?t=abc';
    return people;
  };

  it('says Copied when the clipboard takes the link, and resets when the link changes', async () => {
    const people = invited();
    const writeText = vi.fn().mockResolvedValue(undefined);
    people.Clipboard = { writeText };
    await people.CopyLink();
    expect(writeText).toHaveBeenCalledWith('https://host.example/redeem?t=abc');
    expect(people.LinkStatus()).toBe('copied');
    people.RedemptionUrl = 'https://host.example/redeem?t=def';
    expect(people.LinkStatus()).toBe('idle');
  });

  it('says it could not copy when the clipboard refuses, or there is none', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const refused = invited();
      refused.Clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) };
      await refused.CopyLink();
      expect(refused.LinkStatus()).toBe('failed');
      const none = invited();
      none.Clipboard = null;
      await none.CopyLink();
      expect(none.LinkStatus()).toBe('failed');
    } finally {
      quiet.mockRestore();
    }
  });
});

describe('the Team row keeps Share as a control of its own', () => {
  it("emits the share request, and not the row's selection, when Share is activated", () => {
    const row = new CollabItemRowComponent();
    const shared = vi.fn();
    const selected = vi.fn();
    row.ShareRequested.subscribe(shared);
    row.RowSelectRequested.subscribe(selected);
    const stop = vi.fn();
    row.onShareClick({ stopPropagation: stop });
    expect(shared).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
  });
});

describe('CollabSpaceChatComponent', () => {
  it('initializes host inputs with proper defaults', () => {
    const comp = new CollabSpaceChatComponent();
    expect(comp.AllowMentions).toBe(true);
    expect(comp.AllowAttachments).toBe(false);
  });

  it('emits the new-conversation request', () => {
    const comp = new CollabSpaceChatComponent();

    let newConvoEmitted = false;
    comp.NewConversationRequested.subscribe(() => {
      newConvoEmitted = true;
    });
    comp.onNewConversation();
    expect(newConvoEmitted).toBe(true);

    let draftConsumed = false;
    comp.ComposerDraft = 'Draft text';
    comp.ComposerDraftConsumed.subscribe(() => {
      draftConsumed = true;
    });
    comp.onComposerDraftConsumed();
    expect(comp.ComposerDraft).toBeNull();
    expect(draftConsumed).toBe(true);

    let pendingConsumed = false;
    comp.PendingMessage = 'Hello world';
    comp.PendingMessageConsumed.subscribe(() => {
      pendingConsumed = true;
    });
    comp.onPendingMessageConsumed();
    expect(comp.PendingMessage).toBeNull();
    expect(pendingConsumed).toBe(true);
  });
});

describe('CollabNewConversationDialogComponent', () => {
  it('initializes with default values and trims input names', () => {
    const comp = new CollabNewConversationDialogComponent();
    expect(comp.name).toBe('');
    expect(comp.kind).toBe('General');
    expect(comp.IsSubmitting).toBe(false);
    expect(comp.AllowedKinds).toEqual(['General', 'Topic']);
    expect(comp.canShowPrivate).toBe(false);

    comp.name = '   Weekly Sync   ';
    expect(comp.trimmedName).toBe('Weekly Sync');
  });

  it('allows Private kind only when explicitly permitted in AllowedKinds', () => {
    const comp = new CollabNewConversationDialogComponent();
    comp.AllowedKinds = ['General', 'Topic', 'Private'];
    expect(comp.canShowPrivate).toBe(true);
  });

  it('emits SubmitRequested with cleaned name and selected kind', () => {
    const comp = new CollabNewConversationDialogComponent();
    comp.name = '  Sprint Planning  ';
    comp.kind = 'Topic';

    let submitted: NewConversationSubmitPayload | null = null;
    comp.SubmitRequested.subscribe(payload => {
      submitted = payload;
    });

    comp.onSubmit();
    expect(submitted).toEqual({
      name: 'Sprint Planning',
      kind: 'Topic',
    });
  });

  it('does not emit SubmitRequested when name is empty or IsSubmitting is true', () => {
    const comp = new CollabNewConversationDialogComponent();
    let emitted = false;
    comp.SubmitRequested.subscribe(() => {
      emitted = true;
    });

    comp.name = '   ';
    comp.onSubmit();
    expect(emitted).toBe(false);

    comp.name = 'Valid Name';
    comp.IsSubmitting = true;
    comp.onSubmit();
    expect(emitted).toBe(false);
  });

  it('emits CancelRequested on cancel and escape only when not submitting', () => {
    const comp = new CollabNewConversationDialogComponent();
    let cancelCount = 0;
    comp.CancelRequested.subscribe(() => {
      cancelCount++;
    });

    comp.onCancel();
    expect(cancelCount).toBe(1);

    const escape = { key: 'Escape', shiftKey: false, preventDefault: vi.fn() };
    comp.OnDialogKeyDown(escape);
    expect(cancelCount).toBe(2);

    comp.IsSubmitting = true;
    comp.onCancel();
    comp.OnDialogKeyDown(escape);
    expect(cancelCount).toBe(2);
  });

  describe('focus after a submit ends', () => {
    afterEach(() => vi.useRealTimers());

    /** The dialog's ViewChild is private and only set by rendering; a stand-in field is the one cast here. */
    function withNameInput(comp: CollabNewConversationDialogComponent): () => number {
      const focus = vi.fn();
      (comp as unknown as { nameInputElement: { nativeElement: { focus: () => void } } }).nameInputElement = { nativeElement: { focus } };
      return () => focus.mock.calls.length;
    }

    it('puts the focus back on the name field when a submit that was running ends', () => {
      vi.useFakeTimers();
      const comp = new CollabNewConversationDialogComponent();
      const focused = withNameInput(comp);
      comp.ngOnChanges({ IsSubmitting: new SimpleChange(true, false, false) });
      expect(focused()).toBe(0);
      vi.runAllTimers();
      expect(focused()).toBe(1);
    });

    it('does not move the focus when a submit starts', () => {
      vi.useFakeTimers();
      const comp = new CollabNewConversationDialogComponent();
      const focused = withNameInput(comp);
      comp.ngOnChanges({ IsSubmitting: new SimpleChange(false, true, false) });
      vi.runAllTimers();
      expect(focused()).toBe(0);
    });

    it('does not touch the field after the dialog is destroyed', () => {
      vi.useFakeTimers();
      const comp = new CollabNewConversationDialogComponent();
      const focused = withNameInput(comp);
      comp.ngOnChanges({ IsSubmitting: new SimpleChange(true, false, false) });
      comp.ngOnDestroy();
      vi.runAllTimers();
      expect(focused()).toBe(0);
    });
  });
});

describe('CollabSpacePeopleComponent', () => {
  const sampleMembers: SpaceMemberModel[] = [
    { id: 'm1', userId: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', initials: 'AL', roleName: 'Owner', roleCode: 'owner', band: 'Team', status: 'Active' },
    { id: 'm2', userId: 'u2', name: 'Bea Client', email: 'bea@client.com', initials: 'BC', roleName: 'Outside Member', roleCode: 'client-member', band: 'Shared', status: 'Active' },
    { id: 'm3', userId: 'u3', name: 'Pat Invited', email: 'pat@example.com', initials: 'PI', roleName: 'Member', roleCode: 'member', band: 'Team', status: 'Invited' },
  ];

  it('calculates roster counts and filters by audience and search query', () => {
    const comp = new CollabSpacePeopleComponent();
    comp.Members = sampleMembers;

    // Pat is Invited: still a row in the list, but not counted
    expect(comp.filteredMembers.map(m => m.name)).toContain('Pat Invited');
    expect(comp.TotalMembers).toBe(2);
    expect(comp.TeamCount).toBe(1);
    expect(comp.OutsideCount).toBe(1);
    expect(comp.InvitedCount).toBe(1);

    comp.audienceFilter = 'Shared';
    expect(comp.filteredMembers.length).toBe(1);
    expect(comp.filteredMembers[0].name).toBe('Bea Client');

    comp.audienceFilter = 'all';
    comp.searchQuery = 'lovelace';
    expect(comp.filteredMembers.length).toBe(1);
    expect(comp.filteredMembers[0].name).toBe('Ada Lovelace');
  });

  describe('inviting a person', () => {
    function withForm(): { comp: CollabSpacePeopleComponent; invited: Array<{ email: string; role: string }> } {
      const comp = new CollabSpacePeopleComponent();
      const invited: Array<{ email: string; role: string }> = [];
      comp.InviteMemberRequested.subscribe(i => invited.push(i));
      comp.isInviting = true;
      comp.inviteEmail = 'newperson@example.com';
      comp.inviteRole = 'client-member';
      return { comp, invited };
    }

    it('emits the email and the role, and leaves the form as it is until the server answers', () => {
      const { comp, invited } = withForm();
      comp.submitInvite();
      expect(invited).toEqual([{ email: 'newperson@example.com', role: 'client-member' }]);
      expect(comp.inviteEmail).toBe('newperson@example.com');
      expect(comp.isInviting).toBe(true);
    });

    it('clears and closes the form when the invite succeeded, and shows what the server said', () => {
      const { comp } = withForm();
      comp.submitInvite();
      comp.InviteOutcome = { ok: true, message: 'They are seated as Invited. The sign-in link waits until an owner approves them.' };
      expect(comp.inviteEmail).toBe('');
      expect(comp.isInviting).toBe(false);
      expect(comp.InviteOutcome?.message).toContain('waits until an owner approves');
    });

    it('keeps the form open, with the email, when the invite was refused', () => {
      const { comp } = withForm();
      comp.submitInvite();
      comp.InviteOutcome = { ok: false, message: 'Invite refused: this role cannot invite.' };
      expect(comp.inviteEmail).toBe('newperson@example.com');
      expect(comp.isInviting).toBe(true);
      expect(comp.InviteOutcome?.ok).toBe(false);
    });

    it("forgets a refusal when the form is cancelled or reopened, so it doesn't greet the next invite", () => {
      const { comp } = withForm();
      comp.InviteOutcome = { ok: false, message: 'Invite refused: this role cannot invite.' };
      const dismissed = vi.fn();
      comp.InviteOutcomeDismissed.subscribe(dismissed);
      comp.CancelInvite();
      expect(comp.InviteOutcome).toBeNull();
      expect(dismissed).toHaveBeenCalledTimes(1);
      comp.isInviting = true;
      comp.InviteOutcome = { ok: false, message: 'Invite refused again.' };
      comp.ToggleInviteForm(); // closes
      comp.ToggleInviteForm(); // reopens, clean
      expect(comp.isInviting).toBe(true);
      expect(comp.InviteOutcome).toBeNull();
    });

    it('keeps a success message until it is dismissed, outside the form that closed', () => {
      const { comp } = withForm();
      comp.InviteOutcome = { ok: true, message: 'They are seated.' };
      expect(comp.isInviting).toBe(false);
      expect(comp.InviteOutcome?.message).toBe('They are seated.');
      const dismissed = vi.fn();
      comp.InviteOutcomeDismissed.subscribe(dismissed);
      comp.DismissInviteOutcome();
      expect(comp.InviteOutcome).toBeNull();
      expect(dismissed).toHaveBeenCalledTimes(1);
    });

    it('sends nothing for a blank email', () => {
      const { comp, invited } = withForm();
      comp.inviteEmail = '   ';
      comp.submitInvite();
      expect(invited).toEqual([]);
    });
  });
});

describe('CollabSpaceSettingsComponent', () => {
  const initialSettings: SpaceSettingsModel = {
    id: 's1',
    name: 'Northwind relationship',
    description: 'Lead engagement space',
    spaceType: 'Workspace',
    spaceTypeId: 'st1',
    iconClass: 'fa-solid fa-briefcase',
    color: '#0076b6',
    backgroundImageUrl: 'https://example.com/banner.jpg',
    inheritsMembership: true,
    agentRetrieval: 'Included',
    retention: 'Indefinite',
    status: 'Active',
  };

  it('initializes form data and emits SaveSettingsRequested', () => {
    const comp = new CollabSpaceSettingsComponent();
    comp.Settings = initialSettings;
    comp.ngOnInit();

    expect(comp.formData.name).toBe('Northwind relationship');
    expect(comp.formData.color).toBe('#0076b6');

    let saved: SpaceSettingsModel | null = null;
    comp.SaveSettingsRequested.subscribe(s => {
      saved = s;
    });

    comp.formData.name = 'Northwind strategic relationship';
    comp.formData.color = '#0284c7';
    comp.saveChanges();

    expect(saved).not.toBeNull();
    expect(saved!.name).toBe('Northwind strategic relationship');
    expect(saved!.color).toBe('#0284c7');
  });
});




describe('CollabDialogBase focus', () => {
  class Probe extends CollabDialogBase {
    public asked: string[] = [];
    public focused: string[] = [];
    protected override DialogBox() {
      const ask = (selector: string) => { this.asked.push(selector); return null; };
      return { nativeElement: { querySelector: ask } } as unknown as ElementRef<HTMLElement>;
    }
    protected override Dismiss(): void { /* not used */ }
    public first() { return this.FirstFocus(); }
    public schedule() { this.ScheduleFirstFocus(); }
    protected override FirstFocus(): HTMLElement | null {
      this.focused.push('asked');
      return super.FirstFocus();
    }
  }

  it("never lands on the header's close button first, so Enter right after opening doesn't close the dialog", () => {
    const probe = new Probe();
    probe.first();
    const buttonQuery = probe.asked.find((q) => q.startsWith('button'));
    expect(buttonQuery).toContain(':not(.btn-close)');
    expect(probe.asked[0]).toContain('data-autofocus');
  });

  it('cancels a pending focus when the dialog is destroyed', () => {
    vi.useFakeTimers();
    try {
      const probe = new Probe();
      probe.schedule();
      probe.ngOnDestroy();
      vi.runAllTimers();
      expect(probe.focused).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('focuses on the next turn when it is not destroyed', () => {
    vi.useFakeTimers();
    try {
      const probe = new Probe();
      probe.schedule();
      vi.runAllTimers();
      expect(probe.focused).toEqual(['asked']);
    } finally {
      vi.useRealTimers();
    }
  });
});
