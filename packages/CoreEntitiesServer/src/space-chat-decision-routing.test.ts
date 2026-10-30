import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RunView, type IMetadataProvider, type IRunViewProvider, type RunViewParams, type RunViewResult, type UserInfo } from '@memberjunction/core';
import { resolveTurnAgentViaDecision } from '../dist/index.js';

const SPACE_ID = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_ID = '22222222-2222-4222-8222-222222222222';
const USER_MSG_ID = '33333333-3333-4333-8333-333333333333';
const SPACE_AGENT_ID = '9e6d761a-197a-40af-995b-3d3dd9bd7b9e';
const FINANCE_AGENT_ID = '4f8822aa-bb11-4cc2-9dd3-112233445566';
const ADA_ID = 'aaaa0001-0000-4000-8000-000000000001';
const BEA_ID = 'bbbb0002-0000-4000-8000-000000000002';

const systemUser = { ID: '00000000-0000-0000-0000-000000000001', Name: 'System' } as unknown as UserInfo;

function createMockView(historyRows: Array<Record<string, unknown>>): RunView {
    const provider: Partial<IMetadataProvider & IRunViewProvider> = {
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            if (params.EntityName === 'MJ: AI Agents') {
                return {
                    Success: true,
                    Results: [
                        {
                            ID: SPACE_AGENT_ID,
                            Name: 'Collaboration Space Agent',
                            Description: 'Answers questions about shared files, tasks, and notes in the space.',
                            Status: 'Active',
                            IsRestricted: false,
                        },
                        {
                            ID: FINANCE_AGENT_ID,
                            Name: 'Finance Analyst Agent',
                            Description: 'Analyzes budget variance, burn rate, and financial projections.',
                            Status: 'Active',
                            IsRestricted: false,
                        },
                    ] as unknown as T[],
                    RowCount: 2,
                    TotalRowCount: 2,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                return {
                    Success: true,
                    Results: [
                        { UserID: ADA_ID, User: 'Ada Lovelace' },
                        { UserID: BEA_ID, User: 'Bea' },
                    ] as unknown as T[],
                    RowCount: 2,
                    TotalRowCount: 2,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (params.EntityName === 'MJ: Conversation Details') {
                return {
                    Success: true,
                    Results: historyRows as unknown as T[],
                    RowCount: historyRows.length,
                    TotalRowCount: historyRows.length,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            return {
                Success: true,
                Results: [],
                RowCount: 0,
                TotalRowCount: 0,
                ExecutionTime: 1,
                ErrorMessage: '',
            };
        },
    };
    return RunView.FromMetadataProvider(provider as IMetadataProvider);
}

describe('resolveTurnAgentViaDecision (multi-party / multi-agent routing)', () => {
    it('refuses immediately without calling the decision model when no agent has replied in the conversation yet', async () => {
        let runnerCalled = false;
        const view = createMockView([
            {
                ID: 'd-1',
                Role: 'User',
                UserID: ADA_ID,
                User: 'Ada Lovelace',
                Message: 'Welcome to the space everyone!',
                __mj_CreatedAt: '2026-10-30T10:00:00Z',
            },
        ]);

        const res = await resolveTurnAgentViaDecision({
            view,
            system: systemUser,
            spaceId: SPACE_ID,
            conversationId: CONVERSATION_ID,
            userMessageId: USER_MSG_ID,
            messageText: 'What files are shared here?',
            allowedAgentIds: [SPACE_AGENT_ID, FINANCE_AGENT_ID],
            decisionRunner: async () => {
                runnerCalled = true;
                return { Success: false, Answers: {} };
            },
        });

        assert.equal(res.ok, false);
        assert.equal(runnerCalled, false);
    });

    it('routes an unmentioned follow-up to the active agent and includes multi-party speaker names in the state', async () => {
        let capturedState = '';
        const view = createMockView([
            {
                ID: 'd-1',
                Role: 'User',
                UserID: ADA_ID,
                User: 'Ada Lovelace',
                Message: `@{"type":"agent","id":"${SPACE_AGENT_ID}","name":"Collaboration Space Agent"} what files are shared in Discovery?`,
                __mj_CreatedAt: '2026-10-30T10:00:00Z',
            },
            {
                ID: 'd-2',
                Role: 'AI',
                AgentID: SPACE_AGENT_ID,
                Message: 'Discovery currently shares site-photo.png and the onboarding checklist.',
                __mj_CreatedAt: '2026-10-30T10:00:05Z',
            },
            {
                ID: 'd-3',
                Role: 'User',
                UserID: BEA_ID,
                User: 'Bea',
                Message: 'Thanks Ada!',
                __mj_CreatedAt: '2026-10-30T10:00:15Z',
            },
        ]);

        const res = await resolveTurnAgentViaDecision({
            view,
            system: systemUser,
            spaceId: SPACE_ID,
            conversationId: CONVERSATION_ID,
            userMessageId: USER_MSG_ID,
            messageText: 'Which of those shared files was uploaded most recently?',
            allowedAgentIds: [SPACE_AGENT_ID, FINANCE_AGENT_ID],
            decisionRunner: async ({ state }) => {
                capturedState = state;
                return {
                    Success: true,
                    ModelName: 'LLM Decision',
                    ResolvedModel: 'GPT-OSS-120B',
                    Answers: {
                        route: {
                            Kind: 'Choice',
                            Value: SPACE_AGENT_ID,
                            Confidence: 0.96,
                            Probabilities: { [SPACE_AGENT_ID]: 0.96, no_agent: 0.04 },
                        },
                        continues: {
                            Kind: 'Likelihood',
                            Probability: 0.95,
                        },
                    },
                };
            },
        });

        assert.equal(res.ok, true);
        if (res.ok) {
            assert.equal(res.agentId.toLowerCase(), SPACE_AGENT_ID.toLowerCase());
        }
        assert.match(capturedState, /Ada Lovelace:/);
        assert.match(capturedState, /Bea: Thanks Ada!/);
    });

    it('switches to a second participating agent when the decision routes to it and continues is low', async () => {
        const view = createMockView([
            {
                ID: 'd-1',
                Role: 'User',
                UserID: ADA_ID,
                Message: `@{"type":"agent","id":"${FINANCE_AGENT_ID}","name":"Finance Analyst Agent"} what is the Q3 burn rate?`,
                __mj_CreatedAt: '2026-10-30T10:00:00Z',
            },
            {
                ID: 'd-2',
                Role: 'AI',
                AgentID: FINANCE_AGENT_ID,
                Message: 'The Q3 burn rate is $42k/month, which is 8% under budget.',
                __mj_CreatedAt: '2026-10-30T10:00:05Z',
            },
            {
                ID: 'd-3',
                Role: 'User',
                UserID: BEA_ID,
                Message: `@{"type":"agent","id":"${SPACE_AGENT_ID}","name":"Collaboration Space Agent"} list the open tasks.`,
                __mj_CreatedAt: '2026-10-30T10:01:00Z',
            },
            {
                ID: 'd-4',
                Role: 'AI',
                AgentID: SPACE_AGENT_ID,
                Message: 'There are 2 open tasks: site survey and kickoff deck.',
                __mj_CreatedAt: '2026-10-30T10:01:05Z',
            },
        ]);

        const res = await resolveTurnAgentViaDecision({
            view,
            system: systemUser,
            spaceId: SPACE_ID,
            conversationId: CONVERSATION_ID,
            userMessageId: USER_MSG_ID,
            messageText: 'Can you break that $42k/month burn rate down by vendor category?',
            allowedAgentIds: [SPACE_AGENT_ID, FINANCE_AGENT_ID],
            decisionRunner: async () => ({
                Success: true,
                ModelName: 'Jev',
                ResolvedModel: 'typesafe/jev-1.13-20260917',
                Answers: {
                    route: {
                        Kind: 'Choice',
                        Value: FINANCE_AGENT_ID,
                        Confidence: 0.99,
                        Probabilities: {
                            [FINANCE_AGENT_ID]: 0.99,
                            [SPACE_AGENT_ID]: 0.005,
                            no_agent: 0.005,
                        },
                    },
                    continues: {
                        Kind: 'Likelihood',
                        Probability: 0.05,
                    },
                },
            }),
        });

        assert.equal(res.ok, true);
        if (res.ok) {
            assert.equal(res.agentId.toLowerCase(), FINANCE_AGENT_ID.toLowerCase());
        }
    });

    it('refuses a human-to-human remark when the decision selects no_agent', async () => {
        const view = createMockView([
            {
                ID: 'd-1',
                Role: 'AI',
                AgentID: SPACE_AGENT_ID,
                Message: 'Here are the shared files.',
                __mj_CreatedAt: '2026-10-30T10:00:05Z',
            },
        ]);

        const res = await resolveTurnAgentViaDecision({
            view,
            system: systemUser,
            spaceId: SPACE_ID,
            conversationId: CONVERSATION_ID,
            userMessageId: USER_MSG_ID,
            messageText: 'Hey Ada, I am grabbing coffee before our 2pm call — want an iced latte?',
            allowedAgentIds: [SPACE_AGENT_ID],
            decisionRunner: async () => ({
                Success: true,
                ModelName: 'Jev',
                ResolvedModel: 'typesafe/jev-1.13-20260917',
                Answers: {
                    route: {
                        Kind: 'Choice',
                        Value: 'no_agent',
                        Confidence: 0.99,
                        Probabilities: { [SPACE_AGENT_ID]: 0.01, no_agent: 0.99 },
                    },
                    continues: {
                        Kind: 'Likelihood',
                        Probability: 0.02,
                    },
                },
            }),
        });

        assert.equal(res.ok, false);
        if (!res.ok) {
            assert.equal(res.message, 'The message does not mention an agent.');
            assert.equal(res.outcome?.Verdict, 'NoAgent');
        }
    });
});
