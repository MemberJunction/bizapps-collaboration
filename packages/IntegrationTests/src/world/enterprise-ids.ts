/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Deterministic identifiers and domain-neutral names for the Cross-Stack Enterprise World
 * (`MJ Core` -> `bizapps-common` -> `bizapps-tasks` -> `bizapps-collaboration`).
 *
 * Every organization, task, anchor, and space seeded by `seed-enterprise-world.ts` uses
 * these fixed UUIDs so `load-world.ts` is idempotent and `purge-world.ts` cleanly reverses
 * every cross-stack row in FK-safe order without touching unrelated host records.
 */

export const MERIDIAN_ORG_ID = 'E9000001-0000-4000-8000-000000000001';
export const NORTHSTAR_ORG_ID = 'E9000001-0000-4000-8000-000000000002';
export const SOLSTICE_ORG_ID = 'E9000001-0000-4000-8000-000000000003';

export const ENTERPRISE_ORG_IDS: readonly string[] = [
    MERIDIAN_ORG_ID,
    NORTHSTAR_ORG_ID,
    SOLSTICE_ORG_ID,
];

export const MERIDIAN_COMPANY_ID = 'E9000004-0000-4000-8000-000000000001';
export const NORTHSTAR_COMPANY_ID = 'E9000004-0000-4000-8000-000000000002';
export const SOLSTICE_COMPANY_ID = 'E9000004-0000-4000-8000-000000000003';

export const ENTERPRISE_COMPANY_IDS: readonly string[] = [
    MERIDIAN_COMPANY_ID,
    NORTHSTAR_COMPANY_ID,
    SOLSTICE_COMPANY_ID,
];

export const NORTHSTAR_PROGRAM_TASK_ID = 'E9000002-0000-4000-8000-000000000001';
export const NORTHSTAR_PHASE1_TASK_ID = 'E9000002-0000-4000-8000-000000000002';
export const NORTHSTAR_SIGNOFF_TASK_ID = 'E9000002-0000-4000-8000-000000000003';
export const SOLSTICE_PROGRAM_TASK_ID = 'E9000002-0000-4000-8000-000000000011';
export const SOLSTICE_CALIBRATION_TASK_ID = 'E9000002-0000-4000-8000-000000000012';

export const ENTERPRISE_TASK_IDS: readonly string[] = [
    NORTHSTAR_PROGRAM_TASK_ID,
    NORTHSTAR_PHASE1_TASK_ID,
    NORTHSTAR_SIGNOFF_TASK_ID,
    SOLSTICE_PROGRAM_TASK_ID,
    SOLSTICE_CALIBRATION_TASK_ID,
];

export const ENTERPRISE_ORG_TYPE_ID = 'E9000005-0000-4000-8000-000000000001';
export const ENTERPRISE_REL_TYPE_ID = 'E9000005-0000-4000-8000-000000000002';
export const ENTERPRISE_CONTACT_TYPE_ID = 'E9000005-0000-4000-8000-000000000003';

export const ENTERPRISE_ORG_NAMES = {
    meridian: 'Meridian Advisory Group',
    northstar: 'Northstar Manufacturing Corp',
    solstice: 'Solstice Logistics Ltd',
} as const;

export const ENTERPRISE_SPACE_NAMES = {
    northstarHub: 'Northstar ERP Modernization Hub',
    northstarPhase1: 'Northstar Phase 1 Cutover',
    solsticeHub: 'Solstice Fleet Telemetry Hub',
} as const;

export const ENTERPRISE_DOC_TITLES = {
    northstarInternalMemo: 'Northstar Internal Pricing & Risk Memo',
    northstarSharedBrief: 'Northstar Phase 1 Architecture Brief',
    solsticeSharedGuide: 'Solstice Cold-Chain Calibration Guide',
} as const;

export const ENTERPRISE_NOTICE_TITLES = {
    northstarTeamNotice: 'Internal staffing allocation updated for Northstar ERP',
    northstarSharedNotice: 'Phase 1 architecture brief published for Northstar review',
    solsticeSharedNotice: 'Solstice cold-chain calibration window confirmed',
} as const;
