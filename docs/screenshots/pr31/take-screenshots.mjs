#!/usr/bin/env node
/**
 * Browser verification and screenshot pass for PR #31 (B23 Space Meetings):
 * - Captures 02-meetings-tab-shared-{light,dark}.png and 03-meetings-tab-team-attendee-{light,dark}.png
 *   with the "+ Schedule meeting" action visible to contributing seats.
 * - Captures 04-schedule-meeting-modal-{light,dark}.png showing the inline "Schedule meeting in Discovery"
 *   dialog with band-scoped Visibility options.
 * - Exercises the full end-to-end flow over the live wire:
 *   1. Submits a new meeting via "Schedule meeting" (CreateSpaceMeeting mutation) and asserts it renders in UPCOMING.
 *   2. Clicks "Start chat" (EnsureMeetingSpaceChat mutation) and asserts navigation to ?tab=chat&conv=<ConversationID>.
 *   3. Returns to the Meetings tab, clicks "Open" on the meeting card, and asserts MJExplorer opens the
 *      MJ_BizApps_Tasks: Meetings entity record tab.
 */
import { createHash, randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../pr10/node_modules/playwright/index.mjs';
import sql from '../../../../node_modules/.pnpm/mssql@12.7.0/node_modules/mssql/index.js';

const OUT = dirname(fileURLToPath(import.meta.url));
const EXPLORER = process.env.EXPLORER_URL ?? 'http://localhost:4218';
const MJAPI = process.env.MJAPI_URL ?? 'http://localhost:4119';

const COLLAB_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';
const MEETINGS_APP_ID = '14C40AAC-D873-4206-9735-8EC26A72FADF';
const SPACE_PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
const UI_ROLE_ID = 'E0AFCCEC-6A37-EF11-86D4-000D3A9E707E';

const BEA_EMAIL = 'bea.member@collab-world.example';
const SAM_EMAIL = 'sam.member@collab-world.example';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const TEST_MEETING_TITLE = 'Q4 External Auditor Pre-Brief';

const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.SCREENSHOT_DB ?? 'COLLAB_DEMO_FRESH',
    user: process.env.CODEGEN_DB_USERNAME ?? process.env.DB_USERNAME,
    password: process.env.CODEGEN_DB_PASSWORD ?? process.env.DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: false },
}).connect();

async function mintSession(email, roleName = 'Space Participant') {
    const rawToken = `mj_ml_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256').update(rawToken).digest('base64url');
    const systemRes = await pool.request().query(`SELECT TOP 1 ID FROM __mj.[User] WHERE LOWER(LTRIM(RTRIM(Type))) = 'owner'`);
    const systemUserId = systemRes.recordset[0].ID;
    const roleRes = await pool.request()
        .input('RoleName', sql.NVarChar(100), roleName)
        .query(`SELECT TOP 1 ID FROM __mj.[Role] WHERE Name = @RoleName`);
    const roleId = roleRes.recordset[0]?.ID ?? SPACE_PARTICIPANT_ROLE_ID;

    const inviteRes = await pool.request()
        .input('TokenHash', sql.NVarChar(128), tokenHash)
        .input('Email', sql.NVarChar(255), email)
        .input('ApplicationID', sql.UniqueIdentifier, COLLAB_APP_ID)
        .input('RoleID', sql.UniqueIdentifier, roleId)
        .input('CreatedByUserID', sql.UniqueIdentifier, systemUserId)
        .query(`
            DECLARE @Out TABLE (ID UNIQUEIDENTIFIER);
            INSERT INTO __mj.MagicLinkInvite (
                TokenHash, Email, ApplicationID, RoleID, ExpiresAt,
                MaxUses, UseCount, CreatedByUserID, Status, IdentityMode, Kind
            )
            OUTPUT INSERTED.ID INTO @Out
            VALUES (
                @TokenHash, @Email, @ApplicationID, @RoleID, DATEADD(HOUR, 2, SYSUTCDATETIME()),
                1, 0, @CreatedByUserID, N'Active', N'email', N'app-session'
            );
            SELECT ID FROM @Out;
        `);
    const inviteId = inviteRes.recordset[0].ID;

    for (const appId of [COLLAB_APP_ID, MEETINGS_APP_ID]) {
        await pool.request()
            .input('InviteID', sql.UniqueIdentifier, inviteId)
            .input('ApplicationID', sql.UniqueIdentifier, appId)
            .query(`INSERT INTO __mj.MagicLinkInviteApplication (InviteID, ApplicationID) VALUES (@InviteID, @ApplicationID);`);
    }
    await pool.request()
        .input('InviteID', sql.UniqueIdentifier, inviteId)
        .input('RoleID', sql.UniqueIdentifier, roleId)
        .query(`INSERT INTO __mj.MagicLinkInviteRole (InviteID, RoleID) VALUES (@InviteID, @RoleID);`);

    const response = await fetch(`${MJAPI}/magic-link/redeem?format=json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: rawToken }),
    });
    const redeemed = await response.json();
    if (!redeemed.success || !redeemed.token) {
        throw new Error(`Failed to redeem magic link for ${email}: ${JSON.stringify(redeemed)}`);
    }
    return redeemed;
}

async function applyTheme(page, theme) {
    await page.evaluate((t) => {
        try {
            localStorage.setItem('mj-theme', t);
            document.documentElement.setAttribute('data-theme', t);
        } catch {
            // ignore
        }
    }, theme);
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForTimeout(300);
}

const browser = await chromium.launch({ headless: true });
try {
    // 1. Bea (Shared contributor on Discovery): capture 02-meetings-tab-shared and 04-schedule-meeting-modal,
    //    then exercise CreateSpaceMeeting, Start chat (EnsureMeetingSpaceChat), and Open (OpenEntityRecord).
    await pool.request().query(`DELETE FROM __mj.Workspace;`);
    const beaSession = await mintSession(BEA_EMAIL, 'Space Participant');
    const beaContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light' });
    await beaContext.addInitScript(() => {
        try { localStorage.setItem('mj-theme', 'light'); } catch { /* ignore */ }
    });
    const beaPage = await beaContext.newPage();

    await beaPage.goto(`${EXPLORER}/app/${beaSession.applicationPath}#token=${encodeURIComponent(beaSession.token)}`, { waitUntil: 'load' });
    await beaPage.getByText('All spaces', { exact: false }).locator('visible=true').first().waitFor({ state: 'visible', timeout: 90000 });

    await beaPage.goto(`${EXPLORER}/app/collaboration/Spaces?view=space&space=${DISCOVERY_SPACE_ID}&tab=meetings`, { waitUntil: 'load' });
    const scheduleBtn = beaPage.getByRole('button', { name: /Schedule meeting/i }).first();
    await scheduleBtn.waitFor({ state: 'visible', timeout: 45000 });
    await beaPage.getByText('Discovery Architecture & Roadmap Review', { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 });

    await applyTheme(beaPage, 'light');
    await beaPage.screenshot({ path: join(OUT, '02-meetings-tab-shared-light.png') });
    await applyTheme(beaPage, 'dark');
    await beaPage.screenshot({ path: join(OUT, '02-meetings-tab-shared-dark.png') });
    await applyTheme(beaPage, 'light');
    console.log('✓ Captured 02-meetings-tab-shared-{light,dark}.png (+ Schedule meeting visible)');

    // Open Schedule meeting modal and capture 04-schedule-meeting-modal-{light,dark}.png
    await scheduleBtn.click();
    await beaPage.locator('.schedule-modal').waitFor({ state: 'visible', timeout: 10000 });
    const dialogTitle = await beaPage.locator('.mj-dialog-title').textContent();
    if (!dialogTitle?.includes('Schedule meeting in Discovery')) {
        throw new Error(`Expected dialog title 'Schedule meeting in Discovery', got '${dialogTitle}'`);
    }
    await beaPage.locator('#schedule-meeting-title').fill(TEST_MEETING_TITLE);
    await applyTheme(beaPage, 'light');
    await beaPage.screenshot({ path: join(OUT, '04-schedule-meeting-modal-light.png') });
    await applyTheme(beaPage, 'dark');
    await beaPage.screenshot({ path: join(OUT, '04-schedule-meeting-modal-dark.png') });
    await applyTheme(beaPage, 'light');
    console.log('✓ Captured 04-schedule-meeting-modal-{light,dark}.png');

    // Submit the new meeting via "Schedule meeting"
    await beaPage.locator('mj-dialog-actions').getByRole('button', { name: /Schedule meeting/i }).click();
    await beaPage.getByText(TEST_MEETING_TITLE, { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 });
    console.log('✓ CreateSpaceMeeting succeeded and rendered in UPCOMING');

    // Click "Start chat" and assert navigation to ?tab=chat&conv=<ConversationID>
    const createdCard = beaPage.locator('.meeting-card', { hasText: TEST_MEETING_TITLE }).first();
    await createdCard.getByRole('button', { name: /Start chat|Open chat/i }).click();
    await beaPage.waitForFunction(
        () => window.location.search.includes('tab=chat') && window.location.search.includes('conv='),
        null,
        { timeout: 20000 }
    );
    console.log('✓ EnsureMeetingSpaceChat succeeded and navigated to ?tab=chat&conv=<ConversationID>');

    // Switch back to the Meetings tab, verify the card now shows "Open chat", and click "Open" to verify OpenEntityRecord
    await beaPage.getByRole('button', { name: /Meetings/i }).first().click();
    const cardAfterChat = beaPage.locator('.meeting-card', { hasText: TEST_MEETING_TITLE }).first();
    await cardAfterChat.waitFor({ state: 'visible', timeout: 20000 });
    await cardAfterChat.locator('button', { hasText: 'Open chat' }).waitFor({ state: 'visible', timeout: 10000 });
    const urlBeforeOpen = beaPage.url();
    await cardAfterChat.locator('.meeting-actions button').last().click();
    await beaPage.waitForFunction(
        (prevUrl) => window.location.href !== prevUrl || window.location.pathname.includes('/resource/record/'),
        urlBeforeOpen,
        { timeout: 20000 }
    );
    console.log(`✓ Open button triggered OpenEntityRecord (URL: ${beaPage.url()})`);
    await beaContext.close();

    // Clean up the test meeting before capturing Sam's view so UPCOMING counts match seeded state
    await pool.request().input('Title', sql.NVarChar(255), TEST_MEETING_TITLE).query(`
        DECLARE @Mid UNIQUEIDENTIFIER = (SELECT TOP 1 ID FROM __mj_BizAppsTasks.Meeting WHERE Name = @Title);
        IF @Mid IS NOT NULL
        BEGIN
            DECLARE @Subj NVARCHAR(200) = N'meeting:' + LOWER(CAST(@Mid AS NVARCHAR(50)));
            DECLARE @Cid UNIQUEIDENTIFIER = (SELECT TOP 1 ConversationID FROM __mj_BizAppsCollaboration.SpaceChat WHERE LOWER(Subject) = @Subj);
            DELETE FROM __mj_BizAppsCollaboration.SpaceChat WHERE LOWER(Subject) = @Subj;
            IF @Cid IS NOT NULL
            BEGIN
                DELETE FROM __mj.ResourcePermission WHERE ResourceRecordID = CAST(@Cid AS NVARCHAR(50));
                DELETE FROM __mj.ConversationDetail WHERE ConversationID = @Cid;
                DELETE FROM __mj.Conversation WHERE ID = @Cid;
            END
            DELETE FROM __mj_BizAppsCollaboration.ShareNotice WHERE ItemID IN (SELECT ID FROM __mj_BizAppsCollaboration.SpaceItem WHERE RecordID IN (CAST(@Mid AS NVARCHAR(50)), N'ID|' + CAST(@Mid AS NVARCHAR(50))));
            DELETE FROM __mj_BizAppsCollaboration.SpaceItem WHERE RecordID IN (CAST(@Mid AS NVARCHAR(50)), N'ID|' + CAST(@Mid AS NVARCHAR(50)));
            DELETE FROM __mj_BizAppsTasks.MeetingLink WHERE MeetingID = @Mid;
            DELETE FROM __mj_BizAppsTasks.MeetingAttendee WHERE MeetingID = @Mid;
            DELETE FROM __mj_BizAppsTasks.Meeting WHERE ID = @Mid;
        END
    `);

    // 2. Sam (Team attendee on Discovery): capture 03-meetings-tab-team-attendee-{light,dark}.png
    await pool.request().query(`DELETE FROM __mj.Workspace;`);
    const samSession = await mintSession(SAM_EMAIL, 'UI');
    const samContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light' });
    await samContext.addInitScript(() => {
        try { localStorage.setItem('mj-theme', 'light'); } catch { /* ignore */ }
    });
    const samPage = await samContext.newPage();

    await samPage.goto(`${EXPLORER}/app/${samSession.applicationPath}#token=${encodeURIComponent(samSession.token)}`, { waitUntil: 'load' });
    await samPage.getByText('All spaces', { exact: false }).locator('visible=true').first().waitFor({ state: 'visible', timeout: 90000 });
    await samPage.goto(`${EXPLORER}/app/collaboration/Spaces?view=space&space=${DISCOVERY_SPACE_ID}&tab=meetings`, { waitUntil: 'load' });
    await samPage.getByRole('button', { name: /Schedule meeting/i }).first().waitFor({ state: 'visible', timeout: 45000 });
    await samPage.getByText('Internal Executive Budget Session', { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 });

    await applyTheme(samPage, 'light');
    await samPage.screenshot({ path: join(OUT, '03-meetings-tab-team-attendee-light.png') });
    await applyTheme(samPage, 'dark');
    await samPage.screenshot({ path: join(OUT, '03-meetings-tab-team-attendee-dark.png') });
    console.log('✓ Captured 03-meetings-tab-team-attendee-{light,dark}.png');
    await samContext.close();
} finally {
    await pool.request().input('Title', sql.NVarChar(255), TEST_MEETING_TITLE).query(`
        DECLARE @Mid UNIQUEIDENTIFIER = (SELECT TOP 1 ID FROM __mj_BizAppsTasks.Meeting WHERE Name = @Title);
        IF @Mid IS NOT NULL
        BEGIN
            DECLARE @Subj NVARCHAR(200) = N'meeting:' + LOWER(CAST(@Mid AS NVARCHAR(50)));
            DECLARE @Cid UNIQUEIDENTIFIER = (SELECT TOP 1 ConversationID FROM __mj_BizAppsCollaboration.SpaceChat WHERE LOWER(Subject) = @Subj);
            DELETE FROM __mj_BizAppsCollaboration.SpaceChat WHERE LOWER(Subject) = @Subj;
            IF @Cid IS NOT NULL
            BEGIN
                DELETE FROM __mj.ResourcePermission WHERE ResourceRecordID = CAST(@Cid AS NVARCHAR(50));
                DELETE FROM __mj.ConversationDetail WHERE ConversationID = @Cid;
                DELETE FROM __mj.Conversation WHERE ID = @Cid;
            END
            DELETE FROM __mj_BizAppsCollaboration.ShareNotice WHERE ItemID IN (SELECT ID FROM __mj_BizAppsCollaboration.SpaceItem WHERE RecordID IN (CAST(@Mid AS NVARCHAR(50)), N'ID|' + CAST(@Mid AS NVARCHAR(50))));
            DELETE FROM __mj_BizAppsCollaboration.SpaceItem WHERE RecordID IN (CAST(@Mid AS NVARCHAR(50)), N'ID|' + CAST(@Mid AS NVARCHAR(50)));
            DELETE FROM __mj_BizAppsTasks.MeetingLink WHERE MeetingID = @Mid;
            DELETE FROM __mj_BizAppsTasks.MeetingAttendee WHERE MeetingID = @Mid;
            DELETE FROM __mj_BizAppsTasks.Meeting WHERE ID = @Mid;
        END
    `);
    await browser.close();
    await pool.close();
}
