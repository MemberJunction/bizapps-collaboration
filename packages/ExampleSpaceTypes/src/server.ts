/**
 * Example Space Types Package - Server Entrypoint
 * Extensibility plan § 5, § 10.2, § 10.3.
 */

export * from './board/ExampleBoardServerDriver.js';
export * from './room/ExampleRoomServerDriver.js';
export * from './room/ExampleDealRoomLifecycleSubscriber.js';
export * from './room/ExampleDealRoomSignalProvider.js';

// The subtype entities: importing them registers their classes, so a save through the space writes the subtype's own row too
export * from './generated/entities/entity_subclasses.js';
