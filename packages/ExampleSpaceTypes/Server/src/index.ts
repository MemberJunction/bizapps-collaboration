/**
 * Example Space Types - Server Package
 * Extensibility plan § 5, § 10.3.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// The subtype entity: importing it registers its class, so a save through the space writes the subtype's own row too
import '@mj-biz-apps/collaboration-example-space-types-entities';

const here = fileURLToPath(new URL('.', import.meta.url));

/**
 * The generated GraphQL resolvers of the subtype entity, for MJAPI's dynamic package loader (it reads this export off every
 * server package it loads). A host that shows the example types lists this package in its `dynamicPackages.server`; without the
 * resolvers the page can read a board's columns but not save them. Not for shipping: only a test host loads the examples.
 */
export const RESOLVER_PATHS: string[] = [resolve(here, 'generated/generated.{js,ts}')];

export * from './board/ExampleBoardServerDriver.js';
export * from './chapter/ExampleChapterRenewalReminderAction.js';
