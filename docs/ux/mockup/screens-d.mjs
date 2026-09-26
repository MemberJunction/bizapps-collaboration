import { SPARK, av, ai, shared, team, tile, page, sharedCss } from './lib.mjs';

/* ============================== 00 THE IDEA, ON ONE PAGE ============================== */
export function concept() {
  const chatRow = (icon, band, name, who, t, s) => `
    <div class="cr ${band}">
      <span class="cr-ic">${icon}</span>
      <div class="grow"><div class="fw7 fs13.5">${name}</div><div class="fs12 muted">${who}</div></div>
      <span class="use ${t ? 'y' : 'n'}"><i class="fa-solid fa-lock"></i>Team <i class="fa-solid ${t ? 'fa-check' : 'fa-xmark'} mk"></i></span>
      <span class="use s ${s ? 'y' : 'n'}"><i class="fa-solid fa-eye"></i>Shared <i class="fa-solid ${s ? 'fa-check' : 'fa-xmark'} mk"></i></span>
    </div>`;
  const pr = (n, icon, title, text) => `<div class="pr"><div class="pr-top"><span class="pr-n">${n}</span><i class="fa-solid ${icon}"></i></div><div class="fw7 fs14" style="margin-top:10px">${title}</div><div class="fs12.5 secondary" style="margin-top:4px;line-height:1.5">${text}</div></div>`;
  const body = `
  <div class="cv">
    <div class="cv-h">
      <div class="row gap10"><span class="mjmark"></span><span class="eyebrow" style="color:var(--mj-brand-primary)">Collaboration · UX concept</span></div>
      <div class="cv-title">One space, two sides, and an assistant that knows who’s in the room</div>
    </div>

    <div class="panels">
      <section class="panel">
        <div class="p-h"><span class="p-n">A</span><div><div class="fw7 fs15">Every space has two sides</div><div class="fs12.5 muted">The firm’s working set, and what the client sees. Everyone always knows which is which.</div></div></div>
        <div class="dia">
          <div class="side left">
            <div class="ppl-col">${av('ada', 'md')}${av('sam', 'md')}${av('priya', 'md')}</div>
            <div class="fw7 fs13" style="margin-top:8px">Meridian</div><div class="fs11 muted">staff · 3</div>
          </div>
          <div class="spacebox">
            <div class="sb-h">${tile('eng', 'fa-compass', 'sm')}<b>Discovery</b><span class="fs11 muted" style="margin-left:auto">one space</span></div>
            <div class="band-t"><div class="row gap6">${team('Team')}<span class="fs12 muted">15 items</span></div><div class="fs12 secondary" style="margin-top:6px">Drafts, interview notes, scoring model</div></div>
            <div class="promote"><span class="pm-arrow"><i class="fa-solid fa-arrow-down"></i></span><span class="fs11.5"><b>Share…</b> checked for names and prices, recorded with who and when</span></div>
            <div class="band-s"><div class="row gap6">${shared('Shared')}<span class="fs12" style="color:var(--mjc-shared)">9 items</span></div><div class="fs12 secondary" style="margin-top:6px">Readout draft, process map, site photos</div></div>
          </div>
          <div class="side right">
            <div class="ppl-col">${av('casey', 'md')}${av('lena', 'md')}${av('bea', 'md')}</div>
            <div class="fw7 fs13" style="margin-top:8px;color:var(--mjc-shared)">Northwind</div><div class="fs11 muted">client · 6</div>
          </div>
          <svg class="wires" width="618" height="290" viewBox="0 0 618 290">
            <path d="M110 138 C 150 138, 140 84, 178 84" class="w staff"/>
            <path d="M110 138 C 150 138, 140 230, 178 230" class="w staff"/>
            <path d="M511 138 C 471 138, 492 230, 462 230" class="w client"/>
            <path d="M511 138 C 471 138, 492 84, 462 84" class="w blocked"/>
          </svg>
          <span class="xmark"><i class="fa-solid fa-xmark"></i></span>
        </div>
      </section>

      <section class="panel">
        <div class="p-h"><span class="p-n">B</span><div><div class="fw7 fs15">One assistant, bounded by the chat</div><div class="fs12.5 muted">It uses only what <b>everyone</b> in the chat can open, re-checked on every answer.</div></div></div>
        <div class="crs">
          ${chatRow(`<span class="ai-av sm">${SPARK}</span>`, 'priv', 'You + Assistant', 'Ada alone', true, true)}
          ${chatRow('<i class="fa-solid fa-lock"></i>', 'team', 'Meridian team', 'Ada, Sam, Priya', true, true)}
          ${chatRow('<i class="fa-solid fa-eye"></i>', 'shared', 'Ada + Casey', 'Casey is from Northwind', false, true)}
          ${chatRow('<i class="fa-solid fa-eye"></i>', 'shared', 'Discovery room', 'All 9, including Northwind', false, true)}
        </div>
        <div class="rule-note"><span class="ai-av sm">${SPARK}</span><span>One firm-wide assistant. Each space adds its own notes (“Northwind calls them DCs”) and chooses its skills. A reply goes to the chat it was asked in, and shows what it used.</span></div>
      </section>
    </div>

    <div class="prs">
      ${pr(1, 'fa-eye', 'Audience always visible', 'Spaces, files, chats and even the message box say who will see it.')}
      ${pr(2, 'fa-shield-halved', 'Crossing sides is deliberate', 'Moving work to Shared is checked by the Assistant and recorded. It is never a side effect.')}
      ${pr(3, 'fa-sitemap', 'Structure that carries', 'Client → engagement → sub-space. People, notes and retention flow down unless a space is sealed.')}
      ${pr(4, 'fa-mug-hot', 'Clients get a calm portal', 'What’s waiting, what’s new, what’s shared. None of the firm’s internal clutter.')}
      ${pr(5, 'fa-puzzle-piece', 'Built from MJ parts', 'Chat is MJ Conversations, work is Tasks. Apps like Committees plug in on top. MJ tokens, light and dark.')}
    </div>
    <div class="idx">
      <span class="eyebrow">In this set</span>
      ${['Home', 'Overview', 'Library', 'Share check', 'Room chat', 'People', 'Client home', 'Committee', 'Assistant', 'Work', 'Dark mode', 'Mobile', 'New space'].map((t, i) => `<span class="ix"><b>${String(i + 1).padStart(2, '0')}</b>${t}</span>`).join('')}
    </div>
  </div>`;
  const css = sharedCss + `
  body { background: radial-gradient(1100px 520px at 12% -8%, color-mix(in srgb, var(--mj-brand-primary) 10%, var(--mj-bg-page)), var(--mj-bg-page)); }
  .cv { height: 900px; padding: 40px 48px; display: flex; flex-direction: column; gap: 24px; }
  .mjmark { width: 30px; height: 17px; background: url('../assets/mj-mark.svg') center/contain no-repeat; }
  .cv-title { font-size: 30px; font-weight: 750; letter-spacing: -.02em; margin-top: 8px; max-width: 980px; line-height: 1.2; }
  .panels { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .panel { background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); border-radius: 18px; box-shadow: var(--mj-shadow-md); padding: 20px 22px; }
  .p-h { display: flex; gap: 12px; align-items: flex-start; }
  .p-n { width: 26px; height: 26px; border-radius: 8px; display: inline-grid; place-items: center; background: var(--mj-brand-secondary); color: var(--mj-brand-on-secondary); font-weight: 800; font-size: 13px; flex: none; margin-top: 1px; }
  .fs13\\.5 { font-size: 13.5px; } .fs11\\.5 { font-size: 11.5px; }
  .dia { position: relative; width: 618px; height: 290px; margin: 18px auto 0; }
  .side { position: absolute; top: 122px; width: 118px; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .side.left { left: 0; } .side.right { right: 0; }
  .ppl-col { display: flex; gap: 0; }
  .ppl-col .av + .av { margin-left: -6px; }
  .ppl-col .av { box-shadow: 0 0 0 2px var(--mj-bg-surface); }
  .ppl-col .av.ext { box-shadow: 0 0 0 1.5px var(--mj-bg-surface), 0 0 0 3px var(--mjc-shared-strong); }
  .spacebox { position: absolute; left: 178px; width: 284px; top: 0; height: 284px; border: 1.5px solid var(--mj-border-strong); border-radius: 16px; padding: 10px; display: flex; flex-direction: column; gap: 0; background: var(--mj-bg-surface-card); z-index: 1; }
  .sb-h { display: flex; align-items: center; gap: 7px; font-size: 13px; padding: 0 4px; height: 30px; flex: none; }
  .band-t { flex: none; border-radius: 11px; padding: 12px; background: repeating-linear-gradient(135deg, var(--mjc-team-bg) 0 7px, var(--mj-bg-surface) 7px 14px); border: 1px solid var(--mjc-team-border); height: 88px; }
  .band-s { flex: none; border-radius: 11px; padding: 12px; background: var(--mjc-shared-bg); border: 1px solid var(--mjc-shared-border); height: 88px; }
  .promote { flex: none; height: 58px; display: flex; align-items: center; gap: 8px; padding: 0 6px; color: var(--mj-text-secondary); line-height: 1.35; }
  .promote b { color: var(--mjc-shared); }
  .pm-arrow { width: 24px; height: 24px; border-radius: 99px; background: var(--mjc-shared-strong); color: var(--mjc-on-strong); display: grid; place-items: center; font-size: 11px; flex: none; }
  .wires { position: absolute; left: 0; top: 0; overflow: visible; }
  .w { fill: none; stroke-width: 2.2; }
  .w.staff { stroke: var(--mj-text-disabled); }
  .w.client { stroke: var(--mjc-shared-strong); }
  .w.blocked { stroke: var(--mj-border-strong); stroke-dasharray: 4 5; }
  .xmark { position: absolute; left: 476px; top: 96px; width: 22px; height: 22px; border-radius: 99px; background: var(--mj-bg-surface); border: 1.5px solid var(--mj-status-error); color: var(--mj-status-error); display: grid; place-items: center; font-size: 10px; z-index: 2; }
  .crs { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
  .cr { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mj-border-default); }
  .cr.shared { border-color: var(--mjc-shared-border); background: color-mix(in srgb, var(--mjc-shared-bg) 55%, var(--mj-bg-surface)); }
  .cr-ic { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 12px; color: var(--mj-text-secondary); background: var(--mj-bg-surface-sunken); flex: none; }
  .cr.shared .cr-ic { color: var(--mjc-on-strong); background: var(--mjc-shared-strong); }
  .cr.priv .cr-ic { background: transparent; }
  .use { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px; border-radius: 99px; font-size: 12px; font-weight: 650; border: 1px solid; }
  .use i { font-size: 10px; }
  .use .mk { font-size: 11px; margin-left: 2px; }
  .use.y { color: var(--mjc-team); background: var(--mjc-team-bg); border-color: var(--mjc-team-border); }
  .use.s.y { color: var(--mjc-shared); background: var(--mjc-shared-bg); border-color: var(--mjc-shared-border); }
  .use.n { color: var(--mj-text-disabled); background: transparent; border-color: var(--mj-border-default); border-style: dashed; }
  .use.n .mk { color: var(--mj-status-error); }
  .rule-note { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--mj-brand-primary) 6%, var(--mj-bg-surface)); font-size: 12.5px; color: var(--mj-text-secondary); line-height: 1.5; }
  .prs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
  .pr { background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); border-radius: 14px; padding: 14px 16px; }
  .pr-top { display: flex; align-items: center; justify-content: space-between; }
  .pr-top i { color: var(--mj-brand-primary); font-size: 15px; }
  .pr-n { font-size: 12px; font-weight: 800; color: var(--mj-text-muted); }
  .idx { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 8px; margin-top: 2px; }
  .idx .eyebrow { margin-right: 6px; }
  .ix { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 99px; background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); font-size: 12px; font-weight: 600; color: var(--mj-text-secondary); }
  .ix b { color: var(--mj-brand-primary); font-weight: 750; font-size: 11px; }
  `;
  return page({ title: 'Collaboration — concept', css, body });
}
