// @vitest-environment jsdom
import '@angular/compiler';
import { ChangeDetectionStrategy } from '@angular/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import {
  buildUploadIngestDisclosureModel,
  CollabSpaceLibraryComponent,
  CollabUploadDialogComponent,
  CollabUploadIngestDisclosureComponent,
  UploadIngestDisclosureComponent,
} from '../public-api.ts';

beforeAll(() => {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

function assertZeroRawMarkdown(text: string): void {
  expect(text).not.toContain('###');
  expect(text).not.toContain('**');
  expect(text).not.toContain('`');
  expect(text).not.toContain('[cite:');
  expect(text).not.toContain('[source:');
}

describe('CollabUploadIngestDisclosureComponent (XS-8)', () => {
  it('exports both CollabUploadIngestDisclosureComponent and UploadIngestDisclosureComponent with OnPush strategy', () => {
    expect(UploadIngestDisclosureComponent).toBe(CollabUploadIngestDisclosureComponent);
    const cmpMeta: object | undefined = Reflect.get(CollabUploadIngestDisclosureComponent, 'ɵcmp');
    expect(cmpMeta).toBeDefined();
    expect(cmpMeta ? Reflect.get(cmpMeta, 'onPush') : false).toBe(true);
    expect(ChangeDetectionStrategy.OnPush).toBeDefined();
  });

  it('renders collapsed by default with domain-neutral copy, ARIA attributes, and expands/collapses on click', async () => {
    const fixture = TestBed.createComponent(CollabUploadIngestDisclosureComponent);
    const expandedEvents: boolean[] = [];
    fixture.componentInstance.ExpandedChange.subscribe((v) => expandedEvents.push(v));

    fixture.componentRef.setInput('SpaceName', '### **Quarterly Review Space** [source:1]');
    fixture.componentRef.setInput('Mode', 'upload');
    fixture.componentRef.setInput('SelectedBand', 'Shared');
    fixture.componentRef.setInput('MaxBytes', 10 * 1024 * 1024);
    fixture.componentRef.setInput('AgentRetrieval', 'Included');
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const region = host.querySelector<HTMLElement>('[data-testid="upload-ingest-disclosure"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('region');

    const pill = host.querySelector<HTMLElement>('[data-testid="disclosure-band-pill"]');
    expect(pill?.textContent?.trim()).toBe('Shared band');

    const summary = host.querySelector<HTMLElement>('[data-testid="disclosure-summary"]')?.textContent ?? '';
    expect(summary).toContain('Quarterly Review Space');
    expect(summary).toContain('MemberJunction Storage');
    expect(summary).toContain('shared band reach');
    assertZeroRawMarkdown(host.textContent ?? '');

    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="disclosure-toggle"]')!;
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const controlsId = toggle.getAttribute('aria-controls');
    expect(controlsId).toMatch(/^mjc-upload-disclosure-panel-/);
    expect(host.querySelector('[data-testid="disclosure-details-panel"]')).toBeNull();

    // Expand details drawer
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(expandedEvents).toEqual([true]);

    const panel = host.querySelector<HTMLElement>('[data-testid="disclosure-details-panel"]')!;
    expect(panel).not.toBeNull();
    expect(panel.id).toBe(controlsId);
    expect(panel.getAttribute('role')).toBe('region');

    expect(panel.querySelector('[data-testid="disclosure-item-ingest"]')?.textContent).toContain('10 MB');
    expect(panel.querySelector('[data-testid="disclosure-item-indexing"]')?.textContent).toContain('Content Pipeline');
    expect(panel.querySelector('[data-testid="disclosure-item-visibility"]')?.textContent).toContain('external space participants');
    expect(panel.querySelector('[data-testid="disclosure-item-retention"]')?.textContent).toContain('tombstones its content item');
    assertZeroRawMarkdown(panel.textContent ?? '');

    // Collapse again
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-testid="disclosure-details-panel"]')).toBeNull();
    expect(expandedEvents).toEqual([true, false]);
  });

  it('updates disclosure copy for link mode, Team band, and AgentRetrieval exclusion without leaking Markdown', async () => {
    const fixture = TestBed.createComponent(CollabUploadIngestDisclosureComponent);
    fixture.componentRef.setInput('SpaceName', 'Working Group');
    fixture.componentRef.setInput('Mode', 'link');
    fixture.componentRef.setInput('SelectedBand', 'Team');
    fixture.componentRef.setInput('CanSeeTeamBand', true);
    fixture.componentRef.setInput('AgentRetrieval', 'ExcludedEntirely');
    fixture.componentRef.setInput('DefaultExpanded', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="disclosure-band-pill"]')?.textContent?.trim()).toBe('Team band');
    expect(host.querySelector('[data-testid="disclosure-summary"]')?.textContent).toContain('external reference');
    expect(host.querySelector('[data-testid="disclosure-item-ingest"]')?.textContent).toContain('without copying binary bytes');
    expect(host.querySelector('[data-testid="disclosure-item-indexing"]')?.textContent).toContain('not automatically fetched');
    expect(host.querySelector('[data-testid="disclosure-item-visibility"]')?.textContent).toContain('Team band items are visible only to team seats');
    assertZeroRawMarkdown(host.textContent ?? '');

    const excludedUploadModel = buildUploadIngestDisclosureModel({
      spaceName: 'Working Group',
      mode: 'upload',
      selectedBand: null,
      agentRetrieval: 'ExcludedEntirely',
    });
    expect(excludedUploadModel.bandKind).toBe('Default');
    expect(excludedUploadModel.items[1].description).toContain('assistant retrieval is currently excluded');

    const parentExcludedModel = buildUploadIngestDisclosureModel({
      spaceName: 'Working Group',
      mode: 'upload',
      selectedBand: 'Shared',
      agentRetrieval: 'ExcludedFromParentScope',
    });
    expect(parentExcludedModel.items[1].description).toContain('excluded from parent-space queries');
  });

  it('prevents Team band badge when CanSeeTeamBand is false and renders inside CollabUploadDialogComponent & CollabSpaceLibraryComponent', async () => {
    const restrictedModel = buildUploadIngestDisclosureModel({
      spaceName: 'Partner Room',
      mode: 'upload',
      selectedBand: 'Team',
      canSeeTeamBand: false,
    });
    expect(restrictedModel.bandKind).toBe('Default');

    const dialogFixture = TestBed.createComponent(CollabUploadDialogComponent);
    dialogFixture.componentRef.setInput('SpaceName', 'Partner Room');
    dialogFixture.componentRef.setInput('AllowedBands', ['Shared']);
    dialogFixture.componentRef.setInput('StartBand', 'Shared');
    dialogFixture.componentRef.setInput('DisclosureDefaultExpanded', true);
    dialogFixture.detectChanges();
    await dialogFixture.whenStable();

    const dialogHost = dialogFixture.nativeElement as HTMLElement;
    expect(dialogHost.querySelector('[data-testid="upload-ingest-disclosure"]')).not.toBeNull();
    expect(dialogHost.querySelector('[data-testid="disclosure-details-panel"]')).not.toBeNull();
    expect(dialogHost.querySelector('[data-testid="disclosure-band-pill"]')?.textContent?.trim()).toBe('Shared band');
    dialogFixture.destroy();

    const libraryFixture = TestBed.createComponent(CollabSpaceLibraryComponent);
    libraryFixture.componentRef.setInput('SpaceName', 'Partner Room');
    libraryFixture.componentRef.setInput('ShowUploadDisclosure', true);
    libraryFixture.componentRef.setInput('CanSeeTeamSide', false);
    libraryFixture.componentRef.setInput('DefaultUploadBand', 'Shared');
    libraryFixture.detectChanges();
    await libraryFixture.whenStable();

    const libHost = libraryFixture.nativeElement as HTMLElement;
    // Collapsed by default behind the compact Upload info toggle so the file list isn't visually overwhelmed
    expect(libHost.querySelector('[data-testid="upload-ingest-disclosure"]')).toBeNull();
    const infoBtn = libHost.querySelector<HTMLButtonElement>('[data-testid="lib-upload-info-toggle"]');
    expect(infoBtn).not.toBeNull();
    infoBtn?.click();
    libraryFixture.detectChanges();
    await libraryFixture.whenStable();
    expect(libHost.querySelector('[data-testid="upload-ingest-disclosure"]')).not.toBeNull();
    expect(libHost.querySelector('[data-testid="disclosure-band-pill"]')?.textContent?.trim()).toBe('Shared band');
  });
});
