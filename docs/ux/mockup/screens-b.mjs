import { SPARK, P, av, avp, stack, ai, shared, team, chip, fileIcon, tile, page, topbar, navStaff, navGuest, spaceHeader, discoveryTabs, audienceChip, sharedCss } from './lib.mjs';

/* Chat pieces shared by the light (05) and dark (11) chat screens. */
export function chatList(active, { viewer = 'ada' } = {}) {
  const item = ({ key, name, band, audience, last, when, unread = '', faces }) => `
    <div class="ch ${active === key ? 'on' : ''} ${band}">
      <div class="ch-top"><span class="ch-ic">${band === 'shared' ? '<i class="fa-solid fa-eye"></i>' : band === 'private' ? SPARK : '<i class="fa-solid fa-lock"></i>'}</span><span class="fw6 fs13 ellipsis grow">${name}</span><span class="fs11 muted">${when}</span></div>
      <div class="ch-mid"><span class="stack">${faces.map((k) => av(k, 'xs')).join('')}</span><span class="fs11 muted ellipsis">${audience}</span>${unread ? `<span class="ch-un">${unread}</span>` : ''}</div>
      <div class="fs12 secondary ellipsis ch-last">${last}</div>
    </div>`;
  const staff = viewer !== 'casey';
  return `<aside class="chats">
    <div class="row" style="padding:2px 4px 10px"><span class="h3">Chats</span><span class="btn sm icon" style="margin-left:auto"><i class="fa-solid fa-pen-to-square"></i></span></div>
    ${item({ key: 'room', name: 'Discovery room', band: 'shared', audience: 'Everyone · 9', last: '<b>Lena:</b> Thanks — this is what I needed.', when: '9:52', unread: active === 'room' ? '' : '3', faces: ['ada', 'casey', 'lena'] })}
    ${staff ? item({ key: 'team', name: 'Meridian team', band: 'team', audience: 'Meridian only · 3', last: '<b>Priya:</b> Scoring model v2 is up', when: '9:30', unread: active === 'team' ? '' : '1', faces: ['ada', 'sam', 'priya'] }) : ''}
    ${item({ key: 'prep', name: 'Readout prep', band: 'shared', audience: '4 · 2 Northwind', last: '<b>Casey:</b> Can we move it to 2:00?', when: 'Tue', faces: ['ada', 'casey', 'lena'] })}
    ${item({ key: 'dm', name: staff ? 'Casey Morgan' : 'Ada Lovell', band: 'shared', audience: '2 people', last: staff ? '<b>Casey:</b> Thanks!' : '<b>Ada:</b> Sending it now.', when: 'Mon', faces: ['ada', 'casey'] })}
    ${staff ? item({ key: 'me', name: 'You + Assistant', band: 'private', audience: 'Only you', last: 'Draft the close-out plan', when: 'Mon', faces: ['ada'] }) : ''}
    <div class="ch-foot"><i class="fa-solid fa-circle-info"></i><span>Who’s in a chat decides what the Assistant can use there.</span></div>
  </aside>`;
}

export const chatCss = `
  .chat-wrap { display: grid; grid-template-columns: 248px minmax(0, 1fr) 276px; flex: 1; min-height: 0; }
  .chats { border-right: 1px solid var(--mj-border-default); background: var(--mj-bg-surface); padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
  .ch { padding: 9px 10px 9px 12px; border-radius: 10px; border-left: 3px solid transparent; }
  .ch.on { background: var(--mj-bg-surface-sunken); }
  .ch.shared.on { border-left-color: var(--mjc-shared-strong); }
  .ch.team.on { border-left-color: var(--mj-text-muted); }
  .ch-top { display: flex; align-items: center; gap: 7px; }
  .ch-ic { width: 16px; font-size: 11px; color: var(--mj-text-muted); display: inline-grid; place-items: center; }
  .ch.shared .ch-ic { color: var(--mjc-shared-strong); }
  .ch-ic svg { width: 12px; height: 12px; color: var(--mj-brand-primary); }
  .ch-mid { display: flex; align-items: center; gap: 7px; margin: 5px 0 3px 23px; }
  .ch-last { margin-left: 23px; }
  .ch-last b { font-weight: 600; color: var(--mj-text-primary); }
  .ch-un { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--mj-brand-on-primary); background: var(--mj-brand-primary); border-radius: 99px; padding: 0 6px; }
  .ch-foot { margin-top: auto; display: flex; gap: 8px; font-size: 11.5px; color: var(--mj-text-muted); padding: 10px 6px 0; border-top: 1px solid var(--mj-border-default); line-height: 1.4; }
  .ch-foot i { margin-top: 2px; }
  .convo { border-right: 1px solid var(--mj-border-default); }
  .convo .msgs { display: flex; flex-direction: column; justify-content: flex-end; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 48px); mask-image: linear-gradient(to bottom, transparent 0, #000 48px); }
  .lens { white-space: nowrap; }
  .convo-h .ttl { font-weight: 700; font-size: 15px; }
  .lens { margin: 12px 24px 4px; }
  .lens .li { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: var(--mjc-shared-strong); color: var(--mjc-on-strong); font-size: 12px; flex: none; }
  .lens.team .li { background: var(--mjc-team-strong); }
  .lens .why { margin-left: auto; font-weight: 650; white-space: nowrap; text-decoration: underline; text-underline-offset: 3px; }
  .ai-tag { font-size: 10px; font-weight: 700; letter-spacing: .04em; color: var(--mj-brand-primary); border: 1px solid color-mix(in srgb, var(--mj-brand-primary) 30%, transparent); border-radius: 4px; padding: 0 4px; }
  .msg .text ul { padding-left: 16px; }
  .msg .text li .cite { margin-left: 4px; }
  .receipt { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 7px 10px; border-radius: 9px; font-size: 12px; background: var(--mj-bg-surface-card); border: 1px solid var(--mj-border-default); color: var(--mj-text-secondary); }
  .receipt i { color: var(--mj-text-muted); }
  .receipt b { font-weight: 650; color: var(--mj-text-primary); }
  .msg-actions { display: flex; align-items: center; gap: 2px; margin-top: 6px; color: var(--mj-text-muted); }
  .msg-actions span { width: 26px; height: 26px; display: inline-grid; place-items: center; border-radius: 6px; font-size: 12px; }
  .msg-actions .react { width: auto; margin-right: 4px; }
  .typing { display: flex; align-items: center; gap: 8px; padding: 4px 24px 8px 64px; font-size: 12px; color: var(--mj-text-muted); }
  .typing .dots { display: inline-flex; gap: 3px; }
  .typing .dots i { width: 5px; height: 5px; border-radius: 9px; background: var(--mj-text-disabled); display: block; }
  .composer .aud-line { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--mjc-shared); margin-left: auto; font-weight: 550; }
  .composer .aud-line.team { color: var(--mj-text-muted); }
  .composer .tools .asst { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 9px; border-radius: 7px; font-size: 12px; font-weight: 600; color: var(--mj-brand-primary); background: color-mix(in srgb, var(--mj-brand-primary) 8%, transparent); margin-left: 4px; }
  .composer .tools .asst svg { width: 12px; height: 12px; }
  .details { background: var(--mj-bg-surface); padding: 16px 16px; display: flex; flex-direction: column; gap: 16px; min-height: 0; overflow: hidden; }
  .det-h { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 650; color: var(--mj-text-secondary); margin-bottom: 8px; }
  .det-h .n { color: var(--mj-text-muted); font-weight: 600; }
  .ppl { display: flex; flex-wrap: wrap; gap: 6px; }
  .reach { border: 1px solid var(--mj-border-default); border-radius: 12px; padding: 12px; background: var(--mj-bg-surface-card); }
  .reach-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; }
  .reach-bar { height: 8px; border-radius: 9px; margin-top: 6px; }
  .reach-bar.s { background: var(--mjc-shared-strong); }
  .reach-bar.t { background: repeating-linear-gradient(135deg, var(--mj-border-strong) 0 4px, var(--mj-border-default) 4px 8px); }
  .reach-note { font-size: 11.5px; color: var(--mj-text-muted); margin-top: 10px; line-height: 1.45; }
  .pin { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--mj-border-default); }
`;

/* ============================== 05 CHAT ROOM (staff, client in the room) ============================== */
export function chatRoom() {
  const body = `
  <div class="shell">
    ${topbar()}
    <div class="body">
      ${navStaff('discovery')}
      <main class="main">
        ${spaceHeader({ tabs: discoveryTabs, activeTab: 'Chat', audience: audienceChip(), actions: `<span class="btn"><i class="fa-solid fa-user-plus"></i>Invite</span><span class="btn primary"><i class="fa-solid fa-plus"></i>New</span>` })}
        <div class="chat-wrap">
          ${chatList('room')}
          <section class="convo">
            <div class="convo-h">
              <i class="fa-solid fa-eye" style="color:var(--mjc-shared-strong)"></i><span class="ttl">Discovery room</span>
              <span class="chip shared">Everyone · 9</span>
              <span style="margin-left:auto" class="row gap4 muted"><span class="btn sm ghost icon"><i class="fa-solid fa-magnifying-glass"></i></span><span class="btn sm ghost icon"><i class="fa-solid fa-thumbtack"></i></span><span class="btn sm ghost icon"><i class="fa-solid fa-ellipsis"></i></span></span>
            </div>
            <div class="lens"><span class="li"><i class="fa-solid fa-eye"></i></span><span><b>Northwind is in this chat.</b> The Assistant uses only what all 9 people here can open.</span></div>
            <div class="msgs">
              <div class="day-sep">Today</div>
              <div class="msg">${av('casey', 'md')}<div class="body-col"><div class="mh"><span class="who">Casey Morgan</span><span class="org">Northwind</span><span class="time">9:41 AM</span></div>
                <div class="text">Before Thursday — can someone summarize where vendor scoring landed? Our CFO will ask.</div></div></div>
              <div class="msg">${av('ada', 'md')}<div class="body-col"><div class="mh"><span class="who">Ada Lovell</span><span class="time">9:44 AM</span></div>
                <div class="text"><span class="mention">@Assistant</span> can you pull that together from what we’ve shared so far?</div></div></div>
              <div class="msg">${ai('md')}<div class="body-col"><div class="mh"><span class="who">Assistant</span><span class="ai-tag">AI</span><span class="time">9:44 AM</span></div>
                <div class="text">
                  <p>Here’s where vendor scoring stands in the material shared with Northwind:</p>
                  <ul>
                    <li>Three vendors remain after the second screen: <b>Kestrel</b>, <b>Lumen WMS</b> and <b>Haulbridge</b>.<span class="cite shared"><i class="fa-solid fa-file-pdf"></i>Readout draft · p.12</span></li>
                    <li>Kestrel leads on fit with Northwind’s ERP; Lumen WMS has the lowest five-year cost.<span class="cite shared"><i class="fa-solid fa-file-pdf"></i>Readout draft · p.14</span></li>
                    <li>The final weighting will be confirmed at the readout on Oct 9.<span class="cite shared"><i class="fa-solid fa-file-pdf"></i>Process map</span></li>
                  </ul>
                  <div class="receipt"><i class="fa-solid fa-shield-halved"></i><span>Used <b>3 Shared items</b> · Team material wasn’t searched, because Northwind is here</span></div>
                </div>
                <div class="msg-actions"><span class="react">👍 2</span><span><i class="fa-regular fa-thumbs-up"></i></span><span><i class="fa-regular fa-thumbs-down"></i></span><span><i class="fa-regular fa-copy"></i></span><span><i class="fa-solid fa-list-check"></i></span></div>
              </div></div>
              <div class="msg">${av('lena', 'md')}<div class="body-col"><div class="mh"><span class="who">Lena Fischer</span><span class="org">Northwind</span><span class="time">9:52 AM</span></div>
                <div class="text">Thanks — this is what I needed. Could we see the scoring criteria before Thursday?</div></div></div>
              <div class="typing"><span class="dots"><i></i><i></i><i></i></span>Sam is typing…</div>
            </div>
            <div class="composer">
              <div class="ph">Message Discovery room</div>
              <div class="tools"><span class="t"><i class="fa-solid fa-paperclip"></i></span><span class="t"><i class="fa-solid fa-at"></i></span><span class="t"><i class="fa-regular fa-face-smile"></i></span><span class="asst">${SPARK}Ask the Assistant</span><span class="aud-line"><i class="fa-solid fa-eye"></i>9 people will see this, 6 at Northwind</span><span class="send" style="margin-left:12px"><i class="fa-solid fa-arrow-up"></i></span></div>
            </div>
          </section>
          <aside class="details">
            <div>
              <div class="det-h">Meridian Advisory <span class="n">3</span></div>
              <div class="ppl">${avp('ada', 'md')}${av('sam', 'md')}${avp('priya', 'md')}</div>
            </div>
            <div>
              <div class="det-h" style="color:var(--mjc-shared)">Northwind <span class="n">6</span></div>
              <div class="ppl">${avp('casey', 'md')}${av('bea', 'md')}${av('omar', 'md')}${avp('lena', 'md')}${av('mia', 'md')}${av('ravi', 'md')}</div>
            </div>
            <div class="reach">
              <div class="row gap8">${ai('sm')}<span class="fw7 fs13">What it can use here</span></div>
              <div class="reach-row">${shared('Shared')}<span class="grow secondary">9 items</span><span class="fw6" style="color:var(--mjc-shared)"><i class="fa-solid fa-check"></i> Yes</span></div>
              <div class="reach-bar s"></div>
              <div class="reach-row">${team('Team')}<span class="grow secondary">15 items</span><span class="fw6 muted"><i class="fa-solid fa-xmark"></i> Not here</span></div>
              <div class="reach-bar t"></div>
              <div class="reach-note">It only uses what <b>everyone</b> in the chat can open. If someone joins or leaves, the next answer follows the new list. Ask in <b>Meridian team</b> to include Team material.</div>
            </div>
            <div>
              <div class="det-h">Pinned</div>
              <div class="pin">${fileIcon('pdf', 'sm')}<div class="grow"><div class="fw6 fs12.5 ellipsis">Discovery readout — draft for review</div><div class="fs11 muted">Shared · v4</div></div></div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  </div>`;
  return page({ title: 'Discovery — Chat', css: sharedCss + chatCss, body });
}

/* ============================== 06 PEOPLE & ACCESS ============================== */
export function peopleAccess() {
  const row = (k, title, role, source, last, opts = {}) => `
    <div class="prow ${opts.cls || ''}">
      ${opts.cls === 'gone' ? `<span class="av md c7">${P[k].i}</span>` : (opts.online ? avp(k, 'md') : av(k, 'md'))}
      <div class="p-name"><div class="fw6 fs13 ellipsis">${P[k].n}${opts.you ? ' <span class="muted fw5">(you)</span>' : ''}</div><div class="fs12 muted ellipsis">${title}</div></div>
      <div class="p-role">${role}</div>
      <div class="p-src">${source}</div>
      <div class="p-last fs12 muted">${last}</div>
      <i class="fa-solid fa-ellipsis muted"></i>
    </div>`;
  const role = (r) => `<span class="role">${r}<i class="fa-solid fa-chevron-down"></i></span>`;
  const src = (icon, t, sub = '') => `<div class="row gap6 fs12"><i class="${icon} muted" style="width:14px;text-align:center"></i><span class="secondary">${t}</span></div>${sub ? `<div class="fs11 muted" style="margin-left:20px">${sub}</div>` : ''}`;
  const body = `
  <div class="shell">
    ${topbar()}
    <div class="body">
      ${navStaff('discovery')}
      <main class="main">
        ${spaceHeader({ tabs: discoveryTabs, activeTab: 'People', audience: audienceChip(), actions: `<span class="btn primary"><i class="fa-solid fa-user-plus"></i>Invite</span>` })}
        <div class="pa">
          <section class="pa-main">
            <div class="grp">
              <div class="grp-h"><span class="firm-mark" style="width:26px;height:26px;font-size:12px;border-radius:7px">M</span><span class="fw7 fs14">Meridian Advisory</span><span class="muted fs12">3</span>
                <span class="grp-sees">Sees ${team()} ${shared()}</span></div>
              <div class="thead"><span></span><span>Name</span><span>Role here</span><span>Access comes from</span><span>Last active</span><span></span></div>
              ${row('ada', 'Engagement lead', role('Owner'), src('fa-solid fa-user', 'Added directly'), 'Now', { you: true, online: true })}
              ${row('sam', 'Senior consultant', role('Editor'), src('fa-solid fa-user', 'Added directly'), '8 min ago')}
              ${row('priya', 'Analyst', role('Editor'), src('fa-solid fa-user', 'Added directly'), '32 min ago', { online: true })}
            </div>
            <div class="grp shared-grp">
              <div class="grp-h"><span class="nw-mark">N</span><span class="fw7 fs14">Northwind</span><span class="muted fs12">6</span>
                <span class="grp-sees">Sees ${shared()} <span class="fs12 muted">· never Team</span></span></div>
              ${row('casey', 'VP Operations · client sponsor', role('Client admin'), src('fa-solid fa-sitemap', 'From the Northwind space'), '12 min ago', { online: true })}
              ${row('lena', 'CFO', role('Viewer'), src('fa-solid fa-sitemap', 'From the Northwind space'), '9:52 AM', { online: true })}
              ${row('bea', 'Operations analyst', role('Contributor'), src('fa-solid fa-sitemap', 'From the Northwind space'), 'Yesterday')}
              ${row('omar', 'Plant director, Dayton', role('Viewer'), src('fa-solid fa-user-plus', 'Invited by Casey', 'until Oct 16'), 'Sep 22')}
              ${row('mia', 'Finance analyst', role('Contributor'), src('fa-solid fa-user-plus', 'Invited by Casey', 'until Oct 16'), 'Sep 19')}
              ${row('ravi', 'IT lead', role('Viewer'), src('fa-solid fa-sitemap', 'From the Northwind space'), 'Sep 10')}
              <div class="pending">
                ${av('jordan', 'md')}
                <div class="grow"><div class="fs13"><b>Jordan Lee</b> <span class="muted">· Procurement lead · invited by Casey 20 min ago</span></div><div class="fs12 secondary">Northwind is at its limit of 6 people. Approving raises it to 7.</div></div>
                <span class="btn sm primary">Approve</span><span class="btn sm ghost">Decline</span>
              </div>
              <div class="prow gone">
                <span class="av md c7">RC</span>
                <div class="p-name"><div class="fw6 fs13 ellipsis">Remy Chen</div><div class="fs12 muted ellipsis">Removed Sep 2 · left Northwind</div></div>
                <div class="fs12 muted" style="grid-column: 3 / 6">Can’t open anything here. Past messages stay, marked as a former member.</div>
                <span></span>
              </div>
            </div>
          </section>
          <aside class="pa-side">
            <div class="card">
              <div class="card-h"><span class="h3">Invite to Discovery</span></div>
              <div class="card-b" style="display:flex;flex-direction:column;gap:10px">
                <div class="input focus">alex.kim@northwind.com<span class="caret"></span></div>
                <div class="row gap8">
                  <div class="input grow" style="justify-content:space-between;color:var(--mj-text-primary)">Contributor <i class="fa-solid fa-chevron-down fs11 muted"></i></div>
                  <div class="input grow" style="justify-content:space-between;color:var(--mj-text-primary)">Until Oct 16 <i class="fa-regular fa-calendar fs12 muted"></i></div>
                </div>
                <div class="will-see"><i class="fa-solid fa-eye"></i><span>A Northwind address, so they’ll see <b>Shared</b> material and the chats they’re added to. Never Team.</span></div>
                <span class="btn primary" style="width:100%">Send invite</span>
              </div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">How Northwind joins</span></div>
              <div class="rules">
                <div class="rule"><span class="switch on"></span><div><div class="fw6 fs13">Everyone in the Northwind space</div><div class="fs12 muted">People added there appear here too. Turn off to make Discovery sealed.</div></div></div>
                <div class="rule"><span class="switch on"></span><div><div class="fw6 fs13">Casey can invite colleagues</div><div class="fs12 muted">Only @northwind.com, never above Contributor. Up to 6 people; beyond that, you approve.</div></div></div>
                <div class="rule"><span class="switch on"></span><div><div class="fw6 fs13">Access ends when Discovery closes</div><div class="fs12 muted">Oct 16. Shared files stay answerable for 2 years, then are removed.</div></div></div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  </div>`;
  const css = sharedCss + `
  .pa { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; padding: 14px 28px; min-height: 0; }
  .pa-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .grp { background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); border-radius: 12px; box-shadow: var(--mj-shadow-sm); overflow: hidden; }
  .shared-grp { border-color: var(--mjc-shared-border); }
  .grp-h { display: flex; align-items: center; gap: 9px; padding: 10px 14px; border-bottom: 1px solid var(--mj-border-subtle); }
  .shared-grp .grp-h { background: linear-gradient(90deg, var(--mjc-shared-bg), var(--mj-bg-surface)); border-bottom-color: var(--mjc-shared-border); }
  .grp-sees { margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--mj-text-muted); }
  .nw-mark { width: 26px; height: 26px; border-radius: 7px; display: inline-grid; place-items: center; font-weight: 800; font-size: 12px; color: var(--mj-brand-on-primary); background: linear-gradient(135deg, #0f766e, #14b8a6); } /* stands in for the organization's own logo (data) */
  .thead, .prow { display: grid; grid-template-columns: 32px minmax(0, 1.3fr) 130px minmax(0, 1.2fr) 100px 16px; gap: 12px; align-items: center; padding: 0 14px; }
  .thead { font-size: 11.5px; font-weight: 600; color: var(--mj-text-muted); padding-top: 8px; padding-bottom: 4px; }
  .prow { padding-top: 4px; padding-bottom: 4px; border-top: 1px solid var(--mj-border-subtle); }
  .thead + .prow { border-top: 0; }
  .grp-h + .prow { border-top: 0; }
  /* Role pickers mirror mj-dropdown (ui-components dropdown.scss). */
  .role { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 38px; padding: 8px 12px; font-size: var(--mj-text-sm); color: var(--mj-text-primary); background: var(--mj-bg-surface); border-radius: var(--mj-radius-sm); border: 1px solid var(--mj-border-default); }
  .role i { font-size: 0.75rem; color: var(--mj-text-muted); }
  .pending { display: flex; align-items: center; gap: 12px; padding: 7px 14px; border-top: 1px solid var(--mjc-shared-border); background: color-mix(in srgb, var(--mj-status-warning) 7%, var(--mj-bg-surface)); }
  .prow.gone { opacity: .75; }
  .prow.gone .p-name .fw6 { text-decoration: line-through; color: var(--mj-text-muted); }
  .pa-side { display: flex; flex-direction: column; gap: 14px; }
  .input .caret { width: 1.5px; height: 16px; background: var(--mj-brand-primary); margin-left: -6px; }
  .will-see { display: flex; gap: 8px; font-size: 12px; color: var(--mjc-shared); background: var(--mjc-shared-bg); border: 1px solid var(--mjc-shared-border); padding: 8px 10px; border-radius: 9px; line-height: 1.45; }
  .will-see i { margin-top: 2px; }
  .will-see b { font-weight: 700; }
  .rules { padding: 0 16px 14px; display: flex; flex-direction: column; gap: 12px; }
  .rule { display: flex; gap: 12px; align-items: flex-start; }
  .rule .switch { margin-top: 2px; }
  `;
  return page({ title: 'Discovery — People', css, body });
}

/* ============================== 07 CLIENT HOME (Casey) ============================== */
export function clientHome() {
  const waiting = (icon, title, meta, btn, due) => `
    <div class="wrow"><span class="wic">${icon}</span><div class="grow"><div class="fw6 fs13.5">${title}</div><div class="fs12 muted">${meta}</div></div><span class="due">${due}</span>${btn}</div>`;
  const news = (lead, html, when) => `<div class="nrow">${lead}<div class="grow fs13 secondary">${html}</div><span class="fs12 muted">${when}</span></div>`;
  const body = `
  <div class="shell">
    ${topbar({ user: 'casey' })}
    <div class="body">
      ${navGuest({ active: 'home', who: 'casey' })}
      <main class="main"><div class="page ch-home">
        <div class="row" style="align-items:flex-end;margin-bottom:16px">
          <div>
            <div class="eyebrow">Meridian Advisory × Northwind</div>
            <h1 class="h1" style="font-size:27px;margin-top:4px">Good afternoon, Casey</h1>
            <div class="secondary" style="margin-top:3px">Two things are waiting on you. The readout is a week from Thursday.</div>
          </div>
        </div>

        <div class="card hero">
          <div class="row gap12">
            ${tile('eng', 'fa-compass', 'lg')}
            <div class="grow"><div class="fw7 fs16">Discovery</div><div class="fs12.5 secondary">Supply-chain operating model diagnostic · Week 7 of 10</div></div>
            <div class="next"><div class="fs11 fw6 eyebrow" style="color:var(--mj-brand-primary)">Your next step</div><div class="fw6 fs13">Review the readout draft by Tue, Oct 7</div></div>
            <span class="btn primary"><i class="fa-solid fa-book-open"></i>Open the draft</span>
          </div>
          <div class="miles">
            <div class="mile done"><span class="dot"><i class="fa-solid fa-check"></i></span><div><div class="fw6 fs12">Kickoff</div><div class="fs11 muted">Aug 11</div></div></div>
            <div class="bar done"></div>
            <div class="mile done"><span class="dot"><i class="fa-solid fa-check"></i></span><div><div class="fw6 fs12">18 interviews</div><div class="fs11 muted">Sep 12</div></div></div>
            <div class="bar half"></div>
            <div class="mile now"><span class="dot"></span><div><div class="fw6 fs12">Findings</div><div class="fs11 muted">This week</div></div></div>
            <div class="bar"></div>
            <div class="mile"><span class="dot"></span><div><div class="fw6 fs12">Readout</div><div class="fs11 muted">Thu, Oct 9 · 2:00 PM</div></div></div>
            <div class="bar"></div>
            <div class="mile"><span class="dot"></span><div><div class="fw6 fs12">Close-out</div><div class="fs11 muted">Oct 16</div></div></div>
          </div>
        </div>

        <div class="cgrid">
          <div class="col">
            <div class="card">
              <div class="card-h"><span class="h3">Waiting on you</span><span class="count-pill">2</span></div>
              <div class="wrows">
                ${waiting(fileIcon('pdf', 'sm'), 'Review the readout draft', 'Ada Lovell asked · 34 pages · comments go straight to Meridian', '<span class="btn sm primary">Open</span>', 'Tue, Oct 7')}
                ${waiting(`<span class="fi sm" style="color:var(--mj-brand-primary)"><i class="fa-solid fa-circle-question"></i></span>`, 'Answer 3 questions about Dayton scheduling', 'Sam Okafor asked · about 5 minutes', '<span class="btn sm">Answer</span>', 'Fri, Oct 3')}
              </div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">New since Tuesday</span><span class="link">See all</span></div>
              <div class="nrows">
                ${news(av('ada', 'sm'), '<b>Ada</b> shared <b>Interview synthesis v3</b> with you — “we’ll walk through it Thursday”', '1h')}
                ${news(ai('sm'), 'The <b>Assistant</b> answered your question about vendor scoring in <b>Discovery room</b>', '9:44')}
                ${news(av('sam', 'sm'), '<b>Sam</b> replied in <b>Readout prep</b>: “2:00 works for us”', 'Tue')}
                ${news(av('bea', 'sm'), '<b>Bea</b> (your team) uploaded <b>Q2 inventory extract</b>', 'Mon')}
              </div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">Shared with you</span><span class="fs12 muted">9 items</span><span class="link">Open library</span></div>
              <div class="sw">
                <div class="swi">${fileIcon('pdf')}<div class="grow"><div class="fw6 fs13 ellipsis">Discovery readout — draft</div><div class="fs12 muted">v4 · Sep 24</div></div></div>
                <div class="swi">${fileIcon('doc')}<div class="grow"><div class="fw6 fs13 ellipsis">Interview synthesis v3</div><div class="fs12 muted">New · today</div></div></div>
                <div class="swi">${fileIcon('pdf')}<div class="grow"><div class="fw6 fs13 ellipsis">Current-state process map</div><div class="fs12 muted">v2 · Sep 18</div></div></div>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="card ask">
              <div class="row gap10">${ai('md')}<div><div class="fw7 fs14">Ask about Discovery</div><div class="fs12 muted">Private to you</div></div></div>
              <div class="ask-in">What did the interviews find?<span class="send"><i class="fa-solid fa-arrow-up"></i></span></div>
              <div class="ask-scope"><i class="fa-solid fa-eye"></i><span>Answers come only from what Meridian has shared with Northwind.</span></div>
              <div class="sugs"><span class="sug">When is the readout?</span><span class="sug">What do you still need from us?</span><span class="sug">Summarize the synthesis</span></div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">Your Meridian team</span></div>
              <div class="team-rows">
                <div class="tm">${avp('ada', 'md')}<div class="grow"><div class="fw6 fs13">Ada Lovell</div><div class="fs12 muted">Engagement lead · online</div></div><span class="btn sm icon"><i class="fa-regular fa-comment"></i></span></div>
                <div class="tm">${av('sam', 'md')}<div class="grow"><div class="fw6 fs13">Sam Okafor</div><div class="fs12 muted">Senior consultant</div></div><span class="btn sm icon"><i class="fa-regular fa-comment"></i></span></div>
                <div class="tm">${avp('priya', 'md')}<div class="grow"><div class="fw6 fs13">Priya Shah</div><div class="fs12 muted">Analyst · online</div></div><span class="btn sm icon"><i class="fa-regular fa-comment"></i></span></div>
              </div>
            </div>
          </div>
        </div>
      </div></main>
    </div>
  </div>`;
  const css = sharedCss + `
  .ch-home { padding: 20px 32px; }
  .hero { padding: 16px 18px 12px; }
  .hero .next { text-align: right; margin-right: 6px; }
  .miles { display: flex; align-items: center; gap: 10px; padding: 16px 4px 4px; }
  .mile { display: flex; align-items: center; gap: 8px; flex: none; }
  .mile .dot { width: 20px; height: 20px; border-radius: 99px; border: 2px solid var(--mj-border-strong); display: grid; place-items: center; font-size: 9px; color: var(--mj-text-inverse); background: var(--mj-bg-surface); }
  .mile.done .dot { background: var(--mj-status-success); border-color: var(--mj-status-success); }
  .mile.now .dot { border-color: var(--mj-brand-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--mj-brand-primary) 18%, transparent); }
  .mile.now .dot::after { content: ''; width: 8px; height: 8px; border-radius: 9px; background: var(--mj-brand-primary); }
  .bar { flex: 1; height: 2px; background: var(--mj-border-default); border-radius: 2px; }
  .bar.done { background: var(--mj-status-success); }
  .bar.half { background: linear-gradient(90deg, var(--mj-status-success), var(--mj-brand-primary)); }
  .cgrid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; margin-top: 16px; }
  .col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .count-pill { font-size: 11.5px; font-weight: 700; color: var(--mj-brand-on-primary); background: var(--mj-brand-primary); border-radius: 99px; padding: 1px 8px; }
  .wrows { padding: 0 8px 8px; }
  .wrow { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-top: 1px solid var(--mj-border-subtle); }
  .wrow:first-child { border-top: 0; }
  .fs13\\.5 { font-size: 13.5px; }
  .due { font-size: 12px; font-weight: 600; color: var(--mj-status-warning-text); background: var(--mj-status-warning-bg); border-radius: 6px; padding: 2px 8px; white-space: nowrap; }
  .nrows { padding: 0 16px 10px; }
  .nrow { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle); }
  .nrow:first-child { border-top: 0; }
  .nrow b { font-weight: 650; color: var(--mj-text-primary); }
  .ask { padding: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--mj-brand-primary) 6%, var(--mj-bg-surface)), var(--mj-bg-surface) 70%); }
  .ask-in { position: relative; margin-top: 14px; height: 42px; border-radius: 11px; border: 1px solid color-mix(in srgb, var(--mj-brand-primary) 35%, var(--mj-border-default)); background: var(--mj-bg-surface); display: flex; align-items: center; padding: 0 44px 0 12px; color: var(--mj-text-muted); font-size: 13.5px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--mj-brand-primary) 7%, transparent); }
  .ask-in .send { position: absolute; right: 6px; top: 6px; width: 30px; height: 30px; border-radius: 8px; background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); display: grid; place-items: center; font-size: 12px; }
  .ask-scope { margin-top: 10px; font-size: 12px; color: var(--mjc-shared); display: flex; align-items: center; gap: 7px; }
  .sugs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .sug { font-size: 12px; color: var(--mj-text-secondary); padding: 5px 10px; border-radius: 99px; border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface); }
  .team-rows { padding: 0 16px 10px; }
  .sw { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 0 16px 14px; }
  .swi { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 10px; border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface-card); min-width: 0; }
  .tm { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle); }
  .tm:first-child { border-top: 0; }
  `;
  return page({ title: 'Casey — Home', css, body });
}

/* ============================== 08 COMMITTEE MEMBER (Dana) ============================== */
export function committeeMember() {
  const agenda = (time, title, who, paper, extra = '') => `
    <div class="ag-row"><span class="ag-t tnum">${time}</span><div class="grow"><div class="fw6 fs13">${title}</div><div class="fs12 muted">${who}</div></div>${extra}${paper}</div>`;
  const paper = (label) => `<span class="paper"><i class="fa-regular fa-file-lines"></i>${label}</span>`;
  const comTabs = [['Overview', 'fa-gauge-high'], ['Meetings', 'fa-calendar-days', '4'], ['Papers', 'fa-folder-open', '18'], ['Motions', 'fa-gavel', '1'], ['Members', 'fa-user-group', '7'], ['Chat', 'fa-comments']];
  const body = `
  <div class="shell">
    ${topbar({ user: 'dana' })}
    <div class="body">
      ${navGuest({ active: 'committee', who: 'dana' })}
      <main class="main">
        ${spaceHeader({
          crumbs: ['Spaces', 'Audit Committee'], type: 'com', icon: 'fa-landmark', name: 'Audit Committee', kind: 'Committee',
          status: '<span class="chip plain">FY2026 term</span>',
          sub: 'Financial reporting, internal controls and the external audit<span class="dotsep"></span>Meets quarterly',
          tabs: comTabs, activeTab: 'Overview',
          audience: `<div class="aud"><span class="stack">${av('marg', 'sm')}${av('tom', 'sm')}${av('ada', 'sm')}</span><span class="aud-div"></span><span class="stack">${av('dana', 'sm')}${av('ken', 'sm')}</span><span class="aud-t"><b>7 members</b><span>2 outside directors</span></span></div>`,
        })}
        <div class="cm">
          <section class="col">
            <div class="card meet">
              <div class="meet-top">
                <div class="bigdate"><span>OCT</span><b>2</b><em>Thu</em></div>
                <div class="grow">
                  <div class="eyebrow" style="color:var(--mjc-type-color)">Next meeting · in 6 days</div>
                  <div class="fw7" style="font-size:19px;margin-top:2px">Q3 Audit Committee meeting</div>
                  <div class="fs13 secondary" style="margin-top:2px">4:00–5:30 PM · Boardroom, 12th floor, and video</div>
                </div>
                <div class="row gap8"><span class="btn"><i class="fa-regular fa-calendar-plus"></i>Add to calendar</span><span class="btn" style="opacity:.6"><i class="fa-solid fa-video"></i>Join at 3:55</span></div>
              </div>
              <div class="pack">
                ${fileIcon('pdf')}
                <div class="grow"><div class="fw7 fs13.5">Q3 board pack</div><div class="fs12 muted">42 pages · published today by Ada Lovell, committee secretary</div>
                  <div class="row gap10" style="margin-top:8px"><div class="progress grow" style="max-width:260px"><span style="width:29%;background:var(--mjc-type-color)"></span></div><span class="fs12 secondary">You’ve read 12 of 42 pages</span></div></div>
                <span class="btn primary"><i class="fa-solid fa-book-open"></i>Continue reading</span>
              </div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">Agenda</span><span class="fs12 muted">6 items</span><span class="link">Download pack</span></div>
              <div class="agenda">
                ${agenda('4:00', 'Call to order; minutes of July 17', 'Margaret Cole, chair', paper('Minutes'))}
                ${agenda('4:05', 'External audit plan for FY2026', 'Hartwell &amp; Co., invited', paper('Paper 2'))}
                ${agenda('4:30', 'Internal controls update', 'Tom Reyes', paper('Paper 3'), '<span class="note-flag"><i class="fa-regular fa-note-sticky"></i>Your note on p.14</span>')}
                ${agenda('4:50', 'Motion 2026-14: appoint the external auditor', 'Margaret Cole', '<span class="chip warn"><i class="fa-solid fa-gavel"></i>Vote</span>')}
                ${agenda('5:10', 'Risk register review', 'Ada Lovell', paper('Paper 5'))}
                ${agenda('5:25', 'Closed session — members only', 'Staff and guests leave', '<span class="chip team"><i class="fa-solid fa-lock"></i>Members</span>')}
              </div>
            </div>
          </section>
          <aside class="col">
            <div class="card vote">
              <div class="row gap8"><span class="chip warn lg"><i class="fa-solid fa-gavel"></i>Your vote is needed</span><span class="fs12 muted" style="margin-left:auto">Closes Wed 5:00 PM</span></div>
              <div class="fw7 fs15" style="margin-top:12px">Motion 2026-14</div>
              <div class="fs13 secondary" style="margin-top:4px;line-height:1.5">Appoint Hartwell &amp; Co. as external auditor for FY2026, fee not to exceed <b class="tnum" style="color:var(--mj-text-primary)">$184,000</b>.</div>
              <div class="fs12 muted" style="margin-top:6px">Moved by Margaret Cole · seconded by Tom Reyes</div>
              <div class="row gap8" style="margin-top:12px"><span class="stack">${av('marg', 'xs')}${av('tom', 'xs')}${av('ruth', 'xs')}${av('ken', 'xs')}</span><span class="fs12 secondary">4 of 7 have voted</span><div class="progress grow"><span style="width:57%;background:var(--mjc-type-color)"></span></div></div>
              <div class="vbtns"><span class="btn"><i class="fa-solid fa-check" style="color:var(--mj-status-success)"></i>For</span><span class="btn"><i class="fa-solid fa-xmark" style="color:var(--mj-status-error)"></i>Against</span><span class="btn">Abstain</span></div>
              <div class="fs12 muted" style="margin-top:10px"><i class="fa-regular fa-flag"></i>&nbsp; <span class="link" style="font-weight:600">Declare a conflict of interest</span> · votes are recorded by name in the minutes</div>
            </div>
            <div class="card ask">
              <div class="row gap10">${ai('md')}<div><div class="fw7 fs14">Ask about this committee</div><div class="fs12 muted">Private to you</div></div></div>
              <div class="ask-in">How does the fee compare to last year?<span class="send"><i class="fa-solid fa-arrow-up"></i></span></div>
              <div class="ask-scope"><i class="fa-solid fa-lock"></i><span>Uses papers published to members, never unpublished drafts.</span></div>
            </div>
            <div class="card">
              <div class="card-h"><span class="h3">Members</span><span class="link">All 7</span></div>
              <div class="mem">
                <div class="m">${av('marg', 'sm')}<span class="grow fs12.5"><b>Margaret Cole</b> · chair</span></div>
                <div class="m">${av('ken', 'sm')}<span class="grow fs12.5"><b>Ken Mori</b> · outside director</span></div>
                <div class="m" style="opacity:.8">${av('pat', 'sm')}<span class="grow fs12.5"><b>Pat Rivera</b> · you invited</span><span class="chip plain">Awaiting staff</span></div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  </div>`;
  const css = sharedCss + `
  body { --mjc-type-color: #d97706; } /* this space's SpaceType.Color, which is data */
  .cm { display: grid; grid-template-columns: minmax(0, 1fr) 344px; gap: 18px; padding: 16px 28px; min-height: 0; }
  .col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .meet { overflow: hidden; }
  .meet-top { display: flex; align-items: center; gap: 16px; padding: 16px 18px; background: linear-gradient(90deg, color-mix(in srgb, var(--mjc-type-color) 9%, var(--mj-bg-surface)), var(--mj-bg-surface) 70%); border-bottom: 1px solid var(--mj-border-default); }
  .bigdate { width: 62px; height: 68px; border-radius: 14px; background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); box-shadow: var(--mj-shadow-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; flex: none; }
  .bigdate span { font-size: 11px; font-weight: 700; color: var(--mj-status-error); letter-spacing: .08em; }
  .bigdate b { font-size: 26px; font-weight: 750; margin-top: 3px; }
  .bigdate em { font-style: normal; font-size: 10.5px; color: var(--mj-text-muted); margin-top: 3px; font-weight: 600; }
  .pack { display: flex; align-items: center; gap: 14px; padding: 14px 18px; }
  .fs13\\.5 { font-size: 13.5px; }
  .agenda { padding: 0 8px 6px; }
  .ag-row { display: flex; align-items: center; gap: 14px; padding: 8px 8px; border-top: 1px solid var(--mj-border-subtle); }
  .ag-row:first-child { border-top: 0; }
  .ag-t { width: 38px; font-size: 12.5px; font-weight: 650; color: var(--mj-text-secondary); }
  .paper { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--mj-text-secondary); padding: 3px 8px; border-radius: 7px; border: 1px solid var(--mj-border-default); }
  .note-flag { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--mj-status-warning-text); margin-right: 4px; }
  .vote { padding: 16px; border-color: color-mix(in srgb, var(--mj-status-warning) 45%, var(--mj-border-default)); box-shadow: 0 0 0 4px color-mix(in srgb, var(--mj-status-warning) 8%, transparent), var(--mj-shadow-sm); }
  .vbtns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 14px; }
  .ask { padding: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--mj-brand-primary) 6%, var(--mj-bg-surface)), var(--mj-bg-surface) 70%); }
  .ask-in { position: relative; margin-top: 12px; height: 40px; border-radius: 11px; border: 1px solid color-mix(in srgb, var(--mj-brand-primary) 35%, var(--mj-border-default)); background: var(--mj-bg-surface); display: flex; align-items: center; padding: 0 44px 0 12px; color: var(--mj-text-muted); font-size: 13px; }
  .ask-in .send { position: absolute; right: 5px; top: 5px; width: 30px; height: 30px; border-radius: 8px; background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); display: grid; place-items: center; font-size: 12px; }
  .ask-scope { margin-top: 10px; font-size: 12px; color: var(--mj-text-secondary); display: flex; gap: 7px; line-height: 1.45; }
  .ask-scope i { margin-top: 3px; color: var(--mj-text-muted); }
  .mem { padding: 0 16px 12px; display: flex; flex-direction: column; gap: 9px; }
  .mem .m { display: flex; align-items: center; gap: 10px; }
  .mem b { font-weight: 650; }
  `;
  return page({ title: 'Audit Committee — Dana', css, body });
}
