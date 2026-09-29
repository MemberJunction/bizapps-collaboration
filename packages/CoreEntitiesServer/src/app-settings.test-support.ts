import { CollaborationEngineBase } from '@mj-biz-apps/collaboration-engine-base';
import { DEFAULT_COLLABORATION_SETTINGS, type CollaborationSettings } from '@mj-biz-apps/collaboration-core';

/**
 * Settings resolution refuses when the app's settings row is missing (it no longer falls back to defaults), so a
 * test that resolves settings gives the engine a settings row to read. Returns a function that puts the engine back.
 */
export function seedAppSettings(settings: CollaborationSettings = DEFAULT_COLLABORATION_SETTINGS): () => void {
    const engine = CollaborationEngineBase.Instance;
    Object.defineProperty(engine, 'CollaborationSettings', { get: () => settings, configurable: true });
    return () => {
        delete (engine as { CollaborationSettings?: CollaborationSettings }).CollaborationSettings;
    };
}
