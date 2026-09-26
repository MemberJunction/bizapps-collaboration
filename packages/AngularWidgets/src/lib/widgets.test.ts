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
  it('uses explicit colorClass when provided', () => {
    const comp = new CollabAvatarComponent();
    comp.initials = 'AL';
    comp.colorClass = 'c5';
    expect(comp.computedColorClass).toBe('c5');
  });

  it('computes stable colorClass from personId when colorClass not provided', () => {
    const comp = new CollabAvatarComponent();
    comp.initials = 'SO';
    comp.personId = 'user-sam-okafor';
    const computed = comp.computedColorClass;
    expect(computed).toMatch(/^c([1-9]|10)$/);
  });

  it('computes stable colorClass from name as fallback', () => {
    const comp = new CollabAvatarComponent();
    comp.name = 'Priya Shah';
    const computed = comp.computedColorClass;
    expect(computed).toMatch(/^c([1-9]|10)$/);
  });

  it('defaults to c1 when no identifier provided', () => {
    const comp = new CollabAvatarComponent();
    expect(comp.computedColorClass).toBe('c1');
  });
});

describe('CollabAvatarStackComponent', () => {
  it('slices visible avatars to max and computes moreCount', () => {
    const comp = new CollabAvatarStackComponent();
    comp.max = 3;
    comp.avatars = [
      { initials: 'A', name: 'Alice' },
      { initials: 'B', name: 'Bob' },
      { initials: 'C', name: 'Charlie' },
      { initials: 'D', name: 'David' },
      { initials: 'E', name: 'Eve' }
    ];

    expect(comp.visibleAvatars.length).toBe(3);
    expect(comp.computedMoreCount).toBe(2);
  });

  it('respects explicit moreCount when provided', () => {
    const comp = new CollabAvatarStackComponent();
    comp.max = 4;
    comp.moreCount = 10;
    comp.avatars = [{ initials: 'A' }];
    expect(comp.computedMoreCount).toBe(10);
  });

  it('handles empty avatars gracefully', () => {
    const comp = new CollabAvatarStackComponent();
    comp.avatars = [];
    expect(comp.visibleAvatars.length).toBe(0);
    expect(comp.computedMoreCount).toBe(0);
  });
});

describe('CollabTypeTileComponent', () => {
  it('has defaults and accepts custom inputs', () => {
    const comp = new CollabTypeTileComponent();
    expect(comp.iconClass).toBe('fa-solid fa-shapes');
    expect(comp.size).toBe('md');
    expect(comp.isClosed).toBe(false);

    comp.iconClass = 'fa-solid fa-compass';
    comp.typeCode = 'eng';
    comp.size = 'xl';
    comp.color = '#0076b6';
    comp.isClosed = true;

    expect(comp.iconClass).toBe('fa-solid fa-compass');
    expect(comp.typeCode).toBe('eng');
    expect(comp.size).toBe('xl');
    expect(comp.color).toBe('#0076b6');
    expect(comp.isClosed).toBe(true);
  });
});

describe('CollabBandChipComponent', () => {
  it('correctly reports isShared and defaults label', () => {
    const comp = new CollabBandChipComponent();
    comp.band = 'Shared';
    expect(comp.isShared).toBe(true);

    comp.band = 'Team';
    expect(comp.isShared).toBe(false);
  });
});

describe('CollabAudiencePillComponent', () => {
  it('accepts staff and outside avatar arrays and summary', () => {
    const comp = new CollabAudiencePillComponent();
    comp.staffAvatars = [{ initials: 'AL' }];
    comp.outsideAvatars = [{ initials: 'CM', isOutside: true }];
    comp.totalPeople = 9;
    comp.summary = '3 Meridian · 6 Northwind';

    expect(comp.totalPeople).toBe(9);
    expect(comp.summary).toBe('3 Meridian · 6 Northwind');
    expect(comp.staffAvatars.length).toBe(1);
    expect(comp.outsideAvatars.length).toBe(1);
  });
});

describe('CollabSpaceTabsComponent', () => {
  it('emits tabChange when selectTab is called with new tab id', () => {
    const comp = new CollabSpaceTabsComponent();
    comp.tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'library', label: 'Library', count: 24 }
    ];
    comp.activeTab = 'overview';

    let emitted: string | null = null;
    comp.tabChange.subscribe(id => {
      emitted = id;
    });

    comp.selectTab('library');
    expect(comp.activeTab).toBe('library');
    expect(emitted).toBe('library');

    // Selecting already active tab does not re-emit
    emitted = null;
    comp.selectTab('library');
    expect(emitted).toBeNull();
  });

  it('handles onTabActivateRequested from keyboard directive', () => {
    const comp = new CollabSpaceTabsComponent();
    comp.tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'library', label: 'Library' },
      { id: 'work', label: 'Work' }
    ];
    comp.activeTab = 'overview';

    let emitted: string | null = null;
    comp.tabChange.subscribe(id => {
      emitted = id;
    });

    comp.onTabActivateRequested({ Index: 2 });
    expect(comp.activeTab).toBe('work');
    expect(emitted).toBe('work');
  });
});

describe('CollabSpaceRailComponent', () => {
  it('emits navSelect when selectNav is called', () => {
    const comp = new CollabSpaceRailComponent();
    let emitted: string | null = null;
    comp.navSelect.subscribe(nav => {
      emitted = nav;
    });

    comp.selectNav('inbox');
    expect(comp.activeNav).toBe('inbox');
    expect(emitted).toBe('inbox');
  });

  it('emits spaceSelect when selectSpace is called', () => {
    const comp = new CollabSpaceRailComponent();
    let emitted: string | null = null;
    comp.spaceSelect.subscribe(id => {
      emitted = id;
    });

    comp.selectSpace('space-123');
    expect(comp.activeSpaceId).toBe('space-123');
    expect(emitted).toBe('space-123');
  });

  it('toggles isExpanded on node with children and emits spaceToggle', () => {
    const comp = new CollabSpaceRailComponent();
    const node: RailSpaceNode = {
      id: 'space-northwind',
      name: 'Northwind',
      typeCode: 'rel',
      iconClass: 'fa-solid fa-building',
      hasChildren: true,
      isExpanded: false
    };

    let emittedNode: RailSpaceNode | null = null;
    comp.spaceToggle.subscribe(n => {
      emittedNode = n;
    });

    let stopped = false;
    const mockEvent = {
      stopPropagation: () => {
        stopped = true;
      }
    };

    comp.toggleSpace(node, mockEvent);
    expect(stopped).toBe(true);
    expect(node.isExpanded).toBe(true);
    expect(emittedNode).toBe(node);
  });
});
