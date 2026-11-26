import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import {
  buildSpaceAvatarPrompt,
  extractGeneratedImageSource,
  SPACE_AVATAR_STYLE_PRESETS,
} from './space-avatar-studio.component';
import { CollabTypeTileComponent } from './type-tile.component';
import { CollabSpaceLibraryComponent } from './space-library.component';

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

  it('extracts base64 data URI and URL outputs from Generate Image ResultData', () => {
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
