import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJEmptyStateComponent } from '@memberjunction/ng-ui-components';
import { lockoutMessage } from '@mj-biz-apps/collaboration-core';

/**
 * Branded no-access empty state component shown when a signed-in user opens a space
 * where they hold no active seat. Built using MemberJunction's canonical <mj-empty-state>.
 */
@Component({
  selector: 'mjc-no-access',
  standalone: true,
  imports: [CommonModule, MJEmptyStateComponent],
  template: `
    <div class="no-access-container">
      <mj-empty-state
        [Icon]="'fa-solid fa-lock'"
        [Title]="'Access Restricted'"
        [Message]="message"
      >
      </mj-empty-state>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      width: 100%;
      height: 100%;
      background: var(--mj-bg-surface, #ffffff);
    }
    .no-access-container {
      max-width: 480px;
      padding: var(--mj-space-6, 24px);
    }
  `]
})
export class CollaborationNoAccessComponent {
  @Input('seats')
  set seats(val: readonly { spaceName: string; status: string }[]) {
    this.Seats = val;
  }
  get seats(): readonly { spaceName: string; status: string }[] {
    return this.Seats;
  }
  @Input() Seats: readonly { spaceName: string; status: string }[] = [];

  @Input('customMessage')
  set customMessage(val: string | undefined) {
    this.CustomMessage = val;
  }
  get customMessage(): string | undefined {
    return this.CustomMessage;
  }
  @Input() CustomMessage?: string;

  get message(): string {
    if (this.CustomMessage) {
      return this.CustomMessage;
    }
    return lockoutMessage(this.Seats);
  }
}

