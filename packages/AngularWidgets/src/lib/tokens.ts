/**
 * Shared collaboration tokens CSS definition.
 * Bound to :host across widgets so all tokens resolve in host applications (like Explorer)
 * without requiring external stylesheet imports.
 */
export const COLLAB_TOKENS_CSS = `
    :host {
        --mjc-shared: var(--mj-brand-tertiary-active);
        --mjc-shared-strong: var(--mj-brand-tertiary-hover);
        --mjc-shared-bg: var(--mj-brand-tertiary-subtle);
        --mjc-shared-border: color-mix(in srgb, var(--mj-brand-tertiary) 35%, transparent);
        --mjc-team: var(--mj-text-secondary);
        --mjc-team-strong: var(--mj-text-secondary);
        --mjc-team-bg: color-mix(in srgb, var(--mj-text-muted) 12%, transparent);
        --mjc-team-border: var(--mj-border-strong);
        --mjc-on-strong: var(--mj-text-inverse);
        --mjc-ai-from: var(--mj-brand-primary);
        --mjc-ai-to: var(--mj-brand-accent);
        --mjc-warn-bg: var(--mj-status-warning-bg);
        --mjc-warn-text: var(--mj-status-warning-text);
        --mjc-font-feature-settings: 'cv11', 'ss01';
        --mjc-line-height: 1.45;
    }
`;
