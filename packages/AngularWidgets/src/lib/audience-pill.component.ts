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
      @if (StaffAvatars && StaffAvatars.length > 0) {
        <mjc-avatar-stack [Avatars]="StaffAvatars" [Max]="MaxStaff" Size="sm"></mjc-avatar-stack>
      }
      @if (StaffAvatars && StaffAvatars.length > 0 && OutsideAvatars && OutsideAvatars.length > 0) {
        <span class="aud-div"></span>
      }
      @if (OutsideAvatars && OutsideAvatars.length > 0) {
        <mjc-avatar-stack [Avatars]="OutsideAvatars" [Max]="MaxOutside" Size="sm"></mjc-avatar-stack>
      }
      <div class="aud-t">
        <b>{{ TotalPeople }} {{ TotalPeople === 1 ? 'person' : 'people' }}</b>
        @if (Summary) {
          <span>{{ Summary }}</span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
      line-height: var(--mjc-line-height, 1.45);
    }
    .aud {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-right: 4px;
      padding: 4px 12px 4px 6px;
      border: 1px solid var(--mj-border-default);
      border-radius: 99px;
      background: var(--mj-bg-surface);
      height: 38px;
      box-sizing: border-box;
      user-select: none;
    }
    .aud-div {
      width: 1px;
      height: 18px;
      background: var(--mj-border-default);
    }
    .aud-t {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }
    .aud-t b {
      font-size: 12.5px;
      font-weight: 650;
      color: var(--mj-text-primary);
    }
    .aud-t span {
      font-size: 11px;
      color: var(--mj-text-muted);
      white-space: nowrap;
    }
  `]
})
export class CollabAudiencePillComponent {
  @Input() StaffAvatars: AvatarItem[] = [];
  @Input() OutsideAvatars: AvatarItem[] = [];
  @Input() TotalPeople = 0;
  @Input() Summary = '';
  @Input() MaxStaff = 4;
  @Input() MaxOutside = 4;
}
