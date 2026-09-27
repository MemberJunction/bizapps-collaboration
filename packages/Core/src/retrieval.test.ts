import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    effectiveRetrievalScope,
    agentMayQuoteCandidate,
    type PrincipalReach,
    type AgentCandidateItem,
} from './retrieval.ts';
import type { SpaceNode } from './rules.ts';

describe('Audience-Bounded Retrieval & Verification Matrix (§ 10)', () => {
    // ------------------------------------------------------------------------
    // Test World Definition
    // ------------------------------------------------------------------------
    const boardSpace: SpaceNode = {
        id: 'space-board',
        parentId: null,
        inheritsMembership: false,
        ownerId: 'user-admin',
        agentRetrieval: 'Included',
    };

    const compSpace: SpaceNode = {
        id: 'space-compensation',
        parentId: 'space-board',
        inheritsMembership: false, // Sealed / sub-spaces keep own membership
        ownerId: 'user-admin',
        agentRetrieval: 'Included',
    };

    const acmeSpace: SpaceNode = {
        id: 'space-acme',
        parentId: null,
        inheritsMembership: false,
        ownerId: 'user-admin',
        agentRetrieval: 'Included',
    };

    const acmeEngagementSpace: SpaceNode = {
        id: 'space-acme-engagement',
        parentId: 'space-acme',
        inheritsMembership: true,
        ownerId: 'user-admin',
        agentRetrieval: 'Included',
    };

    const testSpaces: SpaceNode[] = [boardSpace, compSpace, acmeSpace, acmeEngagementSpace];

    // Personas:
    // Director D: Board and Compensation (both Team band)
    const directorD: PrincipalReach = {
        userId: 'user-d',
        reachableSpaceIds: ['space-board', 'space-compensation'],
        canSeeTeamSpaceIds: ['space-board', 'space-compensation'],
        isInternalOrg: true,
    };

    // Director E: Board only (Team band)
    const directorE: PrincipalReach = {
        userId: 'user-e',
        reachableSpaceIds: ['space-board'],
        canSeeTeamSpaceIds: ['space-board'],
        isInternalOrg: true,
    };

    // Outside director O: Board only (Shared band)
    const outsideDirectorO: PrincipalReach = {
        userId: 'user-o',
        reachableSpaceIds: ['space-board'],
        canSeeTeamSpaceIds: [], // Shared only
        isInternalOrg: false,
    };

    // Consultant C: Acme and Acme Engagement (Team band on both)
    const consultantC: PrincipalReach = {
        userId: 'user-c',
        reachableSpaceIds: ['space-acme', 'space-acme-engagement'],
        canSeeTeamSpaceIds: ['space-acme', 'space-acme-engagement'],
        isInternalOrg: true,
    };

    // Client K: Acme (Shared band only)
    const clientK: PrincipalReach = {
        userId: 'user-k',
        reachableSpaceIds: ['space-acme'],
        canSeeTeamSpaceIds: [], // Shared only
        isInternalOrg: false,
    };

    // Stranger S: No seats
    const strangerS: PrincipalReach = {
        userId: 'user-s',
        reachableSpaceIds: [],
        canSeeTeamSpaceIds: [],
        isInternalOrg: false,
    };

    const allReaches: PrincipalReach[] = [
        directorD,
        directorE,
        outsideDirectorO,
        consultantC,
        clientK,
        strangerS,
    ];

    // ------------------------------------------------------------------------
    // Matrix Row 1: D, private chat, scope 'everything'
    // Expected: Uses Board and Compensation material (Team band on both)
    // ------------------------------------------------------------------------
    it('Matrix 1: Director D in private chat with scope everything can retrieve Board and Compensation', () => {
        const scope = effectiveRetrievalScope({
            audience: {
                principals: ['user-d'],
                mode: 'Private',
                narrowing: 'Everything',
            },
            spaces: testSpaces,
            principalReaches: allReaches,
        });

        assert.equal(scope.allowedSpaceIds.length, 2);
        assert.ok(scope.allowedSpaceIds.includes('space-board'));
        assert.ok(scope.allowedSpaceIds.includes('space-compensation'));
        assert.equal(scope.spaceBands.get('space-board'), 'Team');
        assert.equal(scope.spaceBands.get('space-compensation'), 'Team');
        assert.equal(scope.allowedBand, 'Team');

        // Can quote Team item from Compensation
        const compItem: AgentCandidateItem = {
            id: 'item-1',
            spaceId: 'space-compensation',
            band: 'Team',
        };
        const quoteDecision = agentMayQuoteCandidate(compItem, scope);
        assert.equal(quoteDecision.allowed, true);
    });

    // ------------------------------------------------------------------------
    // Matrix Row 2: D, private chat from Board, scope 'this space'
    // Expected: Board only (Compensation excluded by narrowing)
    // ------------------------------------------------------------------------
    it('Matrix 2: Director D in private chat scoped to ThisSpace retrieves Board only', () => {
        const scope = effectiveRetrievalScope({
            audience: {
                principals: ['user-d'],
                mode: 'Private',
                anchorSpaceId: 'space-board',
                narrowing: 'ThisSpace',
            },
            spaces: testSpaces,
            principalReaches: allReaches,
        });

        assert.deepEqual(scope.allowedSpaceIds, ['space-board']);
        assert.equal(scope.spaceBands.get('space-board'), 'Team');

        // Cannot quote Compensation item
        const compItem: AgentCandidateItem = {
            id: 'item-1',
            spaceId: 'space-compensation',
            band: 'Team',
        };
        const quoteDecision = agentMayQuoteCandidate(compItem, scope);
        assert.equal(quoteDecision.allowed, false);
        assert.match(quoteDecision.reason ?? '', /not within the effective retrieval scope/);
    });

    // ------------------------------------------------------------------------
    // Matrix Row 3: D and E in the Board's room
    // Expected: No Compensation material in retrieval, the answer, or access log
    // ------------------------------------------------------------------------
    it('Matrix 3: D and E in Board room intersection excludes Compensation material', () => {
        const scope = effectiveRetrievalScope({
            audience: {
                principals: ['user-d', 'user-e'],
                mode: 'Shared',
                anchorSpaceId: 'space-board',
                narrowing: 'ThisSpaceAndSubspaces',
            },
            spaces: testSpaces,
            principalReaches: allReaches,
        });

        // Intersection between D and E is only 'space-board'
        assert.deepEqual(scope.allowedSpaceIds, ['space-board']);
        assert.equal(scope.spaceBands.get('space-board'), 'Team');

        // Refusal for Compensation material
        const compItem: AgentCandidateItem = {
            id: 'comp-exec-salary',
            spaceId: 'space-compensation',
            band: 'Team',
        };
        const quoteDecision = agentMayQuoteCandidate(compItem, scope);
        assert.equal(quoteDecision.allowed, false);
        assert.match(quoteDecision.reason ?? '', /not within the effective retrieval scope/);
    });

    // ------------------------------------------------------------------------
    // Matrix Row 5: C alone asks about Acme
    // Expected: Team and Shared in Acme and its sub-space
    // ------------------------------------------------------------------------
    it('Matrix 5: Consultant C alone retrieves Team and Shared from Acme and sub-spaces', () => {
        const scope = effectiveRetrievalScope({
            audience: {
                principals: ['user-c'],
                mode: 'Private',
                anchorSpaceId: 'space-acme',
                narrowing: 'ThisSpaceAndSubspaces',
            },
            spaces: testSpaces,
            principalReaches: allReaches,
        });

        assert.equal(scope.allowedSpaceIds.length, 2);
        assert.ok(scope.allowedSpaceIds.includes('space-acme'));
        assert.ok(scope.allowedSpaceIds.includes('space-acme-engagement'));
        assert.equal(scope.spaceBands.get('space-acme'), 'Team');
        assert.equal(scope.spaceBands.get('space-acme-engagement'), 'Team');

        const teamItem: AgentCandidateItem = {
            id: 'item-deliverable-draft',
            spaceId: 'space-acme',
            band: 'Team',
        };
        assert.equal(agentMayQuoteCandidate(teamItem, scope).allowed, true);
    });

    // ------------------------------------------------------------------------
    // Matrix Row 6: C and K in the Acme room
    // Expected: Shared only! (K cannot see Team)
    // ------------------------------------------------------------------------
    it('Matrix 6: C and K in Acme room bounds retrieval to Shared only', () => {
        const scope = effectiveRetrievalScope({
            audience: {
                principals: ['user-c', 'user-k'],
                mode: 'Shared',
                anchorSpaceId: 'space-acme',
            },
            spaces: testSpaces,
            principalReaches: allReaches,
        });

        assert.deepEqual(scope.allowedSpaceIds, ['space-acme']);
        // Effective band MUST be 'Shared' because K cannot see Team
        assert.equal(scope.spaceBands.get('space-acme'), 'Shared');
        assert.equal(scope.allowedBand, 'Shared');

        // Shared item is allowed
        const sharedItem: AgentCandidateItem = {
            id: 'item-final-deck',
            spaceId: 'space-acme',
            band: 'Shared',
        };
        assert.equal(agentMayQuoteCandidate(sharedItem, scope).allowed, true);

        // Team item is REFUSED
        const teamItem: AgentCandidateItem = {
            id: 'item-internal-rate-sheet',
            spaceId: 'space-acme',
            band: 'Team',
        };
        const quoteDecision = agentMayQuoteCandidate(teamItem, scope);
        assert.equal(quoteDecision.allowed, false);
        assert.match(quoteDecision.reason ?? '', /Team-band material.*cannot be quoted/);
    });

    // ------------------------------------------------------------------------
    // Matrix Row 8: Mixed Teams channel with an unmapped member
    // Expected: Only Public knowledge; no space material
    // ------------------------------------------------------------------------
    it('Matrix 8: Mixed channel with an unmapped member allows only Public knowledge', () => {
        const scope = effectiveRetrievalScope({
            audience: {
                principals: ['user-k', 'user-unknown-external'],
                mode: 'Shared',
                hasUnmappedPrincipal: true,
            },
            spaces: testSpaces,
            principalReaches: allReaches,
        });

        assert.deepEqual(scope.allowedSpaceIds, []);

        // Space item refused
        const spaceItem: AgentCandidateItem = {
            id: 'item-shared',
            spaceId: 'space-acme',
            band: 'Shared',
        };
        const quoteDecision = agentMayQuoteCandidate(spaceItem, scope);
        assert.equal(quoteDecision.allowed, false);

        // Organization knowledge refused
        const orgItem: AgentCandidateItem = {
            id: 'kb-methodology',
            spaceId: '',
            band: 'Shared',
            classification: 'Organization',
        };
        assert.equal(agentMayQuoteCandidate(orgItem, scope).allowed, false);

        // Public knowledge allowed
        const publicItem: AgentCandidateItem = {
            id: 'kb-public-whitepaper',
            spaceId: '',
            band: 'Shared',
            classification: 'Public',
        };
        assert.equal(agentMayQuoteCandidate(publicItem, scope).allowed, true);
    });

    // ------------------------------------------------------------------------
    // Additional Edge Cases: ExcludedEntirely and ExcludedFromParentScope
    // ------------------------------------------------------------------------
    it('respects ExcludedEntirely and ExcludedFromParentScope on spaces', () => {
        const privateSubSpace: SpaceNode = {
            id: 'space-private-notes',
            parentId: 'space-board',
            inheritsMembership: false,
            ownerId: 'user-admin',
            agentRetrieval: 'ExcludedEntirely',
        };

        const isolatedSubSpace: SpaceNode = {
            id: 'space-isolated',
            parentId: 'space-board',
            inheritsMembership: false,
            ownerId: 'user-admin',
            agentRetrieval: 'ExcludedFromParentScope',
        };

        const spacesWithSpecial: SpaceNode[] = [
            boardSpace,
            privateSubSpace,
            isolatedSubSpace,
        ];

        const userWithAll: PrincipalReach = {
            userId: 'user-super',
            reachableSpaceIds: ['space-board', 'space-private-notes', 'space-isolated'],
            canSeeTeamSpaceIds: ['space-board', 'space-private-notes', 'space-isolated'],
            isInternalOrg: true,
        };

        // Queried from board: isolated and excluded-entirely sub-spaces should be omitted
        const scopeFromParent = effectiveRetrievalScope({
            audience: {
                principals: ['user-super'],
                anchorSpaceId: 'space-board',
                narrowing: 'ThisSpaceAndSubspaces',
            },
            spaces: spacesWithSpecial,
            principalReaches: [userWithAll],
        });

        assert.deepEqual(scopeFromParent.allowedSpaceIds, ['space-board']);

        // Queried from isolated space directly: isolated is included, but excluded-entirely is still omitted
        const scopeDirect = effectiveRetrievalScope({
            audience: {
                principals: ['user-super'],
                anchorSpaceId: 'space-isolated',
                narrowing: 'ThisSpaceAndSubspaces',
            },
            spaces: spacesWithSpecial,
            principalReaches: [userWithAll],
        });

        assert.deepEqual(scopeDirect.allowedSpaceIds, ['space-isolated']);
    });
});
