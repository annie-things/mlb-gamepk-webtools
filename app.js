const BR_TO_MLBID = {
  ARI:109, ATL:144, BAL:110, BOS:111, CHC:112, CHW:145, CIN:113, CLE:114,
  COL:115, DET:116, HOU:117, KCR:118, LAA:108, LAD:119, MIA:146, MIL:158,
  MIN:142, NYM:121, NYY:147, OAK:133, PHI:143, PIT:134, SDP:135, SEA:136,
  SFG:137, STL:138, TBR:139, TEX:140, TOR:141, WSN:120,
  FLA:146, MON:120, ANA:108, TBD:139, CAL:108, KCA:118,
};

const form = document.getElementById('f');
const input = document.getElementById('brid');
const out = document.getElementById('out');

function show(html, isErr) {
  out.className = isErr ? 'err' : '';
  out.innerHTML = html;
}

function parseBRID(raw) {
  const id = raw.trim().toUpperCase();
  const m = id.match(/^([A-Z]{2,3})(\d{4})(\d{2})(\d{2})(\d)$/);
  if (!m) throw new Error('ID must look like MIN200910060 (3-letter team + YYYYMMDD + game number).');
  const [, team, y, mo, d, gameNum] = m;
  if (!(team in BR_TO_MLBID)) throw new Error(`Unknown team code "${team}".`);
  return { team, mlbId: BR_TO_MLBID[team], date: `${y}-${mo}-${d}`, gameNum: Number(gameNum) };
}

async function lookup(raw) {
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

  const away = game.teams.away.team.name;
  const home = game.teams.home.team.name;
  show(`
    <div class="pk"><code>${game.gamePk}</code></div>
    <div class="meta">${away} @ ${home} — ${date}${game.gameNumber > 1 ? ` (game ${game.gameNumber})` : ''}</div>
    <div class="meta"><a href="https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live" target="_blank" rel="noopener">live feed JSON</a></div>
  `);
}

form.addEventListener('submit', e => {
  e.preventDefault();
  lookup(input.value).catch(err => show(err.message, true));
});
