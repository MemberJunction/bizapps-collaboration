import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-ask-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="card ask">
      <div class="row gap10">
        <span class="ai-av md">
          <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/>
            <path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/>
          </svg>
        </span>
        <div>
          <div class="fw7 fs14">{{ Title }}</div>
          <div class="fs12 muted">{{ Subtitle }}</div>
        </div>
      </div>
      <div class="ask-in">
        <input
          type="text"
          [placeholder]="Placeholder"
          [(ngModel)]="Query"
          (keydown.enter)="onSend()"
        />
        <button type="button" class="send" (click)="onSend()" aria-label="Send query">
          <i class="fa-solid fa-arrow-up"></i>
        </button>
      </div>
      <div class="ask-scope">
        <i class="fa-solid fa-lock"></i>
        <span>Only you will see this. It can use <b>Team and Shared</b> material.</span>
      </div>
      @if (Suggestions && Suggestions.length > 0) {
        <div class="sugs">
          @for (sug of Suggestions; track sug) {
            <span class="sug" (click)="onSelectSuggestion(sug)">{{ sug }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: block;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-size: 14px;
      line-height: var(--mjc-line-height);
    }

    .card.ask {
      padding: 16px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--mj-brand-primary) 6%, var(--mj-bg-surface)), var(--mj-bg-surface) 70%);
      border-radius: 12px;
      border: 1px solid var(--mj-border-default);
    }

    .row {
      display: flex;
      align-items: center;
    }

    .gap10 {
      gap: 10px;
    }

    .ai-av.md {
      width: 32px;
      height: 32px;
      font-size: 14px;
      border-radius: 9px;
      display: inline-grid;
      place-items: center;
      background: linear-gradient(135deg, var(--mjc-ai-from), var(--mjc-ai-to));
      color: var(--mj-text-inverse);
      flex: none;
    }

    .ask-in {
      position: relative;
      margin-top: 14px;
      height: 42px;
      border-radius: 11px;
      border: 1px solid color-mix(in srgb, var(--mj-brand-primary) 35%, var(--mj-border-default));
      background: var(--mj-bg-surface);
      display: flex;
      align-items: center;
      padding: 0 44px 0 12px;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--mj-brand-primary) 7%, transparent);

      input {
        border: 0;
        outline: none;
        background: transparent;
        width: 100%;
        font-size: 13.5px;
        color: var(--mj-text-primary);
        font-family: inherit;

        &::placeholder {
          color: var(--mj-text-muted);
        }
      }

      .send {
        position: absolute;
        right: 6px;
        top: 6px;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: var(--mj-brand-primary);
        color: var(--mj-brand-on-primary);
        display: grid;
        place-items: center;
        font-size: 12px;
        border: 0;
        cursor: pointer;
      }
    }

    .ask-scope {
      margin-top: 10px;
      font-size: 12px;
      color: var(--mj-text-secondary);
      display: flex;
      align-items: center;
      gap: 7px;

      i {
        color: var(--mj-text-muted);
      }

      b {
        font-weight: 650;
        color: var(--mj-text-primary);
      }
    }

    .sugs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }

    .sug {
      font-size: 12px;
      color: var(--mj-text-secondary);
      padding: 5px 10px;
      border-radius: 99px;
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      cursor: pointer;

      &:hover {
        background: var(--mj-bg-surface-hover);
        color: var(--mj-text-primary);
      }
    }

    .fw7 { font-weight: 700; }
    .fs12 { font-size: 12px; }
    .fs14 { font-size: 14px; }
    .muted { color: var(--mj-text-muted); }
  `],
})
export class CollabAskBoxComponent {
  @Input() public Title = '';
  @Input() public Subtitle = 'One assistant, bounded by who’s asking';
  @Input() public Placeholder = 'Ask anything about this space…';
  @Input() public Suggestions: string[] = [];

  @Input() public Query = '';
  @Output() public AskRequested = new EventEmitter<string>();

  public onSend(): void {
    if (this.Query.trim()) {
      this.AskRequested.emit(this.Query.trim());
      this.Query = '';
    }
  }

  public onSelectSuggestion(sug: string): void {
    this.Query = sug;
    this.onSend();
  }
}
