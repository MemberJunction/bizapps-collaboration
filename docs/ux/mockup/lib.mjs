// Shared building blocks for the Collaboration mockups.

export const SPARK = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/><path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/></svg>`;

export const P = {
  ada:   { n: 'Ada Lovell',     i: 'AL', c: 'c1', role: 'Engagement lead',   org: 'Meridian' },
  sam:   { n: 'Sam Okafor',     i: 'SO', c: 'c9', role: 'Senior consultant', org: 'Meridian' },
  priya: { n: 'Priya Shah',     i: 'PS', c: 'c6', role: 'Analyst',           org: 'Meridian' },
  casey: { n: 'Casey Morgan',   i: 'CM', c: 'c4', role: 'VP Operations',     org: 'Northwind', ext: true },
  bea:   { n: 'Bea Tanaka',     i: 'BT', c: 'c5', role: 'Operations analyst', org: 'Northwind', ext: true },
  omar:  { n: 'Omar Haddad',    i: 'OH', c: 'c3', role: 'Plant director, Dayton', org: 'Northwind', ext: true },
  lena:  { n: 'Lena Fischer',   i: 'LF', c: 'c2', role: 'CFO',               org: 'Northwind', ext: true },
  jordan:{ n: 'Jordan Lee',     i: 'JL', c: 'c8', role: 'Procurement lead',  org: 'Northwind', ext: true },
  remy:  { n: 'Remy Chen',      i: 'RC', c: 'c7', role: 'Former analyst',    org: 'Northwind', ext: true },
  mia:   { n: 'Mia Torres',     i: 'MT', c: 'c6', role: 'Finance analyst',   org: 'Northwind', ext: true },
  ravi:  { n: 'Ravi Patel',     i: 'RP', c: 'c3', role: 'IT lead',           org: 'Northwind', ext: true },
  dana:  { n: 'Dana Whitfield', i: 'DW', c: 'c10', role: 'Outside director', org: 'Independent', ext: true },
  pat:   { n: 'Pat Rivera',     i: 'PR', c: 'c8', role: 'Outside director',  org: 'Independent', ext: true },
  ken:   { n: 'Ken Mori',       i: 'KM', c: 'c2', role: 'Outside director',  org: 'Independent', ext: true },
  ruth:  { n: 'Ruth Alvarez',   i: 'RA', c: 'c5', role: 'Director',          org: 'Board' },
  marg:  { n: 'Margaret Cole',  i: 'MC', c: 'c6', role: 'Committee chair',   org: 'Board' },
  tom:   { n: 'Tom Reyes',      i: 'TR', c: 'c3', role: 'Director',          org: 'Board' },
  lee:   { n: 'Lee Park',       i: 'LP', c: 'c2', role: 'Learner',           org: 'Cohort', ext: true },
};

export function av(key, size = '', extra = '') {
  const p = P[key];
  return `<span class="av ${p.c} ${size} ${p.ext ? 'ext' : ''} ${extra}" title="${p.n}">${p.i}</span>`;
}
export function avp(key, size = '') { // with presence dot
  const p = P[key];
  return `<span class="av ${p.c} ${size} ${p.ext ? 'ext' : ''}">${p.i}<span class="presence"></span></span>`;
}
export function stack(keys, size = 'sm', more = '') {
  return `<span class="stack">${keys.map((k) => av(k, size)).join('')}${more ? `<span class="more">${more}</span>` : ''}</span>`;
}
export const ai = (size = '') => `<span class="ai-av ${size}">${SPARK}</span>`;
export const shared = (label = 'Shared') => `<span class="chip shared"><i class="fa-solid fa-eye"></i>${label}</span>`;
export const team = (label = 'Team') => `<span class="chip team"><i class="fa-solid fa-lock"></i>${label}</span>`;
export const chip = (cls, icon, label) => `<span class="chip ${cls}">${icon ? `<i class="${icon}"></i>` : ''}${label}</span>`;
export const fileIcon = (kind, size = '') => {
  const map = { pdf: 'fa-file-pdf', doc: 'fa-file-word', xls: 'fa-file-excel', ppt: 'fa-file-powerpoint', img: 'fa-images', txt: 'fa-file-lines', zip: 'fa-folder' };
  return `<span class="fi ${kind} ${size}"><i class="fa-solid ${map[kind] || 'fa-file'}"></i></span>`;
};
export const tile = (type, icon, size = '') => `<span class="tile ${type} ${size}"><i class="fa-solid ${icon}"></i></span>`;

export function page({ title, theme = 'light', width = 1440, height = 900, css = '', body }) {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<!-- Font Awesome 6.5.2: the exact file MJ Explorer loads (packages/MJExplorer/src/index.html). -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="../base.css">
<style>
body { width: ${width}px; height: ${height}px; }
${css}
</style>
</head>
<body>${body}</body>
</html>`;
}

export function topbar({ user = 'ada', notif = true } = {}) {
  return `<header class="topbar">
  <span class="mark"></span>
  <span class="app-pill"><i class="fa-solid fa-people-roof"></i>Collaboration<i class="fa-solid fa-chevron-down caret"></i></span>
  <span class="spacer"></span>
  <span class="search"><i class="fa-solid fa-magnifying-glass"></i>Search everything…<span class="kbd">⌘K</span></span>
  <span class="icon-btn"><i class="fa-regular fa-bell"></i>${notif ? '<span class="dot"></span>' : ''}</span>
  ${av(user, 'md')}
</header>`;
}

// Staff navigation (Ada)
export function navStaff(active = '') {
  const it = (key, icon, label, count = '', hot = false) =>
    `<div class="nav-item ${active === key ? 'active' : ''}"><i class="fa-solid ${icon}"></i>${label}${count ? `<span class="count ${hot ? 'hot' : ''}">${count}</span>` : ''}</div>`;
  const tr = (key, lvl, type, icon, label, meta = '', opts = {}) =>
    `<div class="tree-item ${lvl} ${active === key ? 'active' : ''} ${opts.dim ? 'dim' : ''}">
      <span class="chev">${opts.chev ? `<i class="fa-solid fa-chevron-${opts.chev}"></i>` : ''}</span>
      ${tile(type, icon, 'sm')}<span class="ellipsis">${label}</span>${meta}</div>`;
  return `<nav class="appnav">
  <div class="jump"><i class="fa-solid fa-magnifying-glass"></i>Jump to a space<span class="kbd">⌘J</span></div>
  ${it('home', 'fa-house', 'Home')}
  ${it('inbox', 'fa-inbox', 'Inbox', '4', true)}
  ${it('tasks', 'fa-list-check', 'My tasks', '6')}
  ${it('files', 'fa-folder-open', 'Recent files')}
  <div class="nav-section">Spaces <i class="fa-solid fa-plus"></i></div>
  ${tr('northwind', '', 'rel', 'fa-building', 'Northwind', '', { chev: 'down' })}
  ${tr('discovery', 'l1', 'eng', 'fa-compass', 'Discovery', '<span class="unread"></span>', { chev: 'down' })}
  ${tr('fieldnotes', 'l2', 'eng', 'fa-clipboard', 'Field notes')}
  ${tr('delivery', 'l1', 'eng', 'fa-truck-fast', 'Delivery', '<span class="meta"><i class="fa-solid fa-lock"></i></span>', { chev: 'right' })}
  ${tr('closed', 'l1', 'eng', 'fa-box-archive', 'Closed', '<span class="meta">2</span>', { dim: true, chev: 'right' })}
  ${tr('committee', '', 'com', 'fa-landmark', 'Audit Committee', '<span class="unread"></span>', { chev: 'right' })}
  ${tr('cohort', '', 'coh', 'fa-graduation-cap', 'Spring Leadership Cohort', '', { chev: 'right' })}
  ${tr('pinecrest', '', 'rel', 'fa-building', 'Pinecrest Health', '', { chev: 'right' })}
  ${tr('studio', '', 'wks', 'fa-shapes', 'Studio', '', { chev: 'right' })}
  <div class="nav-footer">
    ${it('assistant', 'fa-wand-magic-sparkles', 'Assistant')}
    ${it('settings', 'fa-gear', 'Space types & settings')}
  </div>
</nav>`;
}

// Outside participant navigation (Casey, Dana)
export function navGuest({ active = '', who = 'casey' } = {}) {
  const it = (key, icon, label, count = '') =>
    `<div class="nav-item ${active === key ? 'active' : ''}"><i class="fa-solid ${icon}"></i>${label}${count ? `<span class="count hot">${count}</span>` : ''}</div>`;
  const tr = (key, lvl, type, icon, label, meta = '', chevv = '') =>
    `<div class="tree-item ${lvl} ${active === key ? 'active' : ''}"><span class="chev">${chevv ? `<i class="fa-solid fa-chevron-${chevv}"></i>` : ''}</span>${tile(type, icon, 'sm')}<span class="ellipsis">${label}</span>${meta}</div>`;
  const spaces = who === 'dana'
    ? tr('committee', '', 'com', 'fa-landmark', 'Audit Committee', '<span class="unread"></span>')
    : `${tr('northwind', '', 'rel', 'fa-building', 'Northwind', '', 'down')}
       ${tr('discovery', 'l1', 'eng', 'fa-compass', 'Discovery', '<span class="unread"></span>', 'down')}
       ${tr('delivery', 'l1', 'eng', 'fa-truck-fast', 'Delivery', '<span class="meta">Oct 20</span>')}`;
  return `<nav class="appnav">
  ${it('home', 'fa-house', 'Home')}
  ${it('inbox', 'fa-inbox', 'Inbox', who === 'dana' ? '1' : '2')}
  ${it('tasks', 'fa-list-check', 'My tasks', who === 'dana' ? '' : '3')}
  <div class="nav-section">Your spaces</div>
  ${spaces}
  <div class="nav-footer">
    <div class="org-card">
      <div class="row gap8"><span class="firm-mark">M</span><div><div class="fw6 fs13">Meridian Advisory</div><div class="fs12 muted">${who === 'dana' ? 'Board portal' : 'Your team is online'}</div></div></div>
    </div>
  </div>
</nav>`;
}

export function spaceHeader({
  crumbs = ['Spaces', 'Northwind', 'Discovery'], type = 'eng', icon = 'fa-compass', name = 'Discovery',
  kind = 'Engagement', status = '<span class="chip ok"><i class="fa-solid fa-circle" style="font-size:6px"></i>Active</span>',
  sub = 'Supply-chain operating model diagnostic<span class="dotsep"></span>Week 7 of 10<span class="dotsep"></span>Readout Oct 9',
  tabs = [], activeTab = 'Overview', actions = '', audience = '',
}) {
  const crumbHtml = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span><i class="fa-solid fa-chevron-right"></i>`)).join('');
  const tabHtml = tabs.map(([label, ic, count]) => `<span class="tab ${label === activeTab ? 'active' : ''}"><i class="fa-solid ${ic}"></i>${label}${count ? `<span class="c">${count}</span>` : ''}</span>`).join('');
  return `<section class="space-head">
  <div class="crumbs">${crumbHtml}</div>
  <div class="top" style="margin-top:10px">
    ${tile(type, icon, 'xl')}
    <div class="grow">
      <div class="title-row"><h1 class="h1">${name}</h1><span class="chip plain">${kind}</span>${status}</div>
      <div class="sub">${sub}</div>
    </div>
    <div class="actions">${audience}${actions}</div>
  </div>
  <div class="tabs">${tabHtml}</div>
</section>`;
}

export const discoveryTabs = [
  ['Overview', 'fa-gauge-high'], ['Library', 'fa-folder-open', '24'], ['Work', 'fa-list-check', '10'],
  ['Chat', 'fa-comments', '3'], ['People', 'fa-user-group', '9'], ['Settings', 'fa-sliders'],
];

export function audienceChip() {
  return `<div class="aud">
    <span class="stack">${av('ada', 'sm')}${av('sam', 'sm')}${av('priya', 'sm')}</span>
    <span class="aud-div"></span>
    <span class="stack">${av('casey', 'sm')}${av('bea', 'sm')}${av('omar', 'sm')}${av('lena', 'sm')}</span>
    <span class="aud-t"><b>9 people</b><span>3 Meridian · 6 Northwind</span></span>
  </div>`;
}

export const sharedCss = `
.aud { display: flex; align-items: center; gap: 10px; padding: 4px 12px 4px 6px; border: 1px solid var(--mj-border-default); border-radius: 99px; background: var(--mj-bg-surface); height: 38px; margin-right: 4px; }
.aud-div { width: 1px; height: 18px; background: var(--mj-border-default); }
.aud-t { display: flex; flex-direction: column; line-height: 1.15; }
.aud-t b { font-size: 12.5px; font-weight: 650; }
.aud-t span { font-size: 11px; color: var(--mj-text-muted); }
.org-card { padding: 10px; border: 1px solid var(--mj-border-default); border-radius: 12px; background: var(--mj-bg-surface-card); }
.firm-mark { width: 30px; height: 30px; border-radius: 8px; display: inline-grid; place-items: center; font-weight: 800; color: var(--mj-brand-on-secondary); background: linear-gradient(135deg, var(--mj-brand-secondary), var(--mj-brand-primary)); font-size: 14px; }
`;
