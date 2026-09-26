import { SPARK, P, av, avp, stack, ai, shared, team, chip, fileIcon, tile, page, topbar, navStaff, spaceHeader, discoveryTabs, audienceChip, sharedCss } from './lib.mjs';

/* ============================== 01 HOME (staff) ============================== */
export function homeStaff() {
  const need = (lead, html, meta, actions) => `
    <div class="need">
      <div class="need-lead">${lead}</div>
      <div class="grow">
        <div class="need-t">${html}</div>
        <div class="need-m">${meta}</div>
      </div>
      <div class="row gap8">${actions}</div>
    </div>`;
  const spaceRow = ({ type, icon, name, where, people, extPeople, signal = '', progress, note = '' }) => `
    <div class="srow">
      ${tile(type, icon, 'lg')}
      <div class="srow-name"><div class="fw7 fs14 ellipsis">${name}</div><div class="fs12 muted ellipsis">${where}</div></div>
      <div class="srow-prog">${progress
        ? `<div class="row fs12"><span class="secondary">${progress[0]}</span><span class="muted" style="margin-left:auto">${progress[1]}</span></div><div class="progress" style="margin-top:6px"><span style="width:${progress[2]}%"></span></div>`
        : `<div class="fs12 secondary ellipsis">${note}</div>`}</div>
      <div class="srow-people"><span class="stack">${people.map((k) => av(k, 'xs')).join('')}</span>${extPeople.length ? `<span class="aud-div"></span><span class="stack">${extPeople.map((k) => av(k, 'xs')).join('')}</span>` : ''}</div>
      <div class="srow-sig">${signal}</div>
      <i class="fa-solid fa-chevron-right muted fs12"></i>
    </div>`;

  const body = `
  <div class="shell">
    ${topbar()}
    <div class="body">
      ${navStaff('home')}
      <main class="main"><div class="page home">
        <div class="home-head">
          <div>
            <div class="eyebrow">Friday, September 26</div>
            <h1 class="h1" style="font-size:28px;margin-top:4px">Good morning, Ada</h1>
            <div class="secondary" style="margin-top:4px">Four things need you across five spaces. Northwind's readout is in 13 days.</div>
          </div>
          <div class="row gap8" style="margin-left:auto">
            <div class="askall"><span class="ai-av sm">${SPARK}</span><span>Ask across your spaces…</span><span class="kbd">⌘I</span></div>
            <span class="btn primary"><i class="fa-solid fa-plus"></i>New space</span>
          </div>
        </div>

        <div class="home-grid">
          <div class="col">
            <div class="card">
              <div class="card-h"><span class="h3">Needs you</span><span class="count-pill">4</span><span class="link">Open inbox</span></div>
              <div class="needs">
                ${need(av('casey', 'md'),
                  `<b>Casey Morgan</b> asked in <b>Discovery</b> · Room`,
                  `<span class="quote">“Can someone summarize where vendor scoring landed? Our CFO will ask.”</span>`,
                  `<span class="muted fs12">12m</span><span class="btn sm primary"><i class="fa-solid fa-reply"></i>Reply</span>`)}
                ${need(ai('md'),
                  `<b>Review before sharing</b> · Interview synthesis v3 <span class="need-move">${team('Team')}<i class="fa-solid fa-arrow-right-long"></i>${shared('Shared')}</span>`,
                  `The Assistant found 2 people who could be identified in a file Sam wants to share.`,
                  `<span class="muted fs12">2h</span><span class="btn sm"><i class="fa-solid fa-magnifying-glass"></i>Review</span>`)}
                ${need(tile('com', 'fa-landmark', 'lg'),
                  `<b>Audit Committee</b> meets Thu, Oct 2 at 4:00 PM`,
                  `The board pack is ready but not published. 7 members are waiting on it.`,
                  `<span class="btn sm"><i class="fa-solid fa-paper-plane"></i>Publish pack</span>`)}
                ${need(av('pat', 'md'),
                  `<b>Dana Whitfield</b> invited <b>Pat Rivera</b> to Audit Committee`,
                  `Outside director · new outside members need staff approval`,
                  `<span class="btn sm primary">Approve</span><span class="btn sm ghost">Decline</span>`)}
              </div>
            </div>

            <div class="card">
              <div class="card-h"><span class="h3">Your spaces</span>
                <span class="seg" style="margin-left:8px"><span class="on">Active <span class="n">6</span></span><span>Closed <span class="n">2</span></span></span>
                <span class="fs12 muted" style="margin-left:auto">Recent activity <i class="fa-solid fa-chevron-down fs11"></i></span></div>
              <div class="srows">
              ${spaceRow({ type: 'eng', icon: 'fa-compass', name: 'Discovery', where: 'Engagement · in Northwind', people: ['ada', 'sam', 'priya'], extPeople: ['casey', 'bea', 'omar'],
                signal: '<span class="unread-pill">3 new</span>', progress: ['Week 7 of 10', 'Readout Oct 9', 70] })}
              ${spaceRow({ type: 'com', icon: 'fa-landmark', name: 'Audit Committee', where: 'Committee · FY2026 term', people: ['marg', 'tom', 'ada'], extPeople: ['dana'],
                signal: '<span class="unread-pill warn">Vote open</span>', progress: ['Next meeting', 'Thu, Oct 2', 88] })}
              ${spaceRow({ type: 'coh', icon: 'fa-graduation-cap', name: 'Spring Leadership Cohort', where: 'Cohort · 18 learners', people: ['ada', 'priya'], extPeople: ['lee'],
                signal: '<span class="fs12 muted">14 of 18 in</span>', progress: ['Session 4 of 8', 'Tue, Sep 30', 50] })}
              ${spaceRow({ type: 'eng', icon: 'fa-truck-fast', name: 'Delivery', where: 'Engagement · in Northwind', people: ['ada', 'sam'], extPeople: ['casey'],
                signal: '<span class="chip team"><i class="fa-solid fa-lock"></i>Sealed</span>', progress: ['Starts after readout', 'Oct 20', 6] })}
              ${spaceRow({ type: 'rel', icon: 'fa-building', name: 'Northwind', where: 'Client relationship · since 2023', people: ['ada', 'sam'], extPeople: ['casey', 'lena'],
                note: '2 open · 2 closed, still answerable' })}
              ${spaceRow({ type: 'rel', icon: 'fa-building', name: 'Pinecrest Health', where: 'Client relationship · proposal', people: ['ada'], extPeople: [],
                note: 'Proposal · no one invited yet' })}
              </div>
            </div>
          </div>

          <div class="col">
            <div class="card">
              <div class="card-h"><span class="h3">Coming up</span><span class="link">Calendar</span></div>
              <div class="agenda">
                ${[['OCT', '2', 'Audit Committee meeting', '4:00 PM · board pack due today', 'com', 'fa-landmark'],
                   ['OCT', '7', 'Casey reviews the readout draft', 'Task · Discovery', 'eng', 'fa-compass'],
                   ['OCT', '9', 'Discovery readout', '2:00 PM · with Northwind leadership', 'eng', 'fa-compass'],
                   ['OCT', '14', 'Cohort session 5 — Leading change', 'Spring Leadership Cohort', 'coh', 'fa-graduation-cap']]
                  .map(([m, d, t, s, ty, ic]) => `<div class="ag"><div class="date"><span>${m}</span><b>${d}</b></div><div class="grow"><div class="fw6 fs13 ellipsis">${t}</div><div class="fs12 muted ellipsis">${s}</div></div>${tile(ty, ic, 'sm')}</div>`).join('')}
              </div>
            </div>

            <div class="card digest">
              <div class="card-h">${ai('sm')}<span class="h3">Your week so far</span><span class="chip plain" style="margin-left:auto">Monday digest</span></div>
              <div class="card-b">
                <ul class="dig">
                  <li><b>Northwind</b> opened the readout draft twice and asked 3 questions. Casey is still waiting on the vendor-scoring summary.</li>
                  <li><b>Audit Committee:</b> 5 of 7 members opened the draft board pack; Dana flagged page 14.</li>
                  <li><b>Cohort:</b> reflections are due Monday; 4 learners haven’t started.</li>
                </ul>
                <div class="dig-foot"><i class="fa-solid fa-shield-halved"></i>Built from what you can see, space by space. Team material stays in Team.</div>
              </div>
            </div>
          </div>
        </div>
      </div></main>
    </div>
  </div>`;

  const css = sharedCss + `
  .home { padding: 18px 32px; }
  .home-head { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 14px; }
  .askall { display: flex; align-items: center; gap: 10px; width: 340px; height: 38px; padding: 0 10px 0 8px; border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--mj-brand-primary) 30%, var(--mj-border-default)); background: var(--mj-bg-surface);
    color: var(--mj-text-muted); font-size: 13.5px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--mj-brand-primary) 6%, transparent); }
  .askall .kbd { margin-left: auto; }
  .home-grid { display: grid; grid-template-columns: minmax(0, 1fr) 336px; gap: 22px; }
  .col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  .col > .row { margin: 4px 2px 0 !important; }
  .count-pill { font-size: 11.5px; font-weight: 700; color: var(--mj-brand-on-primary); background: var(--mj-brand-primary); border-radius: 99px; padding: 1px 8px; }
  .needs { padding: 0 6px 6px; }
  .need { display: flex; align-items: center; gap: 14px; padding: 10px 10px; border-radius: 10px; }
  .need + .need { border-top: 1px solid var(--mj-border-subtle); }
  .need-lead { width: 40px; display: grid; place-items: center; }
  .need-t { font-size: 13.5px; } .need-t b { font-weight: 650; }
  .need-m { font-size: 12.5px; color: var(--mj-text-secondary); margin-top: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .quote { color: var(--mj-text-secondary); font-style: normal; }
  .need-move { display: inline-flex; align-items: center; gap: 5px; margin-left: 6px; vertical-align: middle; }
  .need-move > i { font-size: 11px; color: var(--mj-text-muted); }
  .srows { padding: 0 6px 6px; }
  .srow { display: grid; grid-template-columns: 40px minmax(0, 1fr) 176px 124px 84px 12px; align-items: center; gap: 14px; padding: 6px 10px; border-top: 1px solid var(--mj-border-subtle); }
  .srow:first-child { border-top: 0; }
  .srow .tile.lg { width: 38px; height: 38px; font-size: 16px; border-radius: 10px; }
  .srow-people { display: flex; align-items: center; gap: 7px; }
  .srow-people .aud-div { width: 1px; height: 14px; background: var(--mj-border-default); }
  .srow-sig { display: flex; justify-content: flex-end; }
  .unread-pill { font-size: 11px; font-weight: 700; color: var(--mj-brand-primary); background: color-mix(in srgb, var(--mj-brand-primary) 10%, var(--mj-bg-surface)); border-radius: 99px; padding: 1px 7px; white-space: nowrap; }
  .unread-pill.warn { color: var(--mj-status-warning-text); background: var(--mj-status-warning-bg); }
  .agenda { padding: 0 10px 8px; }
  .ag { display: flex; align-items: center; gap: 12px; padding: 9px 6px; border-top: 1px solid var(--mj-border-subtle); }
  .ag:first-child { border-top: 0; }
  .date { width: 42px; height: 44px; border-radius: 10px; border: 1px solid var(--mj-border-default); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; background: var(--mj-bg-surface); }
  .date span { font-size: 9.5px; font-weight: 700; color: var(--mj-status-error); letter-spacing: .06em; }
  .date b { font-size: 17px; font-weight: 700; margin-top: 3px; }
  .digest { background: linear-gradient(180deg, color-mix(in srgb, var(--mj-brand-primary) 5%, var(--mj-bg-surface)), var(--mj-bg-surface) 60%); }
  .dig { margin: 0; padding: 0 0 0 16px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--mj-text-secondary); }
  .dig b { color: var(--mj-text-primary); font-weight: 650; }
  .dig-foot { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--mj-border-default); font-size: 11.5px; color: var(--mj-text-muted); display: flex; gap: 7px; align-items: center; }
  `;
  return page({ title: 'Home', css, body });
}

/* ============================== 02 SPACE OVERVIEW (staff) ============================== */
export function overviewStaff() {
  const deliverable = (kind, name, meta, stamp, seen) => `
    <div class="deliv">
      <div class="thumb ${kind}"><div class="page-lines"><i></i><i></i><i></i><i></i><i></i></div>${fileIcon(kind, 'sm')}</div>
      <div class="fw6 fs13 ellipsis" style="margin-top:10px">${name}</div>
      <div class="fs12 muted ellipsis">${meta}</div>
      <div class="deliv-foot"><span class="fs11 secondary ellipsis">${stamp}</span><span style="margin-left:auto" class="row gap6">${seen}</span></div>
    </div>`;
  const teamRow = (kind, name, who, when, extra, btn = true) => `
    <div class="trow">${fileIcon(kind, 'sm')}<div class="grow"><div class="fw6 fs13 ellipsis">${name}</div><div class="fs12 muted">${who}<span class="dotsep"></span>${when}</div></div>${extra}${btn ? '<span class="btn sm share-btn"><i class="fa-solid fa-share-from-square"></i>Share…</span>' : ''}</div>`;
  const body = `
  <div class="shell">
    ${topbar()}
    <div class="body">
      ${navStaff('discovery')}
      <main class="main">
        ${spaceHeader({
          tabs: discoveryTabs, activeTab: 'Overview', audience: audienceChip(),
          actions: `<span class="btn"><i class="fa-solid fa-user-plus"></i>Invite</span><span class="btn primary"><i class="fa-solid fa-plus"></i>New</span>`,
        })}
        <div class="page ov">
          <div class="ov-grid">
            <div class="col">
              <div class="attn">
                <div class="attn-card"><span class="ic blue"><i class="fa-solid fa-comment-dots"></i></span><div class="grow"><div class="fw6 fs13 ellipsis">Casey asked</div><div class="fs12 muted ellipsis">Room · 12m ago</div></div><span class="btn sm">Reply</span></div>
                <div class="attn-card"><span class="ic warn">${SPARK}</span><div class="grow"><div class="fw6 fs13 ellipsis">2 names flagged</div><div class="fs12 muted ellipsis">Synthesis v3</div></div><span class="btn sm">Review</span></div>
                <div class="attn-card"><span class="ic red"><i class="fa-solid fa-clock"></i></span><div class="grow"><div class="fw6 fs13 ellipsis">Q2 extract is late</div><div class="fs12 muted ellipsis">Bea · due Sep 24</div></div><span class="btn sm">Nudge</span></div>
              </div>

              <div class="card band-card shared-band">
                <div class="band-h">
                  <span class="band-ic"><i class="fa-solid fa-eye"></i></span>
                  <div class="grow"><div class="fw7 fs14">Shared with Northwind</div><div class="fs12 band-sub">What Northwind sees here · 9 items · the Assistant can quote these to anyone</div></div>
                  <span class="link fs12"><i class="fa-solid fa-eye"></i>&nbsp;Preview as Casey</span>
                </div>
                <div class="deliv-grid">
                  ${deliverable('pdf', 'Discovery readout — draft for review', 'PDF · v4 · 34 pages', 'Shared by Ada · Sep 24', `${av('casey', 'xs')}${av('lena', 'xs')}<span class="fs11 muted">opened</span>`)}
                  ${deliverable('pdf', 'Current-state process map', 'PDF · v2 · 6 pages', 'Shared by Ada · Sep 18', `<span class="ai-av sm" style="width:18px;height:18px;font-size:9px;border-radius:5px">${SPARK}</span><span class="fs11 muted">cited 6×</span>`)}
                  ${deliverable('img', 'Site visit photos — Dayton', '24 photos', 'Added by Bea · Sep 16', `${av('omar', 'xs')}<span class="fs11 muted">opened</span>`)}
                </div>
              </div>

              <div class="card band-card team-band">
                <div class="band-h">
                  <span class="band-ic team"><i class="fa-solid fa-lock"></i></span>
                  <div class="grow"><div class="fw7 fs14">Team working set</div><div class="fs12 muted">Only Meridian staff · 15 items · never quoted to Northwind</div></div>
                  <span class="link fs12">Open library</span>
                </div>
                <div class="trows">
                  ${teamRow('doc', 'Interview synthesis v3', 'Sam Okafor', '2h ago', `<span class="chip warn"><i class="fa-solid fa-triangle-exclamation"></i>2 names flagged</span>`)}
                  ${teamRow('xls', 'Vendor scoring model', 'Priya Shah', 'yesterday', `<span class="chip plain">In progress</span>`)}
                  ${teamRow('ppt', 'Readout storyline', 'Ada Lovell', 'Sep 23', '')}
                </div>
              </div>

            </div>

            <div class="col">
              <div class="card ask">
                <div class="row gap10">${ai('md')}<div><div class="fw7 fs14">Ask about Discovery</div><div class="fs12 muted">One assistant, bounded by who’s asking</div></div></div>
                <div class="ask-in">Ask anything about this engagement…<span class="send"><i class="fa-solid fa-arrow-up"></i></span></div>
                <div class="ask-scope"><i class="fa-solid fa-lock"></i><span>Only you will see this. It can use <b>Team and Shared</b> material.</span></div>
                <div class="sugs">
                  <span class="sug">What’s still open for the readout?</span>
                  <span class="sug">Draft this week’s note to Casey</span>
                  <span class="sug">Which interviews mention scheduling?</span>
                </div>
              </div>

              <div class="card">
                <div class="card-h"><span class="h3">Room</span><span class="chip shared"><i class="fa-solid fa-eye"></i>Everyone · 9</span><span class="link">Open chat</span></div>
                <div class="mini-msgs">
                  <div class="mm">${av('casey', 'sm')}<div class="grow"><div class="fs12"><b>Casey Morgan</b> <span class="muted">9:41</span></div><div class="fs12.5 secondary clamp">Before Thursday — can someone summarize where vendor scoring landed?</div></div></div>
                  <div class="mm">${av('ada', 'sm')}<div class="grow"><div class="fs12"><b>Ada Lovell</b> <span class="muted">9:44</span></div><div class="fs12.5 secondary clamp"><span class="mention">@Assistant</span> can you pull that together from what we’ve shared?</div></div></div>
                  <div class="mm">${ai('sm')}<div class="grow"><div class="fs12"><b>Assistant</b> <span class="muted">9:44</span></div><div class="fs12.5 secondary clamp">Three vendors remain after the second screen: Kestrel, Lumen WMS and Haulbridge…</div></div></div>
                </div>
              </div>

              <div class="card">
                <div class="card-h"><span class="h3">Inside Discovery</span><span class="link">+ Sub-space</span></div>
                <div class="sub-row">${tile('eng', 'fa-clipboard', 'lg')}<div class="grow"><div class="fw6 fs13">Field notes</div><div class="fs12 muted">Same people as Discovery · 6 Team items</div></div><i class="fa-solid fa-chevron-right muted fs12"></i></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
  const css = sharedCss + `
  .ov { padding: 18px 28px; }
  .ov-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; }
  .col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .attn { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .attn-card { display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 12px; border-radius: 12px; background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); box-shadow: var(--mj-shadow-sm); }
  .ic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 13px; flex: none; }
  .ic.blue { background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface)); color: var(--mj-brand-primary); }
  .ic.warn { background: var(--mj-status-warning-bg); color: var(--mj-status-warning-text); }
  .ic.red { background: var(--mj-status-error-bg); color: var(--mj-status-error-text); }
  .band-card { overflow: hidden; }
  .band-h { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
  .shared-band { border-color: var(--mjc-shared-border); }
  .shared-band .band-h { background: linear-gradient(90deg, var(--mjc-shared-bg), var(--mj-bg-surface)); border-bottom: 1px solid var(--mjc-shared-border); }
  .band-sub { color: var(--mjc-shared); }
  .band-ic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--mjc-on-strong); background: var(--mjc-shared-strong); font-size: 13px; }
  .band-ic.team { background: var(--mjc-team-strong); }
  .team-band .band-h { border-bottom: 1px solid var(--mj-border-default); background: repeating-linear-gradient(135deg, var(--mj-bg-surface-card) 0 8px, var(--mj-bg-surface) 8px 16px); }
  .deliv-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 14px 16px 16px; }
  .deliv { min-width: 0; }
  .thumb { position: relative; height: 84px; border-radius: 10px; border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface-card); overflow: hidden; }
  .thumb .page-lines { position: absolute; left: 18px; right: 30px; top: 14px; bottom: -10px; background: var(--mj-bg-surface); border-radius: 4px 4px 0 0; box-shadow: var(--mj-shadow-md); padding: 12px 10px; display: flex; flex-direction: column; gap: 6px; }
  .thumb .page-lines i { display: block; height: 5px; border-radius: 3px; background: var(--mj-border-default); }
  .thumb .page-lines i:first-child { width: 60%; height: 7px; background: var(--mj-text-secondary); opacity: .5; }
  .thumb .page-lines i:nth-child(3) { width: 80%; } .thumb .page-lines i:nth-child(5) { width: 45%; }
  .thumb.img { background: linear-gradient(135deg, var(--mj-border-strong), var(--mj-text-disabled) 40%, var(--mj-text-muted)); }
  .thumb.img .page-lines { display: none; }
  .thumb .fi { position: absolute; right: 8px; bottom: 8px; box-shadow: var(--mj-shadow-sm); }
  .deliv-foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
  .trows { padding: 4px 8px 8px; }
  .trow { display: flex; align-items: center; gap: 12px; padding: 9px 8px; border-top: 1px solid var(--mj-border-subtle); }
  .trow:first-child { border-top: 0; }
  .share-btn { color: var(--mjc-shared); border-color: var(--mjc-shared-border); }
  .share-btn i { color: var(--mjc-shared); }
  .miles { display: flex; align-items: center; gap: 10px; padding: 14px 18px; }
  .mile { display: flex; align-items: center; gap: 8px; flex: none; }
  .mile .dot { width: 20px; height: 20px; border-radius: 99px; border: 2px solid var(--mj-border-strong); display: grid; place-items: center; font-size: 9px; color: var(--mj-text-inverse); background: var(--mj-bg-surface); }
  .mile.done .dot { background: var(--mj-status-success); border-color: var(--mj-status-success); }
  .mile.now .dot { border-color: var(--mj-brand-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--mj-brand-primary) 18%, transparent); }
  .mile.now .dot::after { content: ''; width: 8px; height: 8px; border-radius: 9px; background: var(--mj-brand-primary); }
  .bar { flex: 1; height: 2px; background: var(--mj-border-default); border-radius: 2px; }
  .bar.done { background: var(--mj-status-success); }
  .bar.half { background: linear-gradient(90deg, var(--mj-status-success), var(--mj-brand-primary)); }
  .ask { padding: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--mj-brand-primary) 6%, var(--mj-bg-surface)), var(--mj-bg-surface) 70%); }
  .ask-in { position: relative; margin-top: 14px; height: 42px; border-radius: 11px; border: 1px solid color-mix(in srgb, var(--mj-brand-primary) 35%, var(--mj-border-default)); background: var(--mj-bg-surface); display: flex; align-items: center; padding: 0 44px 0 12px; color: var(--mj-text-muted); font-size: 13.5px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--mj-brand-primary) 7%, transparent); }
  .ask-in .send { position: absolute; right: 6px; top: 6px; width: 30px; height: 30px; border-radius: 8px; background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); display: grid; place-items: center; font-size: 12px; }
  .ask-scope { margin-top: 10px; font-size: 12px; color: var(--mj-text-secondary); display: flex; align-items: center; gap: 7px; }
  .ask-scope i { color: var(--mj-text-muted); }
  .sugs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .sug { font-size: 12px; color: var(--mj-text-secondary); padding: 5px 10px; border-radius: 99px; border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface); }
  .ask-scope b { font-weight: 650; color: var(--mj-text-primary); }
  .mini-msgs { padding: 2px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
  .mm { display: flex; gap: 10px; align-items: flex-start; }
  .clamp { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
  .sub-row { display: flex; align-items: center; gap: 12px; padding: 4px 16px 14px; }
  `;
  return page({ title: 'Discovery — Overview', css, body });
}

/* ============================== 03 LIBRARY ============================== */
function libraryMain({ dim = false } = {}) {
  const row = ({ kind, name, folder, band, when, who, seen, sel = false, flag = '' }) => `
    <tr class="${sel ? 'sel' : ''}">
      <td><div class="row gap10">${fileIcon(kind, 'sm')}<div class="grow"><div class="fw6 fs13 ellipsis">${name}</div><div class="fs12 muted ellipsis">${folder}<span class="dotsep"></span>${who}, ${when}</div></div></div></td>
      <td><div class="row gap6">${band}${flag}</div></td>
      <td><div class="row gap8">${seen}</div></td>
      <td style="text-align:right;width:36px"><i class="fa-solid fa-ellipsis muted"></i></td>
    </tr>`;
  const aiSeen = (n) => `<span class="ai-chip">${SPARK}${n}</span>`;
  return `
  <main class="main">
    ${spaceHeader({
      tabs: discoveryTabs, activeTab: 'Library', audience: audienceChip(),
      actions: `<span class="btn primary"><i class="fa-solid fa-arrow-up-from-bracket"></i>Upload</span>`,
    })}
    <div class="lib">
      <aside class="folders">
        <div class="fold on"><i class="fa-solid fa-layer-group"></i>All material<span class="n">24</span></div>
        <div class="fold-h">Collections</div>
        <div class="fold"><i class="fa-solid fa-folder"></i>Deliverables<span class="dotc shared"></span><span class="n">5</span></div>
        <div class="fold"><i class="fa-solid fa-folder"></i>Process maps<span class="dotc shared"></span><span class="n">3</span></div>
        <div class="fold"><i class="fa-solid fa-folder"></i>Interviews<span class="dotc team"></span><span class="n">9</span></div>
        <div class="fold"><i class="fa-solid fa-folder"></i>Vendor scoring<span class="dotc team"></span><span class="n">3</span></div>
        <div class="fold"><i class="fa-solid fa-folder"></i>Contracts<span class="dotc team"></span><span class="n">2</span></div>
        <div class="fold-h">Smart views</div>
        <div class="fold"><i class="fa-solid fa-inbox"></i>From Northwind<span class="n">4</span></div>
        <div class="fold"><i class="fa-solid fa-triangle-exclamation"></i>Flagged<span class="n">1</span></div>
        <div class="fold"><i class="fa-regular fa-clock"></i>Shared this week<span class="n">2</span></div>
        <div class="legend">
          <div class="row gap8">${shared()}<span class="fs12 muted">Both firms</span></div>
          <div class="row gap8">${team()}<span class="fs12 muted">Meridian only</span></div>
        </div>
      </aside>
      <section class="files">
        <div class="lib-tools">
          <div class="input" style="width:220px"><i class="fa-solid fa-magnifying-glass"></i>Search the library</div>
          <span class="seg"><span class="on">All <span class="n">24</span></span><span><i class="fa-solid fa-eye" style="color:var(--mjc-shared)"></i>Shared <span class="n">9</span></span><span><i class="fa-solid fa-lock"></i>Team <span class="n">15</span></span></span>
          <span class="btn sm" style="margin-left:auto"><i class="fa-solid fa-sliders"></i>Filter</span>
        </div>
        <div class="card" style="overflow:hidden">
          <table class="table">
            <thead><tr><th style="padding-top:12px">Name</th><th style="padding-top:12px;width:150px">Who can see it</th><th style="padding-top:12px;width:130px">Used by</th><th></th></tr></thead>
            <tbody>
              ${row({ kind: 'pdf', name: 'Discovery readout — draft for review', folder: 'Deliverables', band: shared(), when: 'Sep 24', who: 'Ada Lovell', seen: `${stack(['casey', 'lena'], 'xs')}${aiSeen(4)}` })}
              ${row({ kind: 'pdf', name: 'Current-state process map', folder: 'Process maps', band: shared(), when: 'Sep 18', who: 'Ada Lovell', seen: `${stack(['casey', 'bea', 'omar'], 'xs')}${aiSeen(6)}` })}
              ${row({ kind: 'doc', name: 'Interview synthesis v3', folder: 'Interviews', band: team(), flag: '<span class="chip warn"><i class="fa-solid fa-triangle-exclamation"></i>2</span>', when: '2h ago', who: 'Sam Okafor', seen: `${stack(['ada'], 'xs')}${aiSeen(2)}`, sel: true })}
              ${row({ kind: 'xls', name: 'Vendor scoring model', folder: 'Vendor scoring', band: team(), when: 'Yesterday', who: 'Priya Shah', seen: `${stack(['ada', 'sam'], 'xs')}` })}
              ${row({ kind: 'xls', name: 'Q2 inventory extract', folder: 'From Northwind', band: shared(), when: 'Sep 22', who: 'Bea Tanaka', seen: `${stack(['priya'], 'xs')}${aiSeen(1)}` })}
              ${row({ kind: 'img', name: 'Site visit photos — Dayton', folder: '24 photos', band: shared(), when: 'Sep 16', who: 'Bea Tanaka', seen: `${stack(['omar', 'ada'], 'xs')}` })}
              ${row({ kind: 'doc', name: 'Interview notes — Dayton plant', folder: 'Interviews', band: team(), when: 'Sep 12', who: 'Sam Okafor', seen: `${stack(['priya'], 'xs')}${aiSeen(3)}` })}
              ${row({ kind: 'pdf', name: 'Statement of work — Discovery', folder: 'Contracts & SOW', band: team(), when: 'Aug 1', who: 'Ada Lovell', seen: '' })}
            </tbody>
          </table>
        </div>
      </section>
      <aside class="drawer">
        <div class="row gap10">${fileIcon('doc')}<div class="grow"><div class="fw7 fs14 ellipsis">Interview synthesis v3</div><div class="fs12 muted">Word · 18 pages · version 3</div></div><i class="fa-solid fa-xmark muted"></i></div>
        <div class="doc-prev">
          <div class="dp-page">
            <div class="dp-h"></div>
            <p>Across 18 interviews, scheduling came up more than any other theme. <mark>As the Dayton plant manager told us</mark>, the current tool “can’t see past Tuesday.”</p>
            <p>Finance reports a nine-day close on inventory reconciliation; <mark>Jim in Finance</mark> described the process as manual.</p>
            <div class="dp-l"></div><div class="dp-l s"></div>
          </div>
        </div>
        <div class="dr-sec">
          <div class="row gap8">${team('Team only')}<span class="fs12 muted">Meridian staff</span><span class="stack" style="margin-left:auto">${av('ada', 'xs')}${av('sam', 'xs')}${av('priya', 'xs')}</span></div>
          <div class="flag-box">
            <div class="row gap8"><span class="ai-av sm">${SPARK}</span><span class="fw6 fs13">2 people could be identified</span></div>
            <div class="fs12 secondary" style="margin-top:4px">Checked when Sam asked to share it. Review the highlighted phrases before Northwind sees them.</div>
          </div>
          <span class="btn primary" style="width:100%;margin-top:12px"><i class="fa-solid fa-share-from-square"></i>Share with Northwind…</span>
        </div>
        <div class="dr-sec">
          <div class="eyebrow" style="margin-bottom:8px">Recent use</div>
          <div class="use"><span class="ai-av sm">${SPARK}</span><span class="grow fs12.5">Cited in <b>Meridian team</b> chat</span><span class="fs12 muted">2h</span></div>
          <div class="use">${av('ada', 'xs')}<span class="grow fs12.5">Ada opened it</span><span class="fs12 muted">1h</span></div>
          <div class="use">${av('sam', 'xs')}<span class="grow fs12.5">Sam uploaded version 3</span><span class="fs12 muted">2h</span></div>
        </div>
      </aside>
    </div>
  </main>`;
}
const libraryCss = `
  .lib { display: grid; grid-template-columns: 206px minmax(0, 1fr) 318px; min-height: 0; flex: 1; }
  .folders { padding: 16px 10px 16px 14px; border-right: 1px solid var(--mj-border-default); background: var(--mj-bg-surface); display: flex; flex-direction: column; gap: 1px; }
  .fold { display: flex; align-items: center; gap: 9px; height: 32px; padding: 0 9px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--mj-text-secondary); }
  .fold i { color: var(--mj-text-muted); width: 14px; font-size: 13px; }
  .fold.on { background: var(--mj-bg-surface-sunken); color: var(--mj-text-primary); font-weight: 600; }
  .fold .n { margin-left: auto; font-size: 11.5px; color: var(--mj-text-muted); font-weight: 600; }
  .fold-h { font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: .06em; color: var(--mj-text-muted); margin: 14px 9px 4px; }
  .dotc { width: 7px; height: 7px; border-radius: 9px; margin-left: 2px; }
  .dotc.shared { background: var(--mjc-shared-strong); }
  .dotc.team { background: var(--mj-text-disabled); }
  .legend { margin-top: auto; padding: 12px 8px 4px; border-top: 1px solid var(--mj-border-default); display: flex; flex-direction: column; gap: 8px; }
  .files { padding: 16px 18px; min-width: 0; }
  .lib-tools { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .ai-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: var(--mj-brand-primary); background: color-mix(in srgb, var(--mj-brand-primary) 9%, var(--mj-bg-surface)); border-radius: 6px; padding: 2px 6px; }
  .ai-chip svg { width: 11px; height: 11px; }
  .drawer { border-left: 1px solid var(--mj-border-default); background: var(--mj-bg-surface); padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; min-height: 0; overflow: hidden; }
  .doc-prev { background: var(--mj-bg-surface-sunken); border-radius: 12px; padding: 14px 16px 0; height: 196px; overflow: hidden; border: 1px solid var(--mj-border-default); }
  .dp-page { background: var(--mj-bg-surface); border-radius: 6px 6px 0 0; box-shadow: var(--mj-shadow-md); padding: 14px 16px; height: 100%; font-size: 10.5px; line-height: 1.6; color: var(--mj-text-secondary); font-family: Georgia, 'DejaVu Serif', serif; }
  .dp-page p { margin: 0 0 8px; }
  .dp-page mark { background: color-mix(in srgb, var(--mj-status-warning) 35%, transparent); color: var(--mj-text-primary); border-radius: 2px; padding: 0 1px; }
  .dp-h { width: 55%; height: 9px; border-radius: 3px; background: var(--mj-text-secondary); opacity: .55; margin-bottom: 10px; }
  .dp-l { height: 5px; border-radius: 3px; background: var(--mj-border-default); margin-top: 7px; }
  .dp-l.s { width: 60%; }
  .dr-sec { border-top: 1px solid var(--mj-border-default); padding-top: 14px; }
  .flag-box { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: var(--mj-status-warning-bg); border: 1px solid color-mix(in srgb, var(--mj-status-warning) 35%, transparent); }
  .use { display: flex; align-items: center; gap: 10px; padding: 5px 0; }
`;
export function library() {
  const body = `<div class="shell">${topbar()}<div class="body">${navStaff('discovery')}${libraryMain()}</div></div>`;
  return page({ title: 'Discovery — Library', css: sharedCss + libraryCss, body });
}

/* ============================== 04 SHARE WITH CLIENT (promotion) ============================== */
export function shareDialog() {
  const person = (k, role) => `<div class="pp">${av(k, 'sm')}<div class="grow"><div class="fw6 fs12.5 ellipsis">${P[k].n}</div><div class="fs11 muted ellipsis">${role}</div></div></div>`;
  const modal = `
  <div class="scrim"></div>
  <div class="modal" style="left:50%;top:50%;width:680px;transform:translate(-50%,-50%)">
    <div class="m-h">
      <span class="m-ic"><i class="fa-solid fa-share-from-square"></i></span>
      <div class="grow">
        <div class="fw7" style="font-size:18px">Share with Northwind</div>
        <div class="row gap6 fs13 secondary" style="margin-top:3px">${fileIcon('doc', 'sm')}<b style="font-weight:600;color:var(--mj-text-primary)">Interview synthesis v3</b><span class="muted">moves from</span>${team()}<i class="fa-solid fa-arrow-right-long muted fs12"></i>${shared()}</div>
      </div>
      <i class="fa-solid fa-xmark muted" style="font-size:16px"></i>
    </div>

    <div class="m-b">
      <div class="m-sec">
        <div class="row"><span class="fw7 fs13">6 people at Northwind will be able to open it</span><span class="fs12 muted" style="margin-left:auto">Meridian’s 3 already can</span></div>
        <div class="pgrid">
          ${person('casey', 'VP Operations · Client admin')}
          ${person('bea', 'Operations analyst')}
          ${person('omar', 'Plant director, Dayton')}
          ${person('lena', 'CFO · read-only')}
          <div class="pp more"><span class="av sm c7 ext">+2</span><div class="grow"><div class="fw6 fs12.5">2 more</div><div class="fs11 muted">through Northwind</div></div></div>
        </div>
      </div>

      <div class="review">
        <div class="row gap10">
          <span class="ai-av md">${SPARK}</span>
          <div class="grow"><div class="fw7 fs14">The Assistant checked it first</div><div class="fs12.5 secondary">Two phrases could identify someone you interviewed under a promise of anonymity.</div></div>
          <span class="chip warn"><i class="fa-solid fa-triangle-exclamation"></i>2 to review</span>
        </div>
        <div class="fix">
          <div class="fix-q">“…<mark>as the Dayton plant manager told us</mark>, the current tool can’t see past Tuesday.”</div>
          <div class="fix-a"><span class="muted fs12">Suggest</span><span class="sugg">as one plant leader told us</span><span class="btn sm" style="margin-left:auto"><i class="fa-solid fa-check"></i>Apply</span></div>
        </div>
        <div class="fix">
          <div class="fix-q">“Finance reports a nine-day close; <mark>Jim in Finance</mark> described the process as manual.”</div>
          <div class="fix-a"><span class="muted fs12">Suggest</span><span class="sugg">a finance team member</span><span class="btn sm" style="margin-left:auto"><i class="fa-solid fa-check"></i>Apply</span></div>
        </div>
      </div>

      <div class="m-sec">
        <div class="fw7 fs13" style="margin-bottom:8px">Note to Northwind <span class="muted fw5">(sent with the notification)</span></div>
        <div class="textarea" style="height:62px">Synthesis from all 18 interviews — we’ll walk through it together on Thursday.</div>
        <div class="effects">
          <div class="eff"><span class="switch on"></span><span>Notify the 6 people at Northwind</span></div>
          <div class="eff"><i class="fa-solid fa-wand-magic-sparkles"></i><span>The Assistant can quote it in chats that include Northwind</span></div>
          <div class="eff"><i class="fa-solid fa-signature"></i><span>Recorded as shared by <b>Ada Lovell</b> today at 10:14 AM. You can move it back to Team; a sent notification can’t be recalled.</span></div>
        </div>
      </div>
    </div>

    <div class="m-f">
      <span class="btn primary"><i class="fa-solid fa-check"></i>Apply 2 fixes and share</span>
      <span class="btn">Share as is</span>
      <span class="btn ghost" style="margin-left:auto">Cancel</span>
    </div>
  </div>`;
  const body = `<div class="shell" style="position:relative">${topbar()}<div class="body">${navStaff('discovery')}${libraryMain()}</div>${modal}</div>`;
  const css = sharedCss + libraryCss + `
  .m-h { display: flex; align-items: flex-start; gap: 14px; padding: 20px 22px 16px; border-bottom: 1px solid var(--mj-border-default); }
  .m-ic { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: var(--mjc-shared-strong); color: var(--mjc-on-strong); font-size: 16px; }
  .m-b { padding: 16px 22px 6px; display: flex; flex-direction: column; gap: 14px; }
  .pgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
  .pp { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border: 1px solid var(--mjc-shared-border); background: var(--mjc-shared-bg); border-radius: 10px; min-width: 0; }
  .pp.more { background: var(--mj-bg-surface); border-style: dashed; }
  .review { border: 1px solid color-mix(in srgb, var(--mj-status-warning) 40%, transparent); background: linear-gradient(180deg, var(--mj-status-warning-bg), var(--mj-bg-surface)); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .fix { background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); border-radius: 10px; padding: 10px 12px; }
  .fix-q { font-size: 13px; color: var(--mj-text-secondary); font-family: Georgia, 'DejaVu Serif', serif; }
  .fix-q mark { background: color-mix(in srgb, var(--mj-status-warning) 35%, transparent); color: var(--mj-text-primary); border-radius: 3px; padding: 0 2px; text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--mj-status-error) 70%, transparent); }
  .fix-a { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .sugg { font-size: 12.5px; font-weight: 600; color: var(--mj-status-success-text); background: var(--mj-status-success-bg); border: 1px solid color-mix(in srgb, var(--mj-status-success) 35%, transparent); padding: 2px 8px; border-radius: 6px; }
  .effects { display: flex; flex-direction: column; gap: 9px; margin-top: 8px; }
  .eff { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--mj-text-secondary); }
  .eff > i { width: 34px; text-align: center; color: var(--mj-text-muted); }
  .eff b { color: var(--mj-text-primary); font-weight: 600; }
  .m-f { display: flex; gap: 10px; padding: 14px 22px 16px; border-top: 1px solid var(--mj-border-default); background: var(--mj-bg-surface-card); margin-top: 6px; }
  `;
  return page({ title: 'Share with Northwind', css, body });
}
