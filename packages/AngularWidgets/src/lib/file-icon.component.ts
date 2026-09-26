import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { FileKind } from './types';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-file-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="fi" [class]="kindClass">
      <i [class]="iconClass"></i>
    </span>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: inline-flex;
      vertical-align: middle;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      line-height: var(--mjc-line-height);
    }

    .fi {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: 30px;
      height: 34px;
      border-radius: 6px;
      font-size: 14px;
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-secondary);
      position: relative;

      &.pdf { color: #dc2626; background: color-mix(in srgb, #dc2626 9%, var(--mj-bg-surface)); }
      &.doc { color: #2563eb; background: color-mix(in srgb, #2563eb 9%, var(--mj-bg-surface)); }
      &.xls { color: #16a34a; background: color-mix(in srgb, #16a34a 9%, var(--mj-bg-surface)); }
      &.ppt { color: #ea580c; background: color-mix(in srgb, #ea580c 9%, var(--mj-bg-surface)); }
      &.img { color: #9333ea; background: color-mix(in srgb, #9333ea 9%, var(--mj-bg-surface)); }
      &.txt { color: var(--mj-text-secondary); }
      &.sm { width: 24px; height: 28px; font-size: 12px; border-radius: 5px; }
    }
  `],
})
export class CollabFileIconComponent {
  @Input() public Kind: FileKind = 'doc';
  @Input() public Size: 'sm' | 'md' = 'sm';

  public get kindClass(): string {
    const k = (this.Kind || 'doc').toLowerCase();
    return `${k} ${this.Size}`;
  }

  public get iconClass(): string {
    const k = (this.Kind || 'doc').toLowerCase();
    switch (k) {
      case 'pdf': return 'fa-solid fa-file-pdf';
      case 'doc':
      case 'docx':
      case 'word': return 'fa-solid fa-file-word';
      case 'xls':
      case 'xlsx':
      case 'excel': return 'fa-solid fa-file-excel';
      case 'ppt':
      case 'pptx':
      case 'powerpoint': return 'fa-solid fa-file-powerpoint';
      case 'img':
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'image': return 'fa-solid fa-images';
      case 'txt': return 'fa-solid fa-file-lines';
      case 'zip': return 'fa-solid fa-folder';
      default: return 'fa-solid fa-file';
    }
  }
}
