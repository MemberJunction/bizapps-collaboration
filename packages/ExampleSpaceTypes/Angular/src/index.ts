/**
 * Example Space Types - Client Package
 * Extensibility plan § 6, § 10.3.
 */

// The subtype entity: importing it registers its class, so the browser reads a board as its subtype
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

// A contribution any app could make: a card on every space type
export * from './ExampleAnySpaceNoticeCard.js';

// The subtype's form: importing the module registers it, so a host that loads the examples shows it for the board's details
export * from './generated/generated-forms.module.js';
