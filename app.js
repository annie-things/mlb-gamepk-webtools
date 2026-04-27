const BR_TO_MLBID = {
  ARI:109, ATL:144, BAL:110, BOS:111, CHC:112, CHW:145, CIN:113, CLE:114,
  COL:115, DET:116, HOU:117, KCR:118, LAA:108, LAD:119, MIA:146, MIL:158,
  MIN:142, NYM:121, NYY:147, OAK:133, PHI:143, PIT:134, SDP:135, SEA:136,
  SFG:137, STL:138, TBR:139, TEX:140, TOR:141, WSN:120,
  FLA:146, MON:120, ANA:108, TBD:139, CAL:108, KCA:118,
};

const GAME_TYPE = {
  R:'Regular', F:'Wild Card', D:'Division', L:'LCS', W:'World Series',
  S:'Spring', A:'All-Star', E:'Exhibition', P:'Playoff',
};

const out = document.getElementById('out');

function show(html, isErr) {
  out.className = isErr ? 'err' : '';
  out.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function tvUrl(pk) {
  return `https://www.mlb.com/tv/g${pk}`;
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers / non-HTTPS
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = orig; }, 1200);
  }
}

// --- Tabs ---
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${btn.dataset.panel}`);
    });
    show('Pick a mode and submit.');
  });
});

// --- BR ID lookup ---
function parseBRID(raw) {
  const id = raw.trim().toUpperCase();
  const m = id.match(/^([A-Z]{2,3})(\d{4})(\d{2})(\d{2})(\d)$/);
  if (!m) throw new Error('ID must look like MIN200910060 (3-letter team + YYYYMMDD + game number).');
  const [, team, y, mo, d, gameNum] = m;
  if (!(team in BR_TO_MLBID)) throw new Error(`Unknown team code "${team}".`);
  return { team, mlbId: BR_TO_MLBID[team], date: `${y}-${mo}-${d}`, gameNum: Number(gameNum) };
}

async function lookupBRID(raw) {
  const { team, mlbId, date, gameNum } = parseBRID(raw);
  show('Looking up…');
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&teamId=${mlbId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB API returned HTTP ${res.status}.`);
  const data = await res.json();
  const games = (data.dates?.[0]?.games ?? []).filter(g => g.teams.home.team.id === mlbId);
  if (!games.length) throw new Error(`No games found for ${team} as home team on ${date}.`);

  const wantNum = gameNum + 1;
  const game = games.find(g => g.gameNumber === wantNum) ?? (games.length === 1 ? games[0] : null);
  if (!game) {
    const list = games.map(g => `game ${g.gameNumber} → ${g.gamePk}`).join(', ');
    throw new Error(`Couldn't disambiguate. Candidates: ${list}.`);
  }

  const away = escapeHtml(game.teams.away.team.name);
  const home = escapeHtml(game.teams.home.team.name);
  show(`
    <div class="pk"><code>${game.gamePk}</code></div>
    <div class="meta">${away} @ ${home} — ${date}${game.gameNumber > 1 ? ` (game ${game.gameNumber})` : ''}</div>
    <div class="meta">
      <a href="${tvUrl(game.gamePk)}" target="_blank" rel="noopener">MLB.tv</a>
      &middot;
      <a href="https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live" target="_blank" rel="noopener">live feed JSON</a>
    </div>
  `);
}

// --- Date list ---
async function listDate(date) {
  show('Loading…');
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB API returned HTTP ${res.status}.`);
  const data = await res.json();
  const games = data.dates?.[0]?.games ?? [];
  if (!games.length) {
    show(`No MLB games on ${date}.`);
    return;
  }

  const rows = games.map(g => {
    const away = escapeHtml(g.teams.away.team.name);
    const home = escapeHtml(g.teams.home.team.name);
    const status = escapeHtml(g.status?.detailedState ?? '');
    const type = GAME_TYPE[g.gameType] ?? g.gameType ?? '';
    const dh = g.gameNumber > 1 ? ` (g${g.gameNumber})` : '';
    return `
      <tr>
        <td class="pkcell">${g.gamePk}</td>
        <td>${away} @ ${home}${dh}</td>
        <td class="tag">${escapeHtml(type)}</td>
        <td class="tag">${status}</td>
        <td>
          <a class="tvlink" href="${tvUrl(g.gamePk)}" target="_blank" rel="noopener">Watch</a>
          <button type="button" class="copybtn" data-pk="${g.gamePk}">Copy</button>
        </td>
      </tr>
    `;
  }).join('');

  const allUrls = games.map(g => tvUrl(g.gamePk)).join('\n');

  show(`
    <div class="meta" style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
      <span>${games.length} game${games.length === 1 ? '' : 's'} on ${date}</span>
      <button type="button" id="copy-all" data-urls="${escapeHtml(allUrls)}">Copy all MLB.tv links</button>
    </div>
    <table>
      <thead><tr><th>game_pk</th><th>matchup</th><th>type</th><th>status</th><th>MLB.tv</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);

  // Wire up copy buttons after rendering
  out.querySelectorAll('.copybtn').forEach(b => {
    b.addEventListener('click', () => copyText(tvUrl(b.dataset.pk), b));
  });
  const all = out.querySelector('#copy-all');
  if (all) {
    all.addEventListener('click', () => copyText(all.dataset.urls.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'), all));
  }
}

// --- Form handlers ---
document.getElementById('f-brid').addEventListener('submit', e => {
  e.preventDefault();
  lookupBRID(document.getElementById('brid').value).catch(err => show(escapeHtml(err.message), true));
});

document.getElementById('f-date').addEventListener('submit', e => {
  e.preventDefault();
  const date = document.getElementById('date').value;
  if (!date) return;
  listDate(date).catch(err => show(escapeHtml(err.message), true));
});

document.getElementById('date').value = new Date().toISOString().slice(0, 10);
