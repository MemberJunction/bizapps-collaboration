import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabAvatarStackComponent } from './avatar-stack.component';
import { AvatarItem } from './types';

@Component({
  selector: 'mjc-audience-pill',
  standalone: true,
  imports: [CommonModule, CollabAvatarStackComponent],
  template: `
    <div class="aud">
      @if (staffAvatars && staffAvatars.length > 0) {
        <mjc-avatar-stack [avatars]="staffAvatars" [max]="maxStaff" size="sm"></mjc-avatar-stack>
      }
      @if (staffAvatars && staffAvatars.length > 0 && outsideAvatars && outsideAvatars.length > 0) {
        <span class="aud-div"></span>
      }
      @if (outsideAvatars && outsideAvatars.length > 0) {
        <mjc-avatar-stack [avatars]="outsideAvatars" [max]="maxOutside" size="sm"></mjc-avatar-stack>
      }
      <div class="aud-t">
        <b>{{ totalPeople }} {{ totalPeople === 1 ? 'person' : 'people' }}</b>
        @if (summary) {
          <span>{{ summary }}</span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
    .aud {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 12px 4px 6px;
      border: 1px solid var(--mj-border-default, #e2e8f0);
      border-radius: 99px;
      background: var(--mj-bg-surface, #ffffff);
      height: 38px;
      margin-right: 4px;
      box-sizing: border-box;
      user-select: none;
    }
    .aud-div {
      width: 1px;
      height: 18px;
      background: var(--mj-border-default, #e2e8f0);
    }
    .aud-t {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }
    .aud-t b {
      font-size: 12.5px;
      font-weight: 650;
      color: var(--mj-text-primary, #1e293b);
    }
    .aud-t span {
      font-size: 11px;
      color: var(--mj-text-muted, #64748b);
      white-space: nowrap;
    }
  `]
})
export class CollabAudiencePillComponent {
  @Input() staffAvatars: AvatarItem[] = [];
  @Input() outsideAvatars: AvatarItem[] = [];
  @Input() totalPeople = 0;
  @Input() summary = '';
  @Input() maxStaff = 4;
  @Input() maxOutside = 4;
}
