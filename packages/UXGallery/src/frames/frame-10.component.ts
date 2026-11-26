import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CollabAudiencePillComponent,
  CollabBandChipComponent,
  CollabSpaceHeaderComponent,
  CollabSpaceNotesComponent,
  CollabSpaceRailComponent,
  CollabSpaceTabsComponent,
  COLLAB_TOKENS_CSS,
  formatNotePreviewText,
  type NoteModel,
  type PromotedNoteDocLink,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { noteToArtifactDocument } from '@mj-biz-apps/collaboration-core';
import { FRAME_10_FIXTURE, type Frame10DocumentSummary } from '../fixtures/frame-10.fixture';

@Component({
  selector: 'gallery-frame-10',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CollabSpaceRailComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceTabsComponent,
    CollabSpaceNotesComponent,
    CollabAudiencePillComponent,
    CollabBandChipComponent,
    MJButtonDirective,
  ],
  template: `
    <div class="shell">
      <header class="topbar">
        <span class="mark" aria-hidden="true"></span>
        <span class="app-pill">
          <i class="fa-solid fa-people-roof" aria-hidden="true"></i>
          {{ f.topbar.appName }}
          <i class="fa-solid fa-chevron-down caret" aria-hidden="true"></i>
        </span>
        <span class="spacer"></span>
        <span class="search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          Search everything…
          <span class="kbd">⌘K</span>
        </span>
        <button type="button" class="icon-btn" aria-label="Notifications">
          <i class="fa-regular fa-bell" aria-hidden="true"></i>
          <span class="dot" aria-hidden="true"></span>
        </button>
        <span class="av" title="Ada Lovell" aria-label="Ada Lovell">{{ f.topbar.userInitials }}</span>
      </header>

      <div class="body">
        <mjc-space-rail
          [Spaces]="f.rail.spaces"
          [ActiveSpaceId]="'discovery'"
          [InboxCount]="f.rail.inboxCount"
          [MyTaskCount]="f.rail.taskCount"
        ></mjc-space-rail>

        <main class="main">
          <mjc-space-header
            [Breadcrumbs]="f.header.crumbs"
            [TypeColor]="f.header.typeColor"
            [TypeIconClass]="f.header.typeIconClass"
            [Title]="f.header.title"
            [TypeName]="f.header.typeName"
            [Status]="f.header.status"
            [Subtitle]="f.header.subtitle"
          >
            <div actions class="row gap8">
              <mjc-audience-pill
                [StaffAvatars]="f.header.staffAvatars"
                [OutsideAvatars]="f.header.outsideAvatars"
                [TotalPeople]="f.header.totalPeople"
                [Summary]="f.header.audienceSummary"
              ></mjc-audience-pill>
              <button
                mjButton
                type="button"
                Variant="primary"
                Size="md"
                data-testid="frame-10-open-latest-doc"
                (click)="openDocument(documents[0])">
                <i class="fa-solid fa-file-lines" aria-hidden="true"></i>Open latest document
              </button>
            </div>
            <mjc-space-tabs
              [Tabs]="f.header.tabs"
              [ActiveTab]="'Notes'"
            ></mjc-space-tabs>
          </mjc-space-header>

          <div class="workspace-scroll">
            <section class="editorial-banner" aria-label="Workspace document guidance">
              <div class="editorial-icon" aria-hidden="true">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <div class="editorial-copy">
                <h2 class="editorial-title">Promote quick notes into versioned Markdown Documents</h2>
                <p class="editorial-sub">
                  Turning a note into a document creates a native editable MJ Artifact with inherited Space band visibility and permission delegation.
                </p>
              </div>
              <span class="editorial-stat" data-testid="frame-10-doc-count">
                <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                {{ documents.length }} documents
              </span>
            </section>

            <div class="workspace-grid">
              <section class="notes-column" aria-label="Space notes">
                <mjc-space-notes
                  [Title]="'Space Notes'"
                  [Subtitle]="'Lightweight scratch notes ready to promote into editable documents.'"
                  [Notes]="notes"
                  [CanWrite]="true"
                  [CanSeeTeam]="true"
                  [IsReadOnly]="false"
                  [DefaultBand]="'Team'"
                  [SharedLabel]="'Northwind & Meridian'"
                  [TeamLabel]="'Meridian team'"
                  [TurningIntoDocumentNoteId]="turningNoteId"
                  [PromotedDocsByNoteId]="promotedDocsByNoteId"
                  (TurnIntoDocumentRequested)="onTurnIntoDocument($event)"
                  (OpenDocumentRequested)="onOpenPromotedDoc($event)"
                ></mjc-space-notes>
              </section>

              <section class="docs-rail" aria-label="Space Markdown Documents">
                <div class="docs-rail-head">
                  <h2 class="docs-rail-title">Native Markdown Documents</h2>
                  <span class="docs-rail-meta">MJ: Artifacts · v1+</span>
                </div>
                <div class="docs-list">
                  @for (doc of documents; track doc.artifactId) {
                    <article
                      class="doc-card"
                      [class.active]="activeDocument?.artifactId === doc.artifactId"
                      data-testid="frame-10-doc-card"
                      (click)="openDocument(doc)">
                      <div class="doc-card-head">
                        <i class="fa-solid fa-file-lines doc-icon" aria-hidden="true"></i>
                        <div class="doc-card-titles">
                          <div class="doc-card-name">{{ doc.title }}</div>
                          <div class="doc-card-sub">{{ doc.folder }} · v{{ doc.versionNumber }} · {{ doc.updatedLabel }}</div>
                        </div>
                        <mjc-band-chip [Band]="doc.band" [Label]="doc.band === 'Team' ? 'Meridian team' : 'Shared'"></mjc-band-chip>
                      </div>
                      <p class="doc-card-excerpt">{{ doc.excerpt }}</p>
                      <div class="doc-card-delegate">
                        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
                        <span>{{ doc.delegateLabel }}</span>
                      </div>
                    </article>
                  }
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      @if (activeDocument; as doc) {
        <div
          class="drawer-backdrop"
          data-testid="frame-10-doc-drawer-backdrop"
          (click)="activeDocument = null">
          <section
            class="drawer-sheet"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="'Markdown Document: ' + doc.title"
            data-testid="frame-10-doc-drawer"
            (click)="$event.stopPropagation()">
            <header class="drawer-head">
              <div class="drawer-title-group">
                <span class="drawer-kicker">
                  <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
                  MJ: Artifacts · Markdown Document · v{{ doc.versionNumber }}
                </span>
                <h2 class="drawer-title" data-testid="frame-10-doc-drawer-title">{{ doc.title }}</h2>
              </div>
              <div class="drawer-actions">
                <mjc-band-chip [Band]="doc.band" [Label]="doc.band === 'Team' ? 'Meridian team' : 'Shared'"></mjc-band-chip>
                <button
                  type="button"
                  class="drawer-close"
                  aria-label="Close document drawer"
                  data-testid="frame-10-doc-drawer-close"
                  (click)="activeDocument = null">
                  <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </div>
            </header>
            <div class="drawer-body">
              <div class="drawer-meta-strip">
                <span><i class="fa-solid fa-folder" aria-hidden="true"></i> {{ doc.folder }}</span>
                <span><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> {{ doc.delegateLabel }}</span>
                <span><i class="fa-solid fa-route" aria-hidden="true"></i> Routed via NavigationService</span>
              </div>
              <div class="drawer-editor-surface">
                <p class="drawer-content-preview">{{ doc.excerpt }}</p>
              </div>
            </div>
          </section>
        </div>
      }
    </div>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
        width: 100%;
        min-height: 100vh;
        position: relative;
      }
      .shell {
        display: grid;
        grid-template-rows: 56px 1fr;
        width: 100%;
        min-height: 100vh;
        background: var(--mj-bg-page);
        color: var(--mj-text-primary);
      }
      .body {
        display: grid;
        grid-template-columns: 252px minmax(0, 1fr);
        min-height: 0;
      }
      .main {
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: var(--mj-bg-page);
      }
      .workspace-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 16px 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .editorial-banner {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-radius: var(--mj-radius-lg);
        background: var(--mj-bg-surface-card);
        border: 1px solid var(--mj-border-default);
        flex-wrap: wrap;
      }
      .editorial-icon {
        width: 38px;
        height: 38px;
        border-radius: var(--mj-radius-md);
        display: inline-grid;
        place-items: center;
        background: color-mix(in srgb, var(--mj-brand-primary) 12%, transparent);
        color: var(--mj-brand-primary);
        flex-shrink: 0;
      }
      .editorial-copy {
        flex: 1;
        min-width: 220px;
      }
      .editorial-title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: var(--mj-text-primary);
      }
      .editorial-sub {
        margin: 3px 0 0;
        font-size: 12.5px;
        color: var(--mj-text-secondary);
      }
      .editorial-stat {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--mj-bg-surface-sunken);
        border: 1px solid var(--mj-border-default);
        color: var(--mj-text-secondary);
        font-size: 12px;
        font-weight: 600;
      }
      .workspace-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.9fr);
        gap: 16px;
        align-items: start;
      }
      .notes-column {
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-lg);
        min-width: 0;
      }
      .docs-rail {
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-lg);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
      }
      .docs-rail-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .docs-rail-title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: var(--mj-text-primary);
      }
      .docs-rail-meta {
        font-size: 11.5px;
        color: var(--mj-text-muted);
      }
      .docs-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .doc-card {
        background: var(--mj-bg-surface-card);
        border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-md);
        padding: 12px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .doc-card.active {
        border-color: var(--mj-brand-primary);
      }
      .doc-card-head {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .doc-icon {
        color: var(--mj-brand-primary);
        margin-top: 2px;
      }
      .doc-card-titles {
        flex: 1;
        min-width: 0;
      }
      .doc-card-name {
        font-size: 13.5px;
        font-weight: 700;
        color: var(--mj-text-primary);
        overflow-wrap: anywhere;
      }
      .doc-card-sub {
        font-size: 11.5px;
        color: var(--mj-text-muted);
        margin-top: 2px;
      }
      .doc-card-excerpt {
        margin: 0;
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--mj-text-secondary);
      }
      .doc-card-delegate {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        color: var(--mj-text-muted);
      }
      .drawer-backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--mj-z-drawer, 1000);
        background: var(--mj-bg-overlay, color-mix(in srgb, var(--mj-text-primary) 45%, transparent));
        display: flex;
        justify-content: flex-end;
      }
      .drawer-sheet {
        width: min(640px, 92vw);
        height: 100%;
        background: var(--mj-bg-surface);
        color: var(--mj-text-primary);
        border-left: 1px solid var(--mj-border-default);
        box-shadow: var(--mj-shadow-2xl);
        display: flex;
        flex-direction: column;
      }
      .drawer-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px;
        border-bottom: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface-card);
      }
      .drawer-title-group {
        min-width: 0;
      }
      .drawer-kicker {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--mj-brand-primary);
      }
      .drawer-title {
        margin: 4px 0 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--mj-text-primary);
      }
      .drawer-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .drawer-close {
        width: 30px;
        height: 30px;
        border-radius: var(--mj-radius-md);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        cursor: pointer;
        display: inline-grid;
        place-items: center;
      }
      .drawer-body {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        overflow-y: auto;
      }
      .drawer-meta-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 12px;
        color: var(--mj-text-secondary);
      }
      .drawer-editor-surface {
        background: var(--mj-bg-surface-card);
        border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-md);
        padding: 16px;
      }
      .drawer-content-preview {
        margin: 0;
        font-size: 13.5px;
        line-height: 1.6;
        color: var(--mj-text-primary);
        white-space: pre-wrap;
      }
      .row { display: flex; align-items: center; flex-wrap: wrap; }
      .gap8 { gap: 8px; }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0 16px 0 14px;
        background: var(--mj-bg-surface);
        border-bottom: 1px solid var(--mj-border-default);
        height: 56px;
        box-sizing: border-box;
      }
      .topbar .mark {
        width: 34px;
        height: 19px;
        flex-shrink: 0;
        background: url('/assets/mj-mark.svg') center/contain no-repeat;
      }
      :host-context([data-theme="dark"]) .topbar .mark,
      [data-theme="dark"] .topbar .mark {
        background-image: url('/assets/mj-mark-dark.svg');
      }
      .app-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 32px;
        padding: 0 12px 0 10px;
        border-radius: var(--mj-radius-md);
        background: color-mix(in srgb, var(--mj-brand-primary) 10%, transparent);
        color: var(--mj-brand-primary);
        font-weight: 600;
        font-size: 13.5px;
        white-space: nowrap;
      }
      .app-pill .caret { font-size: 10px; opacity: 0.7; margin-left: 2px; }
      .topbar .spacer { flex: 1; min-width: 0; }
      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 300px;
        max-width: 100%;
        height: 34px;
        padding: 0 10px;
        border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-md);
        color: var(--mj-text-muted);
        background: var(--mj-bg-surface);
        font-size: 13px;
      }
      .kbd {
        margin-left: auto;
        font-size: 11px;
        font-weight: 500;
        color: var(--mj-text-muted);
        border: 1px solid var(--mj-border-default);
        border-radius: 5px;
        padding: 1px 6px;
        background: var(--mj-bg-surface-card);
      }
      .icon-btn {
        position: relative;
        width: 34px;
        height: 34px;
        border: 0;
        background: transparent;
        cursor: pointer;
        border-radius: var(--mj-radius-md);
        display: inline-grid;
        place-items: center;
        color: var(--mj-text-secondary);
        font-size: 15px;
        flex-shrink: 0;
      }
      .icon-btn .dot {
        position: absolute;
        top: 6px;
        right: 7px;
        min-width: 8px;
        height: 8px;
        border-radius: 99px;
        background: var(--mj-status-error);
        box-shadow: 0 0 0 2px var(--mj-bg-surface);
      }
      .topbar .av {
        display: inline-grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 99px;
        font-size: 12px;
        font-weight: 650;
        color: var(--mj-brand-on-primary);
        background: var(--mj-brand-primary);
        user-select: none;
        flex-shrink: 0;
      }
      @media (max-width: 1024px) {
        .body { grid-template-columns: minmax(0, 1fr); }
        mjc-space-rail { display: none; }
        .workspace-grid { grid-template-columns: minmax(0, 1fr); }
        .search { width: 200px; }
      }
      @media (max-width: 640px) {
        .topbar { gap: 8px; padding: 0 12px; }
        .search { display: none; }
        .workspace-scroll { padding: 12px; }
      }
    `,
  ],
})
export class Frame10Component {
  public readonly f = FRAME_10_FIXTURE;
  public readonly notes: NoteModel[] = [...FRAME_10_FIXTURE.notes];
  public documents: Frame10DocumentSummary[] = [...FRAME_10_FIXTURE.initialDocuments];
  public turningNoteId: string | null = null;
  public promotedDocsByNoteId: Readonly<Record<string, PromotedNoteDocLink>> = {};
  public activeDocument: Frame10DocumentSummary | null = null;

  public onTurnIntoDocument(note: NoteModel): void {
    const spec = noteToArtifactDocument({
      ID: note.id,
      SpaceID: 'discovery',
      Title: note.title,
      Body: note.body,
      Band: note.band,
      Visibility: note.visibility,
      AuthorUserID: note.authorUserId,
    });
    const artifactId = `art-promoted-${note.id}`;
    const spaceItemId = `item-promoted-${note.id}`;
    const created: Frame10DocumentSummary = {
      spaceItemId,
      artifactId,
      title: spec.title,
      band: spec.band,
      folder: spec.folder ?? 'Notes',
      versionNumber: 1,
      delegateLabel: `Delegated via Space Item (${spec.band})`,
      excerpt: formatNotePreviewText(note.body) || 'Editable Markdown Document created from Space Note.',
      updatedLabel: 'Just now',
    };
    this.documents = [
      created,
      ...this.documents.filter((d) => d.artifactId !== created.artifactId),
    ];
    this.promotedDocsByNoteId = {
      ...this.promotedDocsByNoteId,
      [note.id]: {
        artifactId: created.artifactId,
        spaceItemId: created.spaceItemId,
        title: created.title,
        versionNumber: created.versionNumber,
      },
    };
    this.activeDocument = created;
  }

  public onOpenPromotedDoc(link: PromotedNoteDocLink): void {
    const match = this.documents.find((d) => d.artifactId === link.artifactId);
    if (match) {
      this.activeDocument = match;
    }
  }

  public openDocument(doc: Frame10DocumentSummary | undefined): void {
    if (doc) {
      this.activeDocument = doc;
    }
  }
}
