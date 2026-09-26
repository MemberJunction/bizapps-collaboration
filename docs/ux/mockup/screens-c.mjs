import { SPARK, P, av, avp, stack, ai, shared, team, chip, fileIcon, tile, page, topbar, navStaff, navGuest, spaceHeader, discoveryTabs, audienceChip, sharedCss } from './lib.mjs';
import { chatList, chatCss } from './screens-b.mjs';

/* ============================== 09 ASSISTANT SETTINGS (per space) ============================== */
export function assistantSettings() {
  const skill = (on, icon, title, desc, extra = '') => `
    <div class="skill"><span class="sk-ic"><i class="fa-solid ${icon}"></i></span><div class="grow"><div class="fw6 fs13">${title}${extra}</div><div class="fs12 muted">${desc}</div></div><span class="switch ${on ? 'on' : ''}"></span></div>`;
  const opt = (on, title, desc) => `<div class="opt ${on ? 'on' : ''}"><span class="radio ${on ? 'on' : ''}"></span><div><div class="fw6 fs13">${title}</div><div class="fs12 muted">${desc}</div></div></div>`;
  const body = `
  <div class="shell">
    ${topbar()}
    <div class="body">
      ${navStaff('discovery')}
      <main class="main">
        ${spaceHeader({ tabs: discoveryTabs, activeTab: 'Settings', audience: audienceChip(), actions: '' })}
        <div class="st">
          <nav class="st-nav">
            <div class="sn"><i class="fa-solid fa-sliders"></i>General</div>
            <div class="sn"><i class="fa-solid fa-user-shield"></i>Access &amp; invites</div>
            <div class="sn on"><span class="sn-spark">${SPARK}</span>Assistant</div>
            <div class="sn"><i class="fa-regular fa-bell"></i>Notifications</div>
            <div class="sn"><i class="fa-solid fa-box-archive"></i>Closing &amp; retention</div>
          </nav>
          <section class="st-main">
            <div class="row gap12">
              ${ai('lg')}
              <div class="grow"><div class="fw7 fs16">Assistant in Discovery</div><div class="fs12.5 secondary">One assistant for the whole firm. Here you tell it about this engagement.</div></div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">What it should know here</span><span class="fs12 muted" style="margin-left:auto">Last edited by Ada · Sep 19</span></div>
              <div class="card-b">
                <div class="textarea instr">Northwind calls distribution centers “DCs” and the Dayton plant “Plant 1”.<br>Never estimate vendor pricing — say it’s still being set.<br>For dates, use the milestones in the statement of work.<br>Keep answers short — Casey prefers bullet points.</div>
                <div class="inherit">
                  <div class="row gap8 fs12"><i class="fa-solid fa-sitemap muted"></i><span class="fw6 secondary">Also applies, from Northwind</span><span class="link fs12" style="margin-left:auto">Edit in Northwind</span></div>
                  <div class="inh-l">Northwind’s fiscal year ends June 30.</div>
                  <div class="inh-l">Casey Morgan is the client sponsor; Lena Fischer signs off on spend.</div>
                </div>
                <div class="hint" style="margin-top:10px"><i class="fa-solid fa-circle-info"></i>&nbsp; Northwind can’t read these notes, but answers in their chats follow them.</div>
              </div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">What it can do here</span></div>
              <div class="skills">
                ${skill(true, 'fa-comment-dots', 'Answer questions', 'In any chat, from what everyone there can open, with sources', '<span class="chip plain" style="margin-left:8px;height:18px;font-size:10.5px">Always on</span>')}
                ${skill(true, 'fa-newspaper', 'Weekly digest', 'Mondays 8 AM for staff; Northwind gets a Shared-only version')}
                ${skill(true, 'fa-user-secret', 'Review before sharing', 'Checks names, prices and internal notes before anything is shared')}
                ${skill(true, 'fa-list-check', 'Find &amp; act', 'Creates tasks and drafts replies for staff. Asks before it acts.')}
              </div>
            </div>
          </section>
          <aside class="st-side">
            <div class="card try">
              <div class="row gap8"><i class="fa-solid fa-flask" style="color:var(--mj-brand-primary)"></i><span class="fw7 fs14">Try it: who’s in the chat?</span></div>
              <div class="pick">
                <span class="pk">Just me</span><span class="pk">Meridian team</span><span class="pk on">${av('ada', 'xs')}${av('casey', 'xs')}Ada + Casey</span><span class="pk">Everyone</span>
              </div>
              <div class="res">
                <div class="res-row">${shared()}<span class="grow fs12.5">9 items</span><span class="ok"><i class="fa-solid fa-check"></i>Can use</span></div>
                <div class="res-row">${team()}<span class="grow fs12.5">15 items</span><span class="no"><i class="fa-solid fa-xmark"></i>Casey can’t open these</span></div>
              </div>
              <div class="sim">
                <div class="sim-q">${av('casey', 'xs')}<span>How are the vendors weighted?</span></div>
                <div class="sim-a">${ai('sm')}<div><div class="fs12.5">The weighting is still being set and will be confirmed at the readout on Oct 9. The six criteria are on page 13 of the readout draft.</div><div class="fs11 muted" style="margin-top:6px"><i class="fa-solid fa-shield-halved"></i>&nbsp; Used 1 Shared item · followed “never estimate vendor pricing”</div></div></div>
              </div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">When someone asks from Northwind</span></div>
              <div class="opts">
                ${opt(true, 'Include Discovery', 'Its material can come up, for those allowed')}
                ${opt(false, 'Only when asking inside Discovery', 'Northwind-wide questions won’t reach it')}
                ${opt(false, 'Never search Discovery', 'Chats still work; it won’t read this space')}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  </div>`;
  const css = sharedCss + `
  .st { display: grid; grid-template-columns: 196px minmax(0, 1fr) 356px; gap: 18px; padding: 16px 28px 16px 20px; min-height: 0; }
  .st-nav { display: flex; flex-direction: column; gap: 2px; }
  /* The settings sub-nav is mj-left-nav; these rules mirror its item styles. */
  .sn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 2px; border-radius: 8px; font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--mj-text-secondary); }
  .sn i { width: 18px; text-align: center; font-size: 13px; color: inherit; }
  .sn.on { background: color-mix(in srgb, var(--mj-brand-primary) 10%, transparent); color: var(--mj-brand-primary); }
  .sn-spark { width: 18px; display: inline-grid; place-items: center; color: inherit; }
  .sn-spark svg { width: 13px; height: 13px; }
  .st-main, .st-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .instr { font-size: 13px; line-height: 1.6; }
  .inherit { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: var(--mj-bg-surface-card); border: 1px dashed var(--mj-border-strong); }
  .inh-l { font-size: 12.5px; color: var(--mj-text-secondary); margin-top: 6px; padding-left: 22px; position: relative; }
  .inh-l::before { content: ''; position: absolute; left: 7px; top: 8px; width: 5px; height: 5px; border-radius: 9px; background: var(--mj-text-disabled); }
  .skills { padding: 0 16px 8px; }
  .skill { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle); }
  .skill:first-child { border-top: 0; padding-top: 2px; }
  .sk-ic { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: color-mix(in srgb, var(--mj-brand-primary) 9%, var(--mj-bg-surface)); color: var(--mj-brand-primary); font-size: 13px; flex: none; }
  .try { padding: 16px; }
  .pick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .pk { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 99px; border: 1px solid var(--mj-border-default); font-size: 12px; font-weight: 600; color: var(--mj-text-secondary); }
  .pk.on { border-color: var(--mjc-shared-strong); background: var(--mjc-shared-bg); color: var(--mjc-shared); padding-left: 5px; }
  .pk .av { box-shadow: none !important; }
  .res { margin-top: 12px; border: 1px solid var(--mj-border-default); border-radius: 10px; overflow: hidden; }
  .res-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; }
  .res-row + .res-row { border-top: 1px solid var(--mj-border-subtle); }
  .res .ok { font-size: 12px; font-weight: 650; color: var(--mjc-shared); }
  .res .no { font-size: 12px; font-weight: 600; color: var(--mj-text-muted); }
  .res i { margin-right: 4px; }
  .sim { margin-top: 12px; padding: 12px; border-radius: 10px; background: var(--mj-bg-surface-sunken); display: flex; flex-direction: column; gap: 10px; }
  .sim-q { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; }
  .sim-a { display: flex; gap: 8px; align-items: flex-start; }
  .opts { padding: 0 16px 14px; display: flex; flex-direction: column; gap: 8px; }
  .opt { display: flex; gap: 10px; align-items: flex-start; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--mj-border-default); }
  .opt .radio { margin-top: 2px; }
  .opt.on { border-color: var(--mj-brand-primary); background: color-mix(in srgb, var(--mj-brand-primary) 5%, var(--mj-bg-surface)); }
  `;
  return page({ title: 'Discovery — Assistant settings', css, body });
}

/* ============================== 10 WORK BOARD (tasks from bizapps-tasks) ============================== */
export function workBoard() {
  const card = ({ t, band, who, due, dueCls = '', extra = '', origin = '', dim = false }) => `
    <div class="kcard ${dim ? 'dim' : ''}">
      ${origin}
      <div class="t">${t}</div>
      ${extra}
      <div class="m">${band}<span class="grow"></span>${due ? `<span class="due ${dueCls}"><i class="fa-regular fa-calendar"></i>${due}</span>` : ''}${who.map((k) => av(k, 'xs')).join('')}</div>
    </div>`;
  const b = { s: '<span class="band bs"><i class="fa-solid fa-eye"></i>Shared</span>', t: '<span class="band bt"><i class="fa-solid fa-lock"></i>Team</span>' };
  const col = (title, n, icon, cards, cls = '') => `<div class="kcol ${cls}"><div class="kcol-h">${icon}${title}<span class="n">${n}</span><i class="fa-solid fa-plus muted" style="margin-left:auto;font-size:12px"></i></div>${cards}</div>`;
  const body = `
  <div class="shell">
    ${topbar()}
    <div class="body">
      ${navStaff('discovery')}
      <main class="main">
        ${spaceHeader({ tabs: discoveryTabs, activeTab: 'Work', audience: audienceChip(), actions: `<span class="btn primary"><i class="fa-solid fa-plus"></i>New task</span>` })}
        <div class="wb">
          <div class="wb-tools">
            <span class="seg"><span class="on"><i class="fa-solid fa-table-columns"></i>Board</span><span><i class="fa-solid fa-list"></i>List</span><span><i class="fa-solid fa-timeline"></i>Timeline</span></span>
            <span class="fchip on">Everyone’s</span><span class="fchip">Mine</span><span class="fchip">Northwind’s</span>
            <span class="wb-note"><i class="fa-solid fa-eye"></i>Northwind sees 5 of these 10 open tasks — the Shared ones</span>
          </div>
          <div class="board">
            ${col('To do', 4, '<i class="fa-regular fa-circle muted"></i>',
              card({ t: 'Send the scoring criteria to Lena', band: b.s, who: ['ada'], due: 'Oct 1', origin: `<div class="origin">${SPARK}Suggested from Discovery room</div>` })
              + card({ t: 'Book Dayton site visit #2', band: b.s, who: ['bea'], due: 'Oct 3' })
              + card({ t: 'Prep Q&amp;A for the readout', band: b.t, who: ['sam'], due: 'Oct 8' })
              + card({ t: 'Draft the close-out memo', band: b.t, who: ['priya'], due: 'Oct 14' }))}
            ${col('In progress', 3, '<i class="fa-solid fa-circle-half-stroke" style="color:var(--mj-brand-primary)"></i>',
              card({ t: 'Readout storyline', band: b.t, who: ['ada'], due: 'Oct 6', extra: '<div class="sub"><div class="progress"><span style="width:60%"></span></div><span>3 of 5</span></div>' })
              + card({ t: 'Anonymize the interview synthesis', band: b.t, who: ['sam'], due: 'Sep 29', extra: `<div class="att">${fileIcon('doc', 'sm')}<span class="ellipsis">Interview synthesis v3</span><span class="chip warn" style="height:18px;font-size:10.5px"><i class="fa-solid fa-triangle-exclamation"></i>2</span></div>` })
              + card({ t: 'Vendor scoring model v2', band: b.t, who: ['priya'], due: 'Oct 2' }))}
            ${col('Waiting on Northwind', 3, '<i class="fa-solid fa-hourglass-half" style="color:var(--mjc-shared-strong)"></i>',
              card({ t: 'Q2 inventory extract', band: b.s, who: ['bea'], due: 'Sep 24', dueCls: 'late', extra: '<div class="late-note"><i class="fa-solid fa-circle-exclamation"></i>2 days late · Assistant can nudge Bea</div>' })
              + card({ t: 'Answer Dayton scheduling questions', band: b.s, who: ['casey'], due: 'Oct 3' })
              + card({ t: 'Review the readout draft', band: b.s, who: ['casey', 'lena'], due: 'Oct 7' }), 'waiting')}
            ${col('Done', 12, '<i class="fa-solid fa-circle-check" style="color:var(--mj-status-success)"></i>',
              card({ t: '18 interviews completed', band: b.t, who: ['sam', 'priya'], due: '', dim: true })
              + card({ t: 'Interview guide approved', band: b.s, who: ['casey'], due: '', dim: true })
              + card({ t: 'Current-state process map', band: b.s, who: ['ada'], due: '', dim: true })
              + '<div class="more-done">+ 9 more</div>')}
          </div>
        </div>
      </main>
    </div>
  </div>`;
  const css = sharedCss + `
  .wb { padding: 14px 28px 16px; display: flex; flex-direction: column; gap: 12px; min-height: 0; flex: 1; }
  .wb-tools { display: flex; align-items: center; gap: 8px; }
  .seg span i { font-size: 11px; }
  /* Filter chips mirror mj-filter-chip. */
  .fchip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 16px; border: 1px solid var(--mj-border-default); font-size: 12px; font-weight: 500; line-height: 1.4; color: var(--mj-text-secondary); background: var(--mj-bg-surface-card); white-space: nowrap; }
  .fchip.on { background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface)); border-color: color-mix(in srgb, var(--mj-brand-primary) 35%, var(--mj-border-default)); color: var(--mj-brand-primary); }
  .wb-note { margin-left: auto; font-size: 12px; color: var(--mjc-shared); display: flex; align-items: center; gap: 7px; font-weight: 550; }
  .board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; flex: 1; min-height: 0; }
  .kcol-h i { font-size: 13px; margin-right: 2px; }
  .kcol.waiting { background: color-mix(in srgb, var(--mjc-shared-bg) 60%, var(--mj-bg-surface-card)); border-color: var(--mjc-shared-border); }
  .kcard.dim { opacity: .62; }
  .kcard.dim .t { text-decoration: line-through; text-decoration-color: var(--mj-text-disabled); }
  .origin { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: var(--mj-brand-primary); margin-bottom: 6px; }
  .origin svg { width: 11px; height: 11px; }
  .band { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 650; padding: 1px 6px; border-radius: 5px; }
  .band i { font-size: 9px; }
  .band.bs { color: var(--mjc-shared); background: var(--mjc-shared-bg); }
  .band.bt { color: var(--mjc-team); background: var(--mjc-team-bg); }
  .due { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--mj-text-muted); margin-right: 4px; }
  .due.late { color: var(--mj-status-error-text); font-weight: 650; }
  .sub { display: flex; align-items: center; gap: 8px; margin-top: 9px; font-size: 11px; color: var(--mj-text-muted); }
  .sub .progress { flex: 1; }
  .att { display: flex; align-items: center; gap: 7px; margin-top: 9px; font-size: 12px; color: var(--mj-text-secondary); padding: 5px 7px; border-radius: 7px; background: var(--mj-bg-surface-card); border: 1px solid var(--mj-border-subtle); }
  .late-note { margin-top: 8px; font-size: 11.5px; color: var(--mj-status-error-text); display: flex; align-items: center; gap: 6px; }
  .more-done { font-size: 12px; font-weight: 600; color: var(--mj-text-muted); text-align: center; padding: 6px; }
  `;
  return page({ title: 'Discovery — Work', css, body });
}

/* ============================== 11 TEAM CHAT, DARK ============================== */
export function chatDark() {
  const body = `
  <div class="shell">
    ${topbar()}
    <div class="body">
      ${navStaff('discovery')}
      <main class="main">
        ${spaceHeader({ tabs: discoveryTabs, activeTab: 'Chat', audience: audienceChip(), actions: `<span class="btn"><i class="fa-solid fa-user-plus"></i>Invite</span><span class="btn primary"><i class="fa-solid fa-plus"></i>New</span>` })}
        <div class="chat-wrap">
          ${chatList('team')}
          <section class="convo">
            <div class="convo-h">
              <i class="fa-solid fa-lock muted"></i><span class="ttl">Meridian team</span>
              <span class="chip team">Meridian only · 3</span>
              <span style="margin-left:auto" class="row gap4 muted"><span class="btn sm ghost icon"><i class="fa-solid fa-magnifying-glass"></i></span><span class="btn sm ghost icon"><i class="fa-solid fa-thumbtack"></i></span><span class="btn sm ghost icon"><i class="fa-solid fa-ellipsis"></i></span></span>
            </div>
            <div class="lens team"><span class="li"><i class="fa-solid fa-lock"></i></span><span><b>Only Meridian staff are here.</b> The Assistant can use Team and Shared material.</span></div>
            <div class="msgs">
              <div class="msg">${av('priya', 'md')}<div class="body-col"><div class="mh"><span class="who">Priya Shah</span><span class="time">9:30 AM</span></div>
                <div class="text">Scoring model v2 is up. Kestrel’s integration score dropped after the ERP call.</div></div></div>
              <div class="msg">${av('ada', 'md')}<div class="body-col"><div class="mh"><span class="who">Ada Lovell</span><span class="time">9:58 AM</span></div>
                <div class="text"><span class="mention">@Assistant</span> Lena wants the scoring criteria before Thursday. What can we safely share, and what should stay internal?</div></div></div>
              <div class="msg">${ai('md')}<div class="body-col"><div class="mh"><span class="who">Assistant</span><span class="ai-tag">AI</span><span class="time">9:58 AM</span></div>
                <div class="text">
                  <div class="split">
                    <div class="sp s"><div class="sp-h"><i class="fa-solid fa-eye"></i>Already shared — safe to send</div><div class="fs12.5">The six criteria and their definitions.</div><span class="cite shared"><i class="fa-solid fa-file-pdf"></i>Readout draft · p.13</span></div>
                    <div class="sp t"><div class="sp-h"><i class="fa-solid fa-lock"></i>Still internal</div><div class="fs12.5">The weights, and Kestrel’s revised score from v2.</div><span class="cite"><i class="fa-solid fa-file-excel"></i>Scoring model v2</span></div>
                  </div>
                  <p style="margin-top:10px">I can draft a note to Lena with just the criteria, and add a task to share the weights after the readout.</p>
                  <div class="row gap8" style="margin-top:4px"><span class="btn sm"><i class="fa-regular fa-envelope"></i>Draft note to Lena</span><span class="btn sm"><i class="fa-solid fa-list-check"></i>Create the task</span></div>
                  <div class="receipt"><i class="fa-solid fa-shield-halved"></i><span>Used <b>1 Team</b> and <b>1 Shared</b> item · this chat is Meridian only</span></div>
                </div>
              </div></div>
              <div class="msg">${av('sam', 'md')}<div class="body-col"><div class="mh"><span class="who">Sam Okafor</span><span class="time">10:01 AM</span></div>
                <div class="text">Agreed — let’s hold the weights until the readout.</div></div></div>
            </div>
            <div class="composer">
              <div class="ph">Message Meridian team</div>
              <div class="tools"><span class="t"><i class="fa-solid fa-paperclip"></i></span><span class="t"><i class="fa-solid fa-at"></i></span><span class="t"><i class="fa-regular fa-face-smile"></i></span><span class="asst">${SPARK}Ask the Assistant</span><span class="aud-line team"><i class="fa-solid fa-lock"></i>Only the 3 Meridian staff here will see this</span><span class="send" style="margin-left:12px"><i class="fa-solid fa-arrow-up"></i></span></div>
            </div>
          </section>
          <aside class="details">
            <div>
              <div class="det-h">Meridian Advisory <span class="n">3</span></div>
              <div class="ppl">${avp('ada', 'md')}${av('sam', 'md')}${avp('priya', 'md')}</div>
            </div>
            <div class="reach">
              <div class="row gap8">${ai('sm')}<span class="fw7 fs13">What it can use here</span></div>
              <div class="reach-row">${team('Team')}<span class="grow secondary">15 items</span><span class="fw6" style="color:var(--mj-status-success)"><i class="fa-solid fa-check"></i> Yes</span></div>
              <div class="reach-bar" style="background:var(--mj-text-disabled)"></div>
              <div class="reach-row">${shared('Shared')}<span class="grow secondary">9 items</span><span class="fw6" style="color:var(--mj-status-success)"><i class="fa-solid fa-check"></i> Yes</span></div>
              <div class="reach-bar s"></div>
              <div class="reach-note">Everyone here is Meridian staff, so Team material is in play. Nothing said here reaches Northwind unless someone shares it.</div>
            </div>
            <div>
              <div class="det-h">Pinned</div>
              <div class="pin">${fileIcon('xls', 'sm')}<div class="grow"><div class="fw6 fs12.5 ellipsis">Vendor scoring model v2</div><div class="fs11 muted">Team · Priya</div></div></div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  </div>`;
  const css = sharedCss + chatCss + `
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
  .sp { border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .sp.s { background: var(--mjc-shared-bg); border: 1px solid var(--mjc-shared-border); }
  .sp.t { background: var(--mjc-team-bg); border: 1px solid var(--mjc-team-border); }
  .sp-h { font-size: 11.5px; font-weight: 700; display: flex; gap: 6px; align-items: center; letter-spacing: .01em; }
  .sp.s .sp-h { color: var(--mjc-shared); }
  .sp.t .sp-h { color: var(--mjc-team); }
  .sp .cite { margin-top: 2px; }
  `;
  return page({ title: 'Meridian team — dark', theme: 'dark', css, body });
}

/* ============================== 12 MOBILE (Bea) ============================== */
export function mobileClient() {
  const status = `<div class="sb"><b>9:41</b><span class="island"></span><span class="sb-r"><i class="fa-solid fa-signal"></i><i class="fa-solid fa-wifi"></i><i class="fa-solid fa-battery-three-quarters"></i></span></div>`;
  const tabbar = (on) => `<div class="tb">${[['home', 'fa-house', 'Home'], ['inbox', 'fa-inbox', 'Inbox'], ['chat', 'fa-comments', 'Chats'], ['tasks', 'fa-list-check', 'Tasks']].map(([k, ic, l]) => `<span class="${on === k ? 'on' : ''}"><i class="fa-solid ${ic}"></i>${l}</span>`).join('')}</div>`;
  const phone1 = `
    <div class="phone"><div class="scr">
      ${status}
      <div class="m-top"><span class="firm-mark" style="width:28px;height:28px;font-size:12px">M</span><span class="fw7 fs15">Meridian × Northwind</span><span class="m-av">${av('bea', 'sm')}</span></div>
      <div class="m-body">
        <div class="fs12 muted fw6">Good afternoon, Bea</div>
        <div class="m-h1">One thing is late</div>
        <div class="m-card late">
          <div class="row gap10">${fileIcon('xls')}<div class="grow"><div class="fw7 fs14">Q2 inventory extract</div><div class="fs12" style="color:var(--mj-status-error-text);font-weight:600">2 days late · Priya is waiting</div></div></div>
          <div class="m-btn primary"><i class="fa-solid fa-arrow-up-from-bracket"></i>Upload the file</div>
        </div>
        <div class="m-sec">Discovery</div>
        <div class="m-row">${ai('sm')}<div class="grow"><div class="fw6 fs13">The Assistant answered Casey</div><div class="fs12 muted ellipsis">Three vendors remain after the second…</div></div><span class="m-dot"></span></div>
        <div class="m-row">${av('ada', 'sm')}<div class="grow"><div class="fw6 fs13">Ada shared a file</div><div class="fs12 muted ellipsis">Interview synthesis v3</div></div><span class="m-dot"></span></div>
        <div class="m-row">${tile('eng', 'fa-compass')}<div class="grow"><div class="fw6 fs13">Readout · Thu, Oct 9</div><div class="fs12 muted">2:00 PM · with Northwind leadership</div></div></div>
      </div>
      ${tabbar('home')}
    </div></div>`;
  const phone2 = `
    <div class="phone"><div class="scr dimmed">
      ${status}
      <div class="m-top"><span class="fw7 fs15">Discovery</span></div>
      <div class="sheet">
        <div class="grab"></div>
        <div class="fw7" style="font-size:17px">Upload to Discovery</div>
        <div class="m-file">${fileIcon('xls')}<div class="grow"><div class="fw6 fs13 ellipsis">Q2_inventory_extract.xlsx</div><div class="fs12 muted">2.4 MB · from Files</div></div><i class="fa-solid fa-circle-check" style="color:var(--mj-status-success)"></i></div>
        <div class="m-lab">Who will see it</div>
        <div class="m-aud"><span class="stack">${av('ada', 'xs')}${av('sam', 'xs')}${av('priya', 'xs')}</span><span class="stack">${av('casey', 'xs')}${av('lena', 'xs')}</span><div class="grow"><div class="fw6 fs13" style="color:var(--mjc-shared)">Meridian and Northwind</div><div class="fs12 muted">9 people · Shared</div></div></div>
        <div class="m-lab">This completes</div>
        <div class="m-task"><span class="check on"><i class="fa-solid fa-check"></i></span><span class="fs13 fw6">Q2 inventory extract</span><span class="fs12 muted" style="margin-left:auto">task</span></div>
        <div class="m-lab">Add a note</div>
        <div class="m-note">Sorry for the delay — Dayton’s numbers were late.</div>
        <div class="m-btn primary" style="margin-top:14px">Upload and notify Priya</div>
      </div>
    </div></div>`;
  const phone3 = `
    <div class="phone"><div class="scr">
      ${status}
      <div class="m-top"><i class="fa-solid fa-chevron-left" style="color:var(--mj-brand-primary)"></i><div class="grow" style="text-align:center"><div class="fw7 fs14">Discovery room</div><div class="fs11" style="color:var(--mjc-shared)"><i class="fa-solid fa-eye"></i> Everyone · 9</div></div><i class="fa-solid fa-circle-info muted"></i></div>
      <div class="m-chat">
        <div class="mm-msg">${av('casey', 'sm')}<div><div class="fs12"><b>Casey Morgan</b> <span class="muted">9:41</span></div><div class="fs13">Before Thursday — can someone summarize where vendor scoring landed?</div></div></div>
        <div class="mm-msg">${ai('sm')}<div><div class="fs12"><b>Assistant</b> <span class="muted">9:44</span></div><div class="fs13">Three vendors remain: <b>Kestrel</b>, <b>Lumen WMS</b> and <b>Haulbridge</b>. Kestrel leads on ERP fit; Lumen WMS on cost.</div>
          <div class="row gap6" style="margin-top:6px;flex-wrap:wrap"><span class="cite shared"><i class="fa-solid fa-file-pdf"></i>Readout · p.12</span><span class="cite shared"><i class="fa-solid fa-file-pdf"></i>p.14</span></div>
          <div class="fs11 muted" style="margin-top:6px"><i class="fa-solid fa-shield-halved"></i> From 3 shared files</div></div></div>
        <div class="mm-msg">${av('lena', 'sm')}<div><div class="fs12"><b>Lena Fischer</b> <span class="muted">9:52</span></div><div class="fs13">Thanks — this is what I needed.</div></div></div>
      </div>
      <div class="m-comp"><i class="fa-solid fa-plus muted"></i><span class="grow muted fs13">Message Discovery room</span><span class="m-send"><i class="fa-solid fa-arrow-up"></i></span></div>
      <div class="m-comp-note"><i class="fa-solid fa-eye"></i>9 people will see this, 3 at Meridian</div>
    </div></div>`;
  const body = `
  <div class="stage">
    <div class="stage-h">
      <div class="eyebrow" style="color:var(--mjc-shared)">Outside participants, on the phone</div>
      <div class="fw7" style="font-size:24px;letter-spacing:-.01em;margin-top:4px">Bea at Northwind: the late file, uploaded from the plant floor</div>
    </div>
    <div class="phones">
      <div class="pcol">${phone1}<div class="cap"><b>1</b>What’s late comes first</div></div>
      <div class="pcol">${phone2}<div class="cap"><b>2</b>Uploading says exactly who will see it</div></div>
      <div class="pcol">${phone3}<div class="cap"><b>3</b>The same room, the same answers</div></div>
    </div>
  </div>`;
  const css = sharedCss + `
  body { background: radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--mj-brand-tertiary) 14%, var(--mj-bg-page)), var(--mj-bg-page)); }
  .stage { height: 900px; padding: 30px 40px 0; display: flex; flex-direction: column; align-items: center; }
  .stage-h { text-align: center; }
  .phones { display: flex; gap: 56px; margin-top: 22px; }
  .pcol { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  /* Device frame: an illustration of a phone, not UI, so its colors are not tokens. */
  .phone { width: 318px; height: 664px; border-radius: 48px; padding: 10px; background: #0b1220; box-shadow: 0 30px 60px -20px rgba(15, 23, 42, .45), 0 0 0 1.5px #334155 inset; }
  .scr { position: relative; width: 100%; height: 100%; border-radius: 39px; overflow: hidden; background: var(--mj-bg-page); display: flex; flex-direction: column; }
  .sb { height: 40px; display: flex; align-items: center; padding: 0 22px 0 26px; font-size: 13px; flex: none; }
  .sb .island { width: 92px; height: 26px; border-radius: 99px; background: #0b1220; margin: 0 auto; }
  .sb-r { display: flex; gap: 5px; font-size: 11px; }
  .m-top { display: flex; align-items: center; gap: 10px; padding: 8px 16px 10px; background: var(--mj-bg-surface); border-bottom: 1px solid var(--mj-border-default); flex: none; }
  .m-av { margin-left: auto; }
  .m-body { padding: 14px 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; }
  .m-h1 { font-size: 21px; font-weight: 750; letter-spacing: -.01em; margin-bottom: 4px; }
  .m-card { background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); border-radius: 16px; padding: 14px; box-shadow: var(--mj-shadow-sm); }
  .m-card.late { border-color: color-mix(in srgb, var(--mj-status-error) 35%, var(--mj-border-default)); }
  .m-btn { margin-top: 12px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 650; font-size: 14px; border: 1px solid var(--mj-border-default); }
  .m-btn.primary { background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); border-color: var(--mj-brand-primary); }
  .m-sec { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mj-text-muted); margin-top: 10px; }
  .m-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); border-radius: 12px; }
  .m-dot { width: 8px; height: 8px; border-radius: 9px; background: var(--mj-brand-primary); }
  .tb { display: flex; justify-content: space-around; padding: 8px 8px 20px; background: var(--mj-bg-surface); border-top: 1px solid var(--mj-border-default); flex: none; }
  .tb span { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10.5px; color: var(--mj-text-muted); font-weight: 600; }
  .tb span i { font-size: 17px; }
  .tb span.on { color: var(--mj-brand-primary); }
  .scr.dimmed::after { content: ''; position: absolute; inset: 0; background: var(--mj-bg-overlay); z-index: 1; }
  .sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; background: var(--mj-bg-surface); border-radius: 22px 22px 0 0; padding: 10px 16px 24px; box-shadow: var(--mj-shadow-2xl); }
  .grab { width: 38px; height: 5px; border-radius: 9px; background: var(--mj-border-strong); margin: 0 auto 12px; }
  .m-file { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mj-border-default); }
  .m-lab { font-size: 11.5px; font-weight: 650; color: var(--mj-text-muted); margin: 14px 0 6px; }
  .m-aud { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: var(--mjc-shared-bg); border: 1px solid var(--mjc-shared-border); }
  .m-aud .stack + .stack { margin-left: -2px; }
  .m-task { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mj-border-default); }
  .m-note { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mj-border-default); font-size: 13px; color: var(--mj-text-secondary); }
  .m-chat { flex: 1; min-height: 0; padding: 12px 14px; display: flex; flex-direction: column; gap: 14px; background: var(--mj-bg-surface); }
  .mm-msg { display: flex; gap: 10px; align-items: flex-start; }
  .mm-msg b { font-weight: 650; }
  .m-comp { display: flex; align-items: center; gap: 10px; margin: 0 12px; padding: 6px 6px 6px 14px; border-radius: 22px; border: 1px solid var(--mj-border-strong); background: var(--mj-bg-surface); flex: none; }
  .m-send { width: 32px; height: 32px; border-radius: 99px; background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); display: grid; place-items: center; font-size: 13px; }
  .m-comp-note { font-size: 11px; color: var(--mjc-shared); text-align: center; padding: 6px 0 18px; flex: none; }
  .m-comp-note i { margin-right: 5px; }
  .cap { font-size: 13.5px; color: var(--mj-text-secondary); font-weight: 550; display: flex; align-items: center; gap: 8px; }
  .cap b { width: 22px; height: 22px; border-radius: 99px; display: inline-grid; place-items: center; background: var(--mj-brand-secondary); color: var(--mj-brand-on-secondary); font-size: 12px; }
  `;
  return page({ title: 'Mobile — Bea', css, body });
}

/* ============================== 13 NEW SPACE ============================== */
export function newSpace() {
  const type = (on, cls, icon, name, desc) => `<div class="ty ${on ? 'on' : ''}">${tile(cls, icon, 'lg')}<div><div class="fw7 fs13.5">${name}</div><div class="fs12 muted">${desc}</div></div>${on ? '<span class="ty-check"><i class="fa-solid fa-check"></i></span>' : ''}</div>`;
  const modal = `
  <div class="scrim"></div>
  <div class="modal" style="left:50%;top:50%;width:940px;transform:translate(-50%,-50%)">
    <div class="ns">
      <div class="ns-form">
        <div class="row gap10"><div class="grow"><div class="fw7" style="font-size:19px">New space in Northwind</div><div class="fs13 secondary">A place with its own people, files, chats and tasks.</div></div><i class="fa-solid fa-xmark muted" style="font-size:16px"></i></div>
        <div class="lab">What kind of space?</div>
        <div class="types">
          ${type(true, 'eng', 'fa-compass', 'Engagement', 'Client work with deliverables')}
          ${type(false, 'com', 'fa-landmark', 'Committee', 'Meetings, papers and votes')}
          ${type(false, 'coh', 'fa-graduation-cap', 'Cohort', 'Sessions and learners')}
          ${type(false, 'wks', 'fa-shapes', 'Workshop', 'A short working session')}
        </div>
        <div class="row gap12" style="margin-top:16px">
          <div class="grow"><div class="lab" style="margin-top:0">Name</div><div class="input focus" style="color:var(--mj-text-primary)">Dayton pilot<span class="caret"></span></div></div>
          <div style="width:220px"><div class="lab" style="margin-top:0">Closes on</div><div class="input" style="justify-content:space-between;color:var(--mj-text-primary)">Jan 30, 2027<i class="fa-regular fa-calendar fs12 muted"></i></div></div>
        </div>
        <div class="lab">Who’s in it?</div>
        <div class="who">
          <div class="wopt"><span class="radio"></span><div class="grow"><div class="fw6 fs13">Everyone in Northwind <span class="muted fw5">· 9 people</span></div><div class="fs12 muted">Northwind’s 6 see Shared material only. New Northwind people join automatically.</div></div></div>
          <div class="wopt on"><span class="radio on"></span><div class="grow"><div class="fw6 fs13">Only people I add <span class="chip team" style="margin-left:6px"><i class="fa-solid fa-lock"></i>Sealed</span></div><div class="fs12 muted">Nobody joins from Northwind unless you add them.</div>
            <div class="picked">${av('ada', 'sm')}<span class="fs12.5">Ada (you)</span>${av('sam', 'sm')}<span class="fs12.5">Sam</span>${av('omar', 'sm')}<span class="fs12.5">Omar</span><span class="add"><i class="fa-solid fa-plus"></i>Add</span></div></div></div>
        </div>
        <div class="lab">Assistant</div>
        <div class="asst-row">${ai('sm')}<span class="fs12.5 secondary grow">Starts with Northwind’s 2 notes. Add the pilot’s own after you create it.</span><span class="switch on"></span><span class="fs12 secondary">Searchable from Northwind</span></div>
      </div>
      <div class="ns-prev">
        <div class="eyebrow">Where it will live</div>
        <div class="tree">
          <div class="tn">${tile('rel', 'fa-building', 'sm')}<b>Northwind</b><span class="muted fs12">9 people</span></div>
          <div class="tn l1">${tile('eng', 'fa-compass', 'sm')}Discovery<span class="muted fs12">9</span></div>
          <div class="tn l2">${tile('eng', 'fa-clipboard', 'sm')}Field notes</div>
          <div class="tn l1">${tile('eng', 'fa-truck-fast', 'sm')}Delivery<i class="fa-solid fa-lock muted fs11"></i><span class="muted fs12">3</span></div>
          <div class="tn l1 new">${tile('eng', 'fa-flask', 'sm')}<b>Dayton pilot</b><span class="chip team" style="height:18px;font-size:10.5px"><i class="fa-solid fa-lock"></i>Sealed</span><span class="newtag">New</span></div>
          <div class="tn l1 dimt">${tile('eng', 'fa-box-archive', 'sm closed')}Closed engagements<span class="muted fs12">2</span></div>
        </div>
        <div class="eyebrow" style="margin-top:20px">What you’re creating</div>
        <div class="sum">
          <div class="sum-r"><i class="fa-solid fa-user-group"></i><span><b>3 people</b> to start — 2 Meridian, 1 Northwind</span></div>
          <div class="sum-r"><i class="fa-solid fa-lock"></i><span>Omar sees <b>Shared</b> material only, like everywhere in Northwind</span></div>
          <div class="sum-r"><i class="fa-solid fa-wand-magic-sparkles"></i><span>The Assistant brings Northwind’s notes along</span></div>
          <div class="sum-r"><i class="fa-solid fa-box-archive"></i><span>Closes <b>Jan 30, 2027</b>; answerable for 2 years after</span></div>
        </div>
      </div>
    </div>
    <div class="m-f">
      <span class="btn primary"><i class="fa-solid fa-check"></i>Create Dayton pilot</span>
      <span class="btn ghost" style="margin-left:auto">Cancel</span>
    </div>
  </div>`;
  const body = `
  <div class="shell" style="position:relative">
    ${topbar()}
    <div class="body">
      ${navStaff('northwind')}
      <main class="main">
        ${spaceHeader({ crumbs: ['Spaces', 'Northwind'], type: 'rel', icon: 'fa-building', name: 'Northwind', kind: 'Client relationship', status: '<span class="chip plain">Since 2023</span>',
          sub: 'Northwind Distribution<span class="dotsep"></span>2 open engagements<span class="dotsep"></span>2 closed',
          tabs: [['Overview', 'fa-gauge-high'], ['Spaces', 'fa-sitemap', '4'], ['Library', 'fa-folder-open', '31'], ['People', 'fa-user-group', '9'], ['Settings', 'fa-sliders']], activeTab: 'Spaces', audience: audienceChip(), actions: `<span class="btn primary"><i class="fa-solid fa-plus"></i>New space</span>` })}
      </main>
    </div>
    ${modal}
  </div>`;
  const css = sharedCss + `
  .ns { display: grid; grid-template-columns: minmax(0, 1fr) 320px; }
  .ns-form { padding: 20px 22px 18px; }
  .ns-prev { padding: 20px 20px; background: var(--mj-bg-surface-card); border-left: 1px solid var(--mj-border-default); }
  .lab { font-size: 12px; font-weight: 650; color: var(--mj-text-secondary); margin: 16px 0 7px; }
  .types { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .ty { position: relative; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mj-border-default); }
  .ty .tile.lg { width: 36px; height: 36px; font-size: 15px; border-radius: 10px; }
  .ty.on { border-color: var(--mj-brand-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mj-brand-primary) 14%, transparent); }
  .ty-check { position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 99px; background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); font-size: 9px; display: grid; place-items: center; }
  .fs13\\.5 { font-size: 13.5px; }
  .input .caret { width: 1.5px; height: 16px; background: var(--mj-brand-primary); margin-left: -6px; }
  .who { display: flex; flex-direction: column; gap: 8px; }
  .wopt { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mj-border-default); }
  .wopt .radio { margin-top: 2px; }
  .wopt.on { border-color: var(--mj-brand-primary); background: color-mix(in srgb, var(--mj-brand-primary) 4%, var(--mj-bg-surface)); }
  .picked { display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .picked .fs12\\.5 { margin-right: 6px; }
  .picked .add { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--mj-text-link); }
  .asst-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mj-border-default); }
  .tree { margin-top: 10px; background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); border-radius: 12px; padding: 8px; }
  .tn { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px; font-size: 13px; border-radius: 8px; color: var(--mj-text-secondary); }
  .tn b { color: var(--mj-text-primary); font-weight: 650; }
  .tn .muted { margin-left: auto; }
  .tn.l1 { padding-left: 24px; } .tn.l2 { padding-left: 42px; }
  .tn.new { background: color-mix(in srgb, var(--mj-brand-primary) 8%, var(--mj-bg-surface)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--mj-brand-primary) 45%, transparent); }
  .newtag { margin-left: auto; font-size: 10.5px; font-weight: 700; color: var(--mj-brand-on-primary); background: var(--mj-brand-primary); border-radius: 5px; padding: 1px 6px; }
  .tn.dimt { opacity: .6; }
  .sum { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
  .sum-r { display: flex; gap: 10px; font-size: 12.5px; color: var(--mj-text-secondary); line-height: 1.45; }
  .sum-r i { width: 16px; text-align: center; margin-top: 3px; color: var(--mj-text-muted); }
  .sum-r b { color: var(--mj-text-primary); font-weight: 650; }
  .m-f { display: flex; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--mj-border-default); background: var(--mj-bg-surface); }
  `;
  return page({ title: 'New space', css, body });
}
