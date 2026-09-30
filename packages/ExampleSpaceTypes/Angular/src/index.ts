/**
 * Example Space Types - Client Package
 * Extensibility plan § 6, § 10.2, § 10.3.
 */

// The subtype entities: importing them registers their classes, so the browser reads a board or a room as its subtype
import '@mj-biz-apps/collaboration-example-space-types-entities';

// Board UI Plug-in & Components
export * from './board/ExampleBoardUIDriver.js';
export * from './board/providers.js';
export * from './board/components/ExampleBoardMeetingsTab.js';
export * from './board/components/ExampleBoardMotionsTab.js';
export * from './board/components/ExampleBoardPapersTab.js';
export * from './board/components/ExampleBoardNextMeetingCard.js';
export * from './board/components/ExampleBoardAgendaCard.js';
export * from './board/components/ExampleBoardVoteCard.js';
export * from './board/components/ExampleBoardMembersCard.js';

// Room UI Plug-in & Components
export * from './room/ExampleRoomUIDriver.js';
export * from './room/ExampleRoomDealSummaryCard.js';

// A contribution any app could make: a card on every space type
export * from './ExampleAnySpaceNoticeCard.js';

// The subtypes' forms: importing the module registers them, so a host that loads the examples shows them for the subtypes' details
export * from './generated/generated-forms.module.js';
