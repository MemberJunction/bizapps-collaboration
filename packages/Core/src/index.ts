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
export { authorizeNoticeWrite, authorizeUseWrite, foldersIn, openMode, recordUse, requestedItemBand, shareRecipients, SPACE_UPLOAD_MAX_BYTES, storedContentType } from './phase2.js';
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
