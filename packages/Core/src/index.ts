export {
    agentMayQuote,
    authorizeItemWrite,
    authorizeSpaceWrite,
    chainsForSpaceWrite,
    flagExceedsGrantor,
    initialMemberStatus,
    isSelfRemoval,
    leavingWouldStrand,
    membershipReaches,
    parentCreatesCycle,
    planSpaceWrite,
    promotionStamps,
    strandFromSavedRow,
    refuseInvite,
    retentionDeadline,
    visibleSpaces,
    wouldStrandLastOwner,
} from './rules.js';
export { itemsIn, phase0Items, phase0Members, phase0Spaces } from './phase0.js';
export { foldersIn, recordUse, shareRecipients } from './phase2.js';
export type { LibraryItem, ItemUse } from './phase2.js';
export type { Phase0Item } from './phase0.js';
export type {
    AgentRetrieval,
    Band,
    InviteApproval,
    InviteRefusal,
    MemberSnapshot,
    PromotionDecision,
    Retention,
    RoleFlags,
    SpaceNode,
    InviteDecision,
} from './rules.js';
