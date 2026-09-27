/**
 * Shared collaboration tokens CSS definition.
 * Bound to :host across widgets so all tokens resolve in host applications (like Explorer)
 * without requiring external stylesheet imports.
 */
export const COLLAB_TOKENS_CSS = `
    :host {
        --mjc-shared: var(--mj-brand-tertiary-active, #0076b6);
        --mjc-shared-strong: var(--mj-brand-tertiary-hover, #005a8c);
        --mjc-shared-bg: var(--mj-brand-tertiary-subtle, rgba(0, 118, 182, 0.08));
        --mjc-shared-border: color-mix(in srgb, var(--mj-brand-tertiary, #0076b6) 35%, transparent);
        --mjc-team: var(--mj-text-secondary, #64748b);
        --mjc-team-strong: var(--mj-text-secondary, #64748b);
        --mjc-team-bg: color-mix(in srgb, var(--mj-text-muted, #94a3b8) 12%, transparent);
        --mjc-team-border: var(--mj-border-strong, #cbd5e1);
        --mjc-on-strong: var(--mj-text-inverse, #ffffff);
        --mjc-ai-from: var(--mj-brand-primary, #0076b6);
        --mjc-ai-to: var(--mj-brand-accent, #6366f1);
        --mjc-warn-bg: var(--mj-status-warning-bg, #fffbeb);
        --mjc-warn-text: var(--mj-status-warning-text, #b45309);
        --mjc-font-feature-settings: 'cv11', 'ss01';
        --mjc-line-height: 1.45;
    }
`;
