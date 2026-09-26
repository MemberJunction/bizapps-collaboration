import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { CollabAvatarComponent } from './avatar.component.ts';
import { CollabAvatarStackComponent } from './avatar-stack.component.ts';
import { CollabTypeTileComponent } from './type-tile.component.ts';
import { CollabBandChipComponent } from './band-chip.component.ts';
import { CollabAudiencePillComponent } from './audience-pill.component.ts';
import { CollabSpaceTabsComponent } from './space-tabs.component.ts';
import { CollabSpaceRailComponent } from './space-rail.component.ts';
import { RailSpaceNode } from './types.ts';

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
});
