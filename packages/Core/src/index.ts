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
export { authorizeNoticeWrite, authorizeUseWrite, foldersIn, recordUse, shareRecipients } from './phase2.js';
export type { LibraryItem, ItemUse } from './phase2.js';
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
