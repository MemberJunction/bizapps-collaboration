// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import {
  buildSourceImageForEdit,
  buildSpaceAvatarPrompt,
  CollabSpaceAvatarStudioComponent,
  convertDataUrlToPngBase64,
  extractGeneratedImageSource,
  SPACE_AVATAR_REFINE_PNG_SIZE,
  SPACE_AVATAR_STYLE_PRESETS,
} from './space-avatar-studio.component';
import { CollabNewSpaceDialogComponent, type NewSpaceTypeOption } from './new-space-dialog.component';
import { CollabSpaceSettingsComponent } from './space-settings.component';
import { CollabTypeTileComponent } from './type-tile.component';
import { CollabSpaceLibraryComponent } from './space-library.component';
import type { SpaceSettingsModel } from './types';

beforeAll(() => {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Space Avatar Studio helpers', () => {
  it('builds a contextual square avatar prompt from name, kind, description, preset, and color', () => {
    const prompt = buildSpaceAvatarPrompt({
      name: 'Northwind Executive Hub',
      description: 'Quarterly strategy and executive deliverables',
      kind: 'Client Hub',
      stylePresetId: '3d-isometric-emblem',
      color: '#2563eb', // hex-ok: test fixture color
    });
    expect(prompt).toContain('Northwind Executive Hub');
    expect(prompt).toContain('Client Hub');
    expect(prompt).toContain('Quarterly strategy');
    expect(prompt).toContain('3D isometric');
    expect(prompt).toContain('#2563eb'); // hex-ok: test fixture assertion
    expect(SPACE_AVATAR_STYLE_PRESETS.length).toBe(5);
  });

  it('extracts base64 data URI and URL outputs from MJServer CopyScalarsAndArrays indexed ResultData, Params arrays (JSON-stringified & object array), and wrapped payloads', () => {
    // 1. Exact MJServer ActionResolver ResultData shape: CopyScalarsAndArrays(projected) -> indexed object map
    const indexedResultData = JSON.stringify({
      '0': {
        Name: 'Images',
        Type: 'Output',
        Value: [{ modality: 'Image', mimeType: 'image/png', data: 'iVBORw0KGgoIndexed=' }],
      },
      '1': { Name: 'ImageCount', Type: 'Output', Value: 1 },
    });
    expect(extractGeneratedImageSource(indexedResultData)).toBe('data:image/png;base64,iVBORw0KGgoIndexed=');

    // 2. RunActionResultLike with Params containing JSON-stringified Images array
    expect(
      extractGeneratedImageSource({
        Success: true,
        Params: [
          {
            Name: 'Images',
            Type: 'Output',
            Value: JSON.stringify([{ data: 'iVBORw0KGgoJsonStr=', mimeType: 'image/png' }]),
          },
        ],
      }),
    ).toBe('data:image/png;base64,iVBORw0KGgoJsonStr=');

    // 3. RunActionResultLike with Params containing direct object array (takes precedence over ResultData)
    expect(
      extractGeneratedImageSource({
        Success: true,
        Params: [
          {
            Name: 'Images',
            Type: 'Output',
            Value: [{ data: 'iVBORw0KGgoObjArr=', mimeType: 'image/png' }],
          },
        ],
        ResultData: JSON.stringify([
          { Name: 'Images', Value: [{ data: 'fallbackIgnored=', mimeType: 'image/png' }] },
        ]),
      }),
    ).toBe('data:image/png;base64,iVBORw0KGgoObjArr=');

    // 4. RunActionResultLike falling back to ResultData when Params is absent
    expect(
      extractGeneratedImageSource({
        Success: true,
        ResultData: indexedResultData,
      }),
    ).toBe('data:image/png;base64,iVBORw0KGgoIndexed=');

    // 5. Array ResultData & wrapped Params URL
    const base64Result = JSON.stringify([
      {
        Name: 'Images',
        Type: 'Output',
        Value: [{ modality: 'Image', mimeType: 'image/png', data: 'iVBORw0KGgo=' }],
      },
    ]);
    expect(extractGeneratedImageSource(base64Result)).toBe('data:image/png;base64,iVBORw0KGgo=');

    const wrappedResult = JSON.stringify({
      Params: [
        {
          Name: 'Images',
          Value: [{ url: 'https://cdn.example.com/avatar.webp' }],
        },
      ],
    });
    expect(extractGeneratedImageSource(wrappedResult)).toBe('https://cdn.example.com/avatar.webp');
    expect(extractGeneratedImageSource('')).toBeNull();
    expect(extractGeneratedImageSource('{not-json')).toBeNull();
  });

  it('converts WebP data URIs to 256x256 PNG base64 for SourceImage edit refinement and preserves cached PNGs and HTTPS URLs', async () => {
    // Cached PNG short-circuit
    expect(
      await buildSourceImageForEdit('data:image/webp;base64,WEBP123', {
        DataUri: 'data:image/webp;base64,WEBP123',
        PngBase64: 'CACHED_PNG_BASE64',
      }),
    ).toBe('CACHED_PNG_BASE64');

    // HTTPS URL pass-through
    expect(await buildSourceImageForEdit('https://cdn.example.com/logo.png')).toBe(
      'https://cdn.example.com/logo.png',
    );

    // Canvas conversion from data:image/webp;base64,... -> 256x256 PNG stripped of prefix
    const drawImageSpy = vi.fn();
    const clearRectSpy = vi.fn();
    const toDataUrlSpy = vi.fn().mockReturnValue('data:image/png;base64,CONVERTED_PNG_BYTES');
    const origCreateElement = document.createElement.bind(document);
    let createdCanvas: HTMLCanvasElement | null = null;
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = origCreateElement('canvas');
        vi.spyOn(canvas, 'getContext').mockReturnValue({
          clearRect: clearRectSpy,
          drawImage: drawImageSpy,
        } as CanvasRenderingContext2D);
        vi.spyOn(canvas, 'toDataURL').mockImplementation(toDataUrlSpy);
        createdCanvas = canvas;
        return canvas;
      }
      return origCreateElement(tagName);
    }) as typeof document.createElement);

    const OriginalImage = globalThis.Image;
    class MockImage {
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public crossOrigin = '';
      public set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    try {
      const converted = await convertDataUrlToPngBase64('data:image/webp;base64,RAW_WEBP_DATA');
      expect(converted).toBe('CONVERTED_PNG_BYTES');
      expect(createdCanvas!.width).toBe(SPACE_AVATAR_REFINE_PNG_SIZE);
      expect(createdCanvas!.height).toBe(SPACE_AVATAR_REFINE_PNG_SIZE);
      expect(drawImageSpy).toHaveBeenCalledWith(expect.any(MockImage), 0, 0, 256, 256);
      expect(toDataUrlSpy).toHaveBeenCalledWith('image/png');

      const built = await buildSourceImageForEdit('data:image/webp;base64,RAW_WEBP_DATA');
      expect(built).toBe('CONVERTED_PNG_BYTES');
    } finally {
      vi.stubGlobal('Image', OriginalImage);
    }
  });

  it('invokes Generate Image with clean params, extracts MJServer indexed ResultData, and passes PNG SourceImage on refine', async () => {
    const gqlCalls: Array<{ query: string; variables?: Record<string, object | string | number | boolean | null | undefined> }> = [];
    const mockProvider = {
      ExecuteGQL: vi.fn(
        async (
          query: string,
          variables?: Record<string, object | string | number | boolean | null | undefined>,
        ) => {
          gqlCalls.push({ query, variables });
          return {
            RunAction: {
              Success: true,
              ResultCode: 'IMAGES_GENERATED',
              ResultData: JSON.stringify({
                '0': {
                  Name: 'Images',
                  Type: 'Output',
                  Value: [{ modality: 'Image', mimeType: 'image/png', data: 'GENERATED_PNG_B64' }],
                },
              }),
            },
          };
        },
      ),
    };

    const fixture = TestBed.createComponent(CollabSpaceAvatarStudioComponent);
    fixture.componentRef.setInput('SpaceName', 'Board of Directors');
    fixture.componentRef.setInput('SpaceTypeName', 'Board');
    fixture.componentRef.setInput('Provider', mockProvider);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    const emitted: Array<{ imageUrl: string | null; iconClass: string; color: string }> = [];
    comp.AvatarChange.subscribe((payload) => emitted.push(payload));

    // Stub Image so downscaleImageToSquareWebp resolves immediately in jsdom
    const OriginalImage = globalThis.Image;
    class ImmediateErrorImage {
      public onerror: (() => void) | null = null;
      public set src(_v: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', ImmediateErrorImage);

    try {
      await comp.generateAvatar(false);
      expect(comp.statusError).toBe('');
      expect(comp.currentImageUrl).toBe('data:image/png;base64,GENERATED_PNG_B64');
      expect(emitted).toHaveLength(1);

      const firstInput = (gqlCalls[0].variables as { input: { Params: Array<{ Name: string; Value: string }> } }).input;
      expect(firstInput.Params.map((p) => p.Name)).toEqual(['Prompt', 'NumberOfImages', 'Size', 'OutputFormat']);

      // Iterative refinement passes raw PNG base64 as SourceImage (not data:image/webp URI)
      comp.refineInstruction = 'Bolder contrast';
      await comp.generateAvatar(true);
      expect(comp.statusError).toBe('');
      const refineInput = (gqlCalls[1].variables as { input: { Params: Array<{ Name: string; Value: string }> } }).input;
      const sourceImageParam = refineInput.Params.find((p) => p.Name === 'SourceImage');
      expect(sourceImageParam?.Value).toBe('GENERATED_PNG_B64');
    } finally {
      vi.stubGlobal('Image', OriginalImage);
    }
  });
});

describe('CollabNewSpaceDialogComponent full-dialog Avatar Studio overlay', () => {
  const types: NewSpaceTypeOption[] = [
    { id: 't-board', name: 'Board', description: 'A governing body', iconClass: 'fa-solid fa-landmark', color: '#0076b6' },
  ];

  it('opens the full-dialog Space Avatar Studio overlay from the 64x64 avatar trigger and returns via Done or Back', async () => {
    const fixture = TestBed.createComponent(CollabNewSpaceDialogComponent);
    fixture.componentRef.setInput('Types', types);
    fixture.componentRef.setInput('SelectedTypeId', 't-board');
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('mjc-space-avatar-studio')).toBeNull();
    expect(host.querySelector('mj-dialog-actions')?.textContent).toContain('Create space');

    // Click the 64x64 clickable avatar trigger next to Name
    const trigger = host.querySelector<HTMLButtonElement>('.avatar-trigger-btn');
    expect(trigger).not.toBeNull();
    trigger!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Full-dialog studio overlay replaces form view & dialog footer swaps to Done
    expect(fixture.componentInstance.showAvatarStudio).toBe(true);
    expect(fixture.componentInstance.dialogTitle).toBe('Customize Space Avatar');
    expect(host.querySelector('mjc-space-avatar-studio')).not.toBeNull();
    expect(host.querySelector<HTMLElement>('.space-form-view')?.hidden).toBe(true);
    const actionsText = host.querySelector('mj-dialog-actions')?.textContent ?? '';
    expect(actionsText).toContain('Done');
    expect(actionsText).not.toContain('Create space');

    // Clicking Done returns to the space form
    const doneBtn = Array.from(host.querySelectorAll<HTMLButtonElement>('mj-dialog-actions button')).find((b) =>
      b.textContent?.includes('Done'),
    );
    expect(doneBtn).toBeDefined();
    doneBtn!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.showAvatarStudio).toBe(false);
    expect(host.querySelector('mjc-space-avatar-studio')).toBeNull();
    expect(host.querySelector<HTMLElement>('.space-form-view')?.hidden).toBe(false);
    expect(host.querySelector('mj-dialog-actions')?.textContent).toContain('Create space');

    // Re-open via Customize avatar / logo link, then close via Back to space details
    const customizeLink = host.querySelector<HTMLButtonElement>('.avatar-customize-link');
    expect(customizeLink).not.toBeNull();
    customizeLink!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const backBtn = host.querySelector<HTMLButtonElement>('.studio-back-btn');
    expect(backBtn?.textContent).toContain('Back to space details');
    backBtn!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.showAvatarStudio).toBe(false);
    expect(host.querySelector('mjc-space-avatar-studio')).toBeNull();
  });
});

describe('CollabSpaceSettingsComponent Avatar Studio dialog overlay', () => {
  const sampleSettings: SpaceSettingsModel = {
    id: 's1',
    name: 'Northwind',
    description: 'Executive workspace',
    spaceType: 'Workspace',
    spaceTypeId: 't1',
    iconClass: 'fa-solid fa-briefcase',
    color: '#0076b6', // hex-ok: test fixture color
    backgroundImageUrl: '',
    inheritsMembership: true,
    agentRetrieval: 'Included',
    status: 'Active',
  };

  it('opens Space Avatar Studio inside a full mj-dialog overlay and closes via Done', async () => {
    const fixture = TestBed.createComponent(CollabSpaceSettingsComponent);
    fixture.componentRef.setInput('Settings', sampleSettings);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('mj-dialog')).toBeNull();

    const openBtn = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Customize Icon / Logo'),
    );
    expect(openBtn).toBeDefined();
    openBtn!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.showAvatarStudio).toBe(true);
    expect(host.querySelector('mj-dialog mjc-space-avatar-studio')).not.toBeNull();

    const doneBtn = Array.from(host.querySelectorAll<HTMLButtonElement>('mj-dialog-actions button')).find((b) =>
      b.textContent?.includes('Done'),
    );
    expect(doneBtn).toBeDefined();
    doneBtn!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.showAvatarStudio).toBe(false);
    expect(host.querySelector('mj-dialog')).toBeNull();
  });
});

describe('CollabTypeTileComponent ImageUrl fallback', () => {
  it('renders image when ImageUrl is set and falls back to icon on error', () => {
    const tile = new CollabTypeTileComponent();
    expect(tile.showImage).toBe(false);

    tile.ImageUrl = 'https://example.com/logo.webp';
    expect(tile.showImage).toBe(true);

    tile.onImageError();
    expect(tile.showImage).toBe(false);
  });
});

describe('CollabSpaceLibraryComponent streamlined layout & Docs Studio dedup', () => {
  it('collapses folder rail when <= 1 collection exists and filters artifacts when custom docs tab is present', () => {
    const lib = new CollabSpaceLibraryComponent();
    lib.Collections = [{ id: 'folder-0', name: 'General', band: 'Shared', count: 2 }];
    expect(lib.ShowFolderRail).toBe(false);

    lib.Collections = [
      { id: 'folder-0', name: 'General', band: 'Shared', count: 1 },
      { id: 'folder-1', name: 'Contracts', band: 'Team', count: 1 },
    ];
    expect(lib.ShowFolderRail).toBe(true);

    lib.Rows = [
      { id: '1', fileId: 'f1', entityName: 'MJ: Files', kind: 'pdf', name: 'Brief.pdf', folder: 'General', band: 'Shared', who: 'Ada', when: 'Today' },
      { id: '2', artifactId: 'a1', entityName: 'MJ: Artifacts', kind: 'doc', name: 'Executive Roadmap', folder: 'General', band: 'Shared', who: 'Ada', when: 'Today' },
    ];
    lib.HasCustomDocsTab = true;
    lib.ExcludeArtifactsWhenCustomDocsTab = true;
    expect(lib.ShowArtifactToggle).toBe(true);
    expect(lib.FilteredRows.map((r) => r.id)).toEqual(['1']);

    lib.setShowWorkspaceDocs(true);
    expect(lib.FilteredRows.map((r) => r.id)).toEqual(['1', '2']);
  });
});
