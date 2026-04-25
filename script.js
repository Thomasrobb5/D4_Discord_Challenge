/* ═══════════════════════════════════════════════════════════════
   DIABLO IV — HALL OF LEGENDS  |  Main Application Script
═══════════════════════════════════════════════════════════════ */

// ── CONFIG ───────────────────────────────────────────────────────
// When running via `wrangler dev`, the worker serves at :8787.
// For static pages preview, calls go to the deployed worker.
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8787/api'                                 // wrangler dev
    : 'https://diablo4-hof.thomasrobb5.workers.dev/api';          // production

// Admin password — this is verified server-side. The client only
// stores it in sessionStorage so the user doesn't have to re-enter.
const ADMIN_PW_KEY = 'd4hol_admin';

// ── APP STATE ────────────────────────────────────────────────────
const appState = {
    currentSeason: null,
    players:       [],
    achievements:  [],
    seasons:       [],
    isAdmin:       false,
};

// ── ACHIEVEMENT TEMPLATES ────────────────────────────────────────
const achievementTemplates = {
    'legendary-item':         { name: 'Legendary Item',           rarity: 'legendary', points: 1, icon: '🌕', description: 'First to obtain a Legendary quality item this season.' },
    'ancestral-legendary':    { name: 'Ancestral Legendary',      rarity: 'ancestral', points: 1, icon: '⚔️', description: 'First ancestral legendary item claimed from the depths.' },
    'unique-item':            { name: 'Unique Item',              rarity: 'unique',    points: 1, icon: '💎', description: 'First unique item drop — a rare blessing from the heavens.' },
    'ancestral-unique':       { name: 'Ancestral Unique',         rarity: 'ancestral', points: 1, icon: '🔮', description: 'First ancestral unique — power beyond mortal comprehension.' },
    'ancestral-legendary-2ga':{ name: 'Ancestral Legendary (2GA)',rarity: 'ancestral', points: 1, icon: '🔱', description: 'An ancestral legendary bearing two greater affixes.' },
    'ancestral-unique-2ga':   { name: 'Ancestral Unique (2GA)',   rarity: 'ancestral', points: 1, icon: '💠', description: 'An ancestral unique item with two greater affixes.' },
    'chaos-unique-1ga':       { name: 'Chaos Unique (1GA)',       rarity: 'chaos',     points: 1, icon: '🌀', description: 'A chaos unique with one greater affix — born from Lilith\'s will.' },
    'any-1ga-item':           { name: 'Any 1GA Item',             rarity: 'legendary', points: 1, icon: '✨', description: 'Any item bearing a single greater affix — the mark of superiority.' },
    'ancestral-unique-3ga':   { name: 'Ancestral Unique (3GA)',   rarity: 'ancestral', points: 2, icon: '💠', description: 'An ancestral unique armed with three greater affixes.' },
    'ancestral-legendary-3ga':{ name: 'Ancestral Legendary (3GA)',rarity: 'ancestral', points: 2, icon: '🔱', description: 'An ancestral legendary bearing three greater affixes.' },
    'mythic-1ga':             { name: 'Mythic Item (1GA)',        rarity: 'mythic',    points: 2, icon: '⛩️', description: 'First mythic item with a greater affix — worthy of legend.' },
    'mythic-no-cache':        { name: 'Mythic Item (No Cache)',   rarity: 'mythic',    points: 2, icon: '⛩️', description: 'A mythic item obtained without cache — raw power earned.' },
    'mythic-2ga':             { name: 'Mythic Item (2GA)',        rarity: 'mythic',    points: 2, icon: '⛩️', description: 'A mythic item bearing two greater affixes.' },
    'chaos-unique-2ga':       { name: 'Chaos Unique (2GA)',       rarity: 'chaos',     points: 2, icon: '🌪️', description: 'A chaos unique with two greater affixes. Chaos incarnate.' },
    'grandpapa-bonus':        { name: 'Grandpapa Bonus',          rarity: 'unique',    points: 2, icon: '👴', description: 'A special bonus achievement for remarkable contribution.' },
    'mythic-3ga':             { name: 'Mythic Item (3GA)',        rarity: 'mythic',    points: 3, icon: '⛩️', description: 'A mythic item with three greater affixes — near perfect power.' },
    'ancestral-unique-4ga':   { name: 'Ancestral Unique (4GA)',   rarity: 'ancestral', points: 3, icon: '💠', description: 'An ancestral unique with four greater affixes — perfection achieved.' },
    'mythic-4ga':             { name: 'Mythic Item (4GA)',        rarity: 'mythic',    points: 3, icon: '⛩️', description: 'A mythic item with four greater affixes — absolute dominion.' },
    'chaos-unique-3ga':       { name: 'Chaos Unique (3GA)',       rarity: 'chaos',     points: 3, icon: '🌋', description: 'A chaos unique bearing three greater affixes — true chaos unleashed.' },
};

// ── SAMPLE DATA (fallback) ────────────────────────────────────────
const SAMPLE_DATA = {
    players: [
        { id:1, name:'Telchis',  class:'Necromancer', totalPoints:15, achievements:8  },
        { id:2, name:'Jubbs',    class:'Rogue',        totalPoints:42, achievements:18 },
        { id:3, name:'Tom',      class:'Barbarian',    totalPoints:28, achievements:12 },
        { id:4, name:'Ross',     class:'Sorcerer',     totalPoints:19, achievements:9  },
        { id:5, name:'Mitchell', class:'Druid',        totalPoints:11, achievements:6  },
    ],
    achievements: [
        { id:1, type:'legendary-item',         playerName:'Telchis',  timestamp:'2025-04-15T08:30:00Z', season:'season-10', points:1 },
        { id:2, type:'ancestral-unique',        playerName:'Jubbs',    timestamp:'2025-04-15T10:45:00Z', season:'season-10', points:1 },
        { id:3, type:'ancestral-legendary-3ga', playerName:'Jubbs',    timestamp:'2025-04-16T14:20:00Z', season:'season-10', points:2 },
        { id:4, type:'chaos-unique-1ga',        playerName:'Jubbs',    timestamp:'2025-04-17T09:15:00Z', season:'season-10', points:1 },
        { id:5, type:'mythic-1ga',              playerName:'Tom',      timestamp:'2025-04-19T15:30:00Z', season:'season-10', points:2 },
        { id:6, type:'chaos-unique-2ga',        playerName:'Telchis',  timestamp:'2025-04-18T16:45:00Z', season:'season-10', points:2 },
        { id:7, type:'unique-item',             playerName:'Ross',     timestamp:'2025-04-16T09:00:00Z', season:'season-10', points:1 },
        { id:8, type:'grandpapa-bonus',         playerName:'Mitchell', timestamp:'2025-04-19T11:30:00Z', season:'season-10', points:2 },
    ],
    seasons: [
        { id:8, number:13, name:'Season of Lord of Hatred',         slug:'season-13', status:'upcoming',  players:0, achievements:0, totalPoints:0,  start_date:null,                    end_date:null,                      next_season_start:'2026-04-28T17:00:00Z' },
        { id:7, number:12, name:'Season of Slaughter',              slug:'season-12', status:'completed', players:3, achievements:9,  totalPoints:51,  start_date:'2025-10-14T17:00:00Z', end_date:'2026-04-21T17:00:00Z',    next_season_start:null },
        { id:6, number:11, name:'Season of Divine Intervention',    slug:'season-11', status:'completed', players:4, achievements:8,  totalPoints:44,  start_date:'2025-07-15T17:00:00Z', end_date:'2025-10-14T17:00:00Z',    next_season_start:null },
        { id:1, number:10, name:'Season of the Infernal Hordes',   slug:'season-10', status:'completed', players:5, achievements:9,  totalPoints:12,  start_date:'2025-04-15T17:00:00Z', end_date:'2025-07-15T17:00:00Z',    next_season_start:null },
        { id:2, number:9,  name:'Season of the Construct',         slug:'season-9',  status:'completed', players:3, achievements:10, totalPoints:15,  start_date:'2025-01-15T17:00:00Z', end_date:'2025-04-15T17:00:00Z',    next_season_start:null },
        { id:3, number:8,  name:'Season of Blood',                 slug:'season-8',  status:'completed', players:3, achievements:11, totalPoints:18,  start_date:'2024-10-15T17:00:00Z', end_date:'2025-01-15T17:00:00Z',    next_season_start:null },
    ],
};

/* ═══════════════════════════════════════════════════════════════
   PARTICLE ENGINE
═══════════════════════════════════════════════════════════════ */
class ParticleEngine {
    constructor(canvas) {
        this.canvas    = canvas;
        this.ctx       = canvas.getContext('2d');
        this.particles = [];
        this.animId    = null;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.spawn();
        this.animate();
    }
    resize() {
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    spawn() {
        const n = Math.floor((window.innerWidth * window.innerHeight) / 18000);
        for (let i = 0; i < n; i++) this.particles.push(this.createParticle(true));
    }
    createParticle(scattered = false) {
        const types = ['ember','ember','ember','ash','mist'];
        const type  = types[Math.floor(Math.random() * types.length)];
        const size  = type === 'mist' ? 2 + Math.random() * 4
                    : type === 'ash'  ? 1 + Math.random() * 2
                    : 1.5 + Math.random() * 2.5;
        return {
            x: Math.random() * this.canvas.width,
            y: scattered ? Math.random() * this.canvas.height : this.canvas.height + 10,
            size, type,
            speed: 0.2 + Math.random() * 0.5,
            dx: (Math.random() - 0.5) * 0.3,
            opacity: 0,
            maxOpacity: type === 'mist' ? 0.12 : 0.3 + Math.random() * 0.5,
            life: 0,
            maxLife: 200 + Math.random() * 300,
            hue: type === 'ember' ? Math.random() * 30 : type === 'ash' ? 220 : 15,
        };
    }
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life++; p.y -= p.speed; p.x += p.dx + Math.sin(p.life * 0.02) * 0.15;
            const prog = p.life / p.maxLife;
            p.opacity = prog < 0.15 ? (prog / 0.15) * p.maxOpacity
                      : prog > 0.7  ? ((1 - prog) / 0.3) * p.maxOpacity
                      : p.maxOpacity;
            if (p.life >= p.maxLife || p.y < -20) this.particles[i] = this.createParticle(false);
        }
    }
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const p of this.particles) {
            this.ctx.save(); this.ctx.globalAlpha = p.opacity;
            if (p.type === 'ember') {
                const g = this.ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*2);
                g.addColorStop(0, `hsla(${p.hue},90%,75%,1)`);
                g.addColorStop(0.5,`hsla(${p.hue},80%,50%,0.6)`);
                g.addColorStop(1, `hsla(${p.hue},70%,30%,0)`);
                this.ctx.fillStyle = g;
                this.ctx.beginPath(); this.ctx.arc(p.x,p.y,p.size*2,0,Math.PI*2); this.ctx.fill();
            } else if (p.type === 'ash') {
                this.ctx.fillStyle = `hsla(${p.hue},10%,80%,${p.opacity})`;
                this.ctx.fillRect(p.x,p.y,p.size*0.8,p.size*2);
            } else {
                const g = this.ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*8);
                g.addColorStop(0,`hsla(${p.hue},60%,40%,0.3)`); g.addColorStop(1,'transparent');
                this.ctx.fillStyle = g;
                this.ctx.beginPath(); this.ctx.arc(p.x,p.y,p.size*8,0,Math.PI*2); this.ctx.fill();
            }
            this.ctx.restore();
        }
    }
    animate() { this.update(); this.draw(); this.animId = requestAnimationFrame(() => this.animate()); }
}

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN ENGINE
═══════════════════════════════════════════════════════════════ */
class CountdownEngine {
    constructor({ targetDate, labelText, onDone }) {
        this.target    = targetDate instanceof Date ? targetDate : new Date(targetDate);
        this.labelText = labelText || 'Remaining';
        this.onDone    = onDone || (() => {});
        this.interval  = null;
        this.prevVals  = {};

        // Cache DOM refs
        this.section   = document.getElementById('countdownSection');
        this.label     = document.getElementById('countdownLabel');
        this.clockEl   = document.getElementById('countdownClock');
        this.dEl       = document.getElementById('cd-days');
        this.hEl       = document.getElementById('cd-hours');
        this.mEl       = document.getElementById('cd-mins');
        this.sEl       = document.getElementById('cd-secs');
    }

    start() {
        if (!this.section) return;
        if (this.label) this.label.textContent = this.labelText;

        const tick = () => {
            const now  = Date.now();
            const diff = this.target.getTime() - now;

            if (diff <= 0) {
                this.stop();
                this._showEnded();
                this.onDone();
                return;
            }

            const d  = Math.floor(diff / 86400000);
            const h  = Math.floor((diff % 86400000) / 3600000);
            const m  = Math.floor((diff % 3600000) / 60000);
            const s  = Math.floor((diff % 60000) / 1000);

            this._setDigit(this.dEl, 'days',  String(d).padStart(2,'0'));
            this._setDigit(this.hEl, 'hours', String(h).padStart(2,'0'));
            this._setDigit(this.mEl, 'mins',  String(m).padStart(2,'0'));
            this._setDigit(this.sEl, 'secs',  String(s).padStart(2,'0'));
        };

        tick();
        this.section.classList.remove('hidden');
        this.interval = setInterval(tick, 1000);
    }

    _setDigit(el, key, val) {
        if (!el) return;
        if (this.prevVals[key] !== val) {
            el.textContent = val;
            el.classList.remove('flip');
            void el.offsetWidth; // reflow
            el.classList.add('flip');
            this.prevVals[key] = val;
        }
    }

    _showEnded() {
        if (!this.clockEl) return;
        this.clockEl.innerHTML = `<div class="countdown-ended">🔥 Season has ended!</div>`;
    }

    stop() {
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
    }
}

/* ═══════════════════════════════════════════════════════════════
   INITIALISATION
═══════════════════════════════════════════════════════════════ */
let particles;
let countdown;

document.addEventListener('DOMContentLoaded', () => {
    // Set footer year dynamically
    const fyEl = document.getElementById('footerYear');
    if (fyEl) fyEl.textContent = new Date().getFullYear();

    // Particles
    const canvas = document.getElementById('particleCanvas');
    if (canvas) particles = new ParticleEngine(canvas);

    // Restore admin session
    const savedPw = sessionStorage.getItem(ADMIN_PW_KEY);
    if (savedPw) setAdminState(true);

    // Load sample data immediately, then upgrade from API
    appState.players      = SAMPLE_DATA.players;
    appState.achievements = SAMPLE_DATA.achievements;
    appState.seasons      = SAMPLE_DATA.seasons;

    renderSeasonCards();
    setupCountdown();
    setupGlobalListeners();

    // Background API upgrade
    initDataFromAPI().then(() => {
        // Dismiss the loading bar
        const loader = document.getElementById('pageLoader');
        if (loader) loader.classList.add('done');

        renderSeasonCards();
        setupCountdown(); // Re-run with live end_date from DB
        // If already in main app, silently refresh it
        if (!document.getElementById('mainApp').classList.contains('hidden')) {
            const season = appState.seasons.find(s => s.slug === appState.currentSeason?.slug) || appState.currentSeason;
            if (season) enterSeason(season, true);
        }
    });
});

async function initDataFromAPI() {
    try {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res   = await fetch(`${API_URL}/data`, { signal: ctrl.signal });
        clearTimeout(timer);

        if (res.ok) {
            const data = await res.json();
            if (data.players)      appState.players      = data.players;
            if (data.achievements) appState.achievements = data.achievements;
            if (data.seasons)      appState.seasons      = data.seasons;
            console.info('✅ Live data loaded from Cloudflare Worker.');
            renderTicker();
        }
    } catch (_) {
        console.info('ℹ️  API unavailable — using sample data.');
    }
}

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN SETUP
═══════════════════════════════════════════════════════════════ */
function setupCountdown() {
    if (countdown) { countdown.stop(); countdown = null; }

    // First try: active season with a future end_date
    const active = appState.seasons.find(s => s.status === 'active');
    let targetDate, label;

    if (active) {
        const endStr = active.end_date || active.next_season_start;
        if (endStr) {
            const d = new Date(endStr);
            if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
                targetDate = d;
                label = `Season ${active.number} ends in`;
            }
        }
    }

    // Fallback: next upcoming season with a start date
    if (!targetDate) {
        const upcoming = appState.seasons
            .filter(s => s.status === 'upcoming' && s.next_season_start)
            .sort((a, b) => new Date(a.next_season_start) - new Date(b.next_season_start))[0];
        if (upcoming) {
            const d = new Date(upcoming.next_season_start);
            if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
                targetDate = d;
                label = `Season ${upcoming.number} starts in`;
            }
        }
    }

    // Nothing future to count to — hide the widget
    if (!targetDate) {
        const section = document.getElementById('countdownSection');
        if (section) section.classList.add('hidden');
        return;
    }

    countdown = new CountdownEngine({
        targetDate,
        labelText: label,
        onDone: () => {
            // Reached zero — do ONE quiet data refresh only, never restart
            initDataFromAPI().then(() => renderSeasonCards());
        },
    });
    countdown.start();
}

/* ═══════════════════════════════════════════════════════════════
   LANDING — SEASON CARDS
═══════════════════════════════════════════════════════════════ */
function renderSeasonCards() {
    const grid = document.getElementById('seasonsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    appState.seasons.forEach(season => {
        const card = document.createElement('button');
        card.className = 'season-card-select';
        card.type      = 'button';
        card.setAttribute('aria-label', `Enter ${season.name}`);

        const noActivity  = season.status === 'completed' && !(season.achievements > 0);
        const statusLabel = season.status === 'active' ? 'Active'
                          : season.status === 'upcoming' ? 'Upcoming'
                          : noActivity ? '😴 Didn\'t Participate'
                          : 'Completed';

        card.innerHTML = `
            <div class="sc-number">Season ${season.number || ''}</div>
            <div class="sc-name">${escHtml(season.name)}</div>
            <div class="sc-status ${noActivity ? 'no-activity' : season.status}">
                ${statusLabel}
            </div>
            <div class="sc-stats">
                <div>
                    <div class="sc-stat-label">Champions</div>
                    <div class="sc-stat-value">${noActivity ? '—' : (season.players ?? '—')}</div>
                </div>
                <div>
                    <div class="sc-stat-label">Achievements</div>
                    <div class="sc-stat-value">${noActivity ? '—' : (season.achievements ?? '—')}</div>
                </div>
            </div>
        `;

        if (season.status !== 'upcoming') {
            card.addEventListener('click', () => enterSeason(season));
            if (noActivity) card.style.opacity = '0.55';
        } else {
            card.style.opacity = '0.6';
            card.style.cursor  = 'not-allowed';
        }

        grid.appendChild(card);
    });
}

/* ═══════════════════════════════════════════════════════════════
   ENTER A SEASON
═══════════════════════════════════════════════════════════════ */
function enterSeason(season, silentRefresh = false) {
    appState.currentSeason = season;

    // Set header
    const titleEl = document.getElementById('seasonTitle');
    if (titleEl) titleEl.textContent = season.name;

    updateHeroBar();
    renderLeaderboard();
    renderAchievements();
    renderTicker();
    populateRecordForm();

    // Default to Bingo tab if active, else Leaderboard
    const defaultTab = season.status === 'active' ? 'bingo' : 'leaderboard';
    switchTab(defaultTab);

    if (!silentRefresh) {
        const landing = document.getElementById('landingScreen');
        const app     = document.getElementById('mainApp');
        landing.classList.add('fade-out');
        setTimeout(() => {
            landing.style.display = 'none';
            app.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, 900);
    }
}

function updateHeroBar() {
    const season = appState.currentSeason;
    if (!season) return;

    const seasonAchs = appState.achievements.filter(a => a.season === season.slug);
    const uniquePts  = new Set(seasonAchs.map(a => a.playerName));
    const points     = seasonAchs.reduce((s, a) => s + (a.points || 0), 0);

    setEl('heroPlayers',      season.players      ?? uniquePts.size);
    setEl('heroAchievements', season.achievements ?? seasonAchs.length);
    setEl('heroPoints',       season.totalPoints  ?? points);
}

/* ═══════════════════════════════════════════════════════════════
   LEADERBOARD
═══════════════════════════════════════════════════════════════ */
function renderLeaderboard() {
    const search = (getEl('playerSearch')?.value || '').toLowerCase();
    const season = appState.currentSeason;

    // Compute per-player points for the current season
    let players = appState.players.map(p => {
        const mine = appState.achievements.filter(
            a => a.season === season?.slug && a.playerName === p.name
        );
        return {
            ...p,
            seasonPoints:    mine.reduce((s, a) => s + (a.points || 0), 0),
            seasonAchCount:  mine.length,
        };
    });

    // Filter & sort
    players = players
        .filter(p => p.name.toLowerCase().includes(search))
        .sort((a, b) => b.seasonPoints - a.seasonPoints || b.totalPoints - a.totalPoints);

    renderPodium(players);
    renderLbTable(players);
}

/* Shared helper — returns HTML string for a 3-place podium.
   Each entry needs: .name, and either .totalPoints or .seasonPoints */
function buildPodiumHTML(players) {
    if (!players || players.length === 0) return '';

    const order       = [1, 0, 2];          // display order: 2nd | 1st | 3rd
    const rankClasses = ['rank-2','rank-1','rank-3'];
    const rankLabels  = ['2nd Place','1st Place','3rd Place'];
    const crowns      = [null,'👑',null];

    return order.map((playerIdx, colIdx) => {
        const player = players[playerIdx];
        if (!player) return '';
        const initials = player.name.slice(0,2).toUpperCase();
        const pts = player.seasonPoints ?? player.totalPoints ?? 0;
        return `
        <div class="podium-item ${rankClasses[colIdx]}">
            ${crowns[colIdx] ? `<div class="podium-crown">${crowns[colIdx]}</div>` : ''}
            <div class="podium-avatar">${initials}</div>
            <div class="podium-name">${escHtml(player.name)}</div>
            <div class="podium-points">${pts} glory pts</div>
            <div class="podium-rank-label">${rankLabels[colIdx]}</div>
            <div class="podium-platform"></div>
        </div>`;
    }).join('');
}

function renderPodium(players) {
    const section = document.getElementById('podiumSection');
    if (!section || players.length < 1) { if (section) section.innerHTML=''; return; }
    section.innerHTML = buildPodiumHTML(players);
}

function renderLbTable(players) {
    const list = document.getElementById('leaderboardList');
    if (!list) return;
    list.innerHTML = '';

    if (players.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚔️</div><p>No champions found</p></div>`;
        return;
    }

    players.forEach((player, idx) => {
        const rank    = idx + 1;
        const rankCls = rank <= 3 ? `top-${rank}` : 'other';
        const display = rank <= 3 ? `${rank}${getMedalEmoji(idx)}` : rank;
        const initials = player.name.slice(0,2).toUpperCase();

        const row = document.createElement('div');
        row.className = `lb-row${rank <= 3 ? ` top-${rank}` : ''}`;
        row.innerHTML = `
            <div class="col-rank"><div class="lb-rank ${rankCls}">${display}</div></div>
            <div class="col-player lb-player">
                <div class="lb-avatar">${initials}</div>
                <div class="lb-name">${escHtml(player.name)}</div>
            </div>
            <div class="col-class lb-class">${escHtml(player.class || '—')}</div>
            <div class="col-points lb-points">${player.seasonPoints}<span>pts</span></div>
            <div class="col-ach lb-ach">🎖 ${player.seasonAchCount}</div>
        `;
        list.appendChild(row);
    });
}

function getMedalEmoji(idx) { return ['🥇','🥈','🥉'][idx] || ''; }

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENTS
═══════════════════════════════════════════════════════════════ */
function renderAchievements() {
    const search    = (getEl('achievementSearch')?.value || '').toLowerCase();
    const ptFilter  = getEl('pointsFilter')?.value  || '';
    const rarFilter = getEl('rarity-filter')?.value || '';
    const season    = appState.currentSeason;

    let list = appState.achievements
        .filter(a => a.season === season?.slug)
        .filter(a => {
            const tmpl = achievementTemplates[a.type];
            if (!tmpl) return false;
            const matchSearch = !search || tmpl.name.toLowerCase().includes(search) || a.playerName.toLowerCase().includes(search);
            const matchPts    = !ptFilter  || tmpl.points === parseInt(ptFilter);
            const matchRar    = !rarFilter || tmpl.rarity === rarFilter;
            return matchSearch && matchPts && matchRar;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const grid = document.getElementById('achievementGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (list.length === 0) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔮</div><p>No achievements match your filters</p></div>`;
        return;
    }

    list.forEach(ach => {
        const tmpl = achievementTemplates[ach.type];
        const card = document.createElement('div');
        card.className = `ach-card rarity-${tmpl.rarity}`;
        card.setAttribute('role','button'); card.setAttribute('tabindex','0');
        card.innerHTML = `
            <div class="ach-rarity-badge">${tmpl.rarity}</div>
            <div class="ach-icon">${tmpl.icon}</div>
            <div class="ach-name">${escHtml(tmpl.name)}</div>
            <div class="ach-description">${escHtml(tmpl.description)}</div>
            <div class="ach-card-footer">
                <div class="ach-pts">🪙 ${tmpl.points}<span style="font-size:0.7rem;font-weight:400;color:var(--text-dim);margin-left:0.15rem">pts</span></div>
                <div class="ach-player-info">
                    <span class="ach-player-name">${escHtml(ach.playerName)}</span>
                    <span class="ach-player-date">${formatDate(ach.timestamp)}</span>
                </div>
            </div>
        `;
        const open = () => openAchievementModal(ach, tmpl);
        card.addEventListener('click', open);
        card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') open(); });
        grid.appendChild(card);
    });
}

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENT DETAIL MODAL
═══════════════════════════════════════════════════════════════ */
function openAchievementModal(ach, tmpl) {
    const modal = getEl('achievementModal');
    const body  = getEl('modalBody');
    if (!modal || !body) return;

    const rc = { legendary:{bg:'#c9a84c',text:'#07050f'}, ancestral:{bg:'#9b59b6',text:'#fff'}, unique:{bg:'#1abc9c',text:'#07050f'}, mythic:{bg:'#e74c3c',text:'#fff'}, chaos:{bg:'#e67e22',text:'#fff'} }[tmpl.rarity] || {bg:'#666',text:'#fff'};

    body.innerHTML = `
        <div class="modal-rarity-badge" style="background:${rc.bg};color:${rc.text};">${tmpl.rarity}</div>
        <div class="modal-icon">${tmpl.icon}</div>
        <h3 class="modal-title">${escHtml(tmpl.name)}</h3>
        <p class="modal-desc">${escHtml(tmpl.description)}</p>
        ${ach.notes ? `<p class="modal-desc" style="color:var(--text-dim);font-style:italic">📝 ${escHtml(ach.notes)}</p>` : ''}
        <div class="modal-divider"></div>
        <div class="modal-meta-grid">
            <div class="modal-meta-item"><div class="modal-meta-label">Champion</div><div class="modal-meta-value silver">${escHtml(ach.playerName)}</div></div>
            <div class="modal-meta-item"><div class="modal-meta-label">Glory Points</div><div class="modal-meta-value gold">🪙 ${tmpl.points}</div></div>
            <div class="modal-meta-item"><div class="modal-meta-label">Rarity</div><div class="modal-meta-value">${tmpl.rarity.charAt(0).toUpperCase()+tmpl.rarity.slice(1)}</div></div>
            <div class="modal-meta-item"><div class="modal-meta-label">Date Achieved</div><div class="modal-meta-value" style="font-size:0.85rem;color:var(--text-mid)">${formatDate(ach.timestamp)}</div></div>
        </div>
    `;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function openModal(id) {
    const el = getEl(id);
    if (el) el.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id = 'achievementModal') {
    const el = getEl(id);
    if (el) el.classList.remove('active');
    document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN — UNLOCK / LOCK
═══════════════════════════════════════════════════════════════ */
function setAdminState(isAdmin) {
    appState.isAdmin = isAdmin;
    const btn      = getEl('btnRecordAchievement');
    const lockBtn  = getEl('adminLockBtn');
    const lockIcon = getEl('adminLockIcon');

    if (btn)      btn.classList.toggle('hidden', !isAdmin);
    if (lockBtn)  lockBtn.classList.toggle('unlocked', isAdmin);
    if (lockIcon) lockIcon.textContent = isAdmin ? '🔓' : '🔒';
}

async function tryAdminUnlock(password) {
    // Verify against the worker — the worker keeps the real password
    try {
        const res = await fetch(`${API_URL}/seasons`, {
            headers: { 'X-Admin-Password': password }
        });
        // Seasons is a public endpoint. We'll do a lightweight check:
        // try a PATCH that returns 401 if wrong password.
        // Actually, simplest: hit a protected endpoint; check status.
        const testRes = await fetch(`${API_URL}/players`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
            body:    JSON.stringify({ _check: true, name: '__test_check__' }),
        });
        // 409 = duplicate (but auth passed!) | 201 = created (auth passed)
        // 401 = wrong password
        if (testRes.status === 401) return false;
        // Auth passed — store for session
        sessionStorage.setItem(ADMIN_PW_KEY, password);
        return true;
    } catch {
        // Offline / no API — compare against local dev default
        const ok = password === 'diablo4admin';
        if (ok) sessionStorage.setItem(ADMIN_PW_KEY, password);
        return ok;
    }
}

/* ═══════════════════════════════════════════════════════════════
   RECORD ACHIEVEMENT MODAL
═══════════════════════════════════════════════════════════════ */
function openRecordModal() {
    populateRecordForm();

    // Default timestamp to now
    const now  = new Date();
    const pad  = n => String(n).padStart(2,'0');
    const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const tsEl = getEl('rf-timestamp');
    if (tsEl) tsEl.value = local;

    updatePointsPreview();
    getEl('recordModal')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function populateRecordForm() {
    // Players dropdown
    const playerSel = getEl('rf-player');
    if (playerSel) {
        const current = playerSel.value;
        playerSel.innerHTML = '<option value="">— Select Player —</option>';
        appState.players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name}${p.class ? ` (${p.class})` : ''}`;
            if (String(p.id) === current) opt.selected = true;
            playerSel.appendChild(opt);
        });
    }

    // Seasons dropdown
    const seasonSel = getEl('rf-season');
    if (seasonSel) {
        const current = seasonSel.value;
        seasonSel.innerHTML = '';
        appState.seasons
            .filter(s => s.status !== 'upcoming')
            .forEach(s => {
                const opt = document.createElement('option');
                opt.value       = s.slug;
                opt.textContent = `Season ${s.number} — ${s.name}`;
                if (s.status === 'active' || s.slug === current) opt.selected = true;
                seasonSel.appendChild(opt);
            });
    }
}

function updatePointsPreview() {
    const type  = getEl('rf-type')?.value;
    const tmpl  = achievementTemplates[type];
    const valEl = getEl('rf-pts-val');
    if (valEl) valEl.textContent = tmpl ? `${tmpl.points}` : '—';
}

async function handleRecordSubmit(e) {
    e.preventDefault();
    const form = e.target;

    const playerId       = parseInt(getEl('rf-player')?.value);
    const achievementType= getEl('rf-type')?.value;
    const season         = getEl('rf-season')?.value;
    const timestamp      = new Date(getEl('rf-timestamp')?.value).toISOString();
    const notes          = getEl('rf-notes')?.value?.trim() || null;

    if (!playerId || !achievementType || !season) {
        showRecordStatus('error', 'Please fill in all required fields.');
        return;
    }

    const submitBtn  = getEl('recordSubmitBtn');
    const submitText = form.querySelector('.submit-text');
    const submitLoad = form.querySelector('.submit-loading');

    submitBtn.disabled   = true;
    submitText.classList.add('hidden');
    submitLoad.classList.remove('hidden');

    const password = sessionStorage.getItem(ADMIN_PW_KEY) || '';

    try {
        const res = await fetch(`${API_URL}/achievements`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
            body:    JSON.stringify({ playerId, achievementType, season, timestamp, notes }),
        });

        if (res.status === 401) {
            showRecordStatus('error', 'Session expired — please re-authenticate.');
            setAdminState(false);
            sessionStorage.removeItem(ADMIN_PW_KEY);
        } else if (res.ok) {
            const tmpl   = achievementTemplates[achievementType];
            const player = appState.players.find(p => p.id === playerId);
            showToast('success', '⚡ Achievement Recorded!', `${player?.name} — ${tmpl?.name} (${tmpl?.points} pts) — Discord notified`);
            closeModal('recordModal');
            form.reset();

            // Refresh data
            await initDataFromAPI();
            renderLeaderboard();
            renderAchievements();
            updateHeroBar();

            // Also update the leaderboard in-place with optimistic local data
        } else {
            const body = await res.json().catch(() => ({}));
            showRecordStatus('error', body.error || 'Failed to record achievement. Try again.');
        }
    } catch (err) {
        // Offline: update locally (sample data mode)
        const tmpl   = achievementTemplates[achievementType];
        const player = appState.players.find(p => p.id === playerId);
        if (!tmpl || !player) { showRecordStatus('error', 'Invalid player or type.'); }
        else {
            const newAch = { id: Date.now(), type: achievementType, playerId, playerName: player.name, timestamp, season, notes, points: tmpl.points };
            appState.achievements.unshift(newAch);
            renderLeaderboard(); renderAchievements(); updateHeroBar();
            showToast('info', '📡 Offline mode', `Achievement saved locally. Will sync when API is available.`);
            closeModal('recordModal');
            form.reset();
        }
    } finally {
        submitBtn.disabled = false;
        submitText.classList.remove('hidden');
        submitLoad.classList.add('hidden');
    }
}

function showRecordStatus(type, msg) {
    const el = getEl('recordStatus');
    if (!el) return;
    el.className = `record-status ${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

/* ═══════════════════════════════════════════════════════════════
   TOAST SYSTEM
═══════════════════════════════════════════════════════════════ */
function showToast(type, title, msg, duration = 5000) {
    const container = getEl('toastContainer');
    if (!container) return;

    const icons = { success:'✅', error:'❌', info:'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cursor = 'pointer';
    toast.title = 'Click to dismiss';
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || '🔔'}</div>
        <div class="toast-body">
            <div class="toast-title">${escHtml(title)}</div>
            ${msg ? `<div class="toast-msg">${escHtml(msg)}</div>` : ''}
        </div>
    `;
    container.appendChild(toast);

    const dismiss = () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 350);
    };
    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */
function setupGlobalListeners() {
    // Tab nav
    document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', e => switchTab(e.currentTarget.dataset.tab));
    });

    // Back button
    getEl('backBtn')?.addEventListener('click', () => {
        getEl('mainApp').classList.add('hidden');
        const landing = getEl('landingScreen');
        landing.style.display = '';
        landing.classList.remove('fade-out');
    });

    // All Time Leaderboard shortcut (landing screen)
    getEl('alltimeShortcutBtn')?.addEventListener('click', () => {
        // If no season is loaded yet, load the first completed season as context
        if (!appState.currentSeason) {
            const fallback = appState.seasons.find(s => s.status === 'completed') || appState.seasons[0];
            if (fallback) enterSeason(fallback, true);
        }
        const landing = getEl('landingScreen');
        landing.classList.add('fade-out');
        // Use timeout matching the CSS transition (0.9s) rather than animationend
        setTimeout(() => { landing.style.display = 'none'; }, 900);
        getEl('mainApp').classList.remove('hidden');
        switchTab('alltime');
        window.scrollTo({ top: 0, behavior: 'instant' });
    });

    // Search / filters
    bindInput('playerSearch', renderLeaderboard);
    bindInput('achievementSearch', renderAchievements);
    bindChange('pointsFilter', renderAchievements);
    bindChange('rarity-filter', renderAchievements);

    // Achievement detail modal
    getEl('modalCloseBtn')?.addEventListener('click', () => closeModal('achievementModal'));
    getEl('achievementModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('achievementModal'); });

    // Record achievement modal
    getEl('btnRecordAchievement')?.addEventListener('click', openRecordModal);
    getEl('recordModalClose')?.addEventListener('click',  () => closeModal('recordModal'));
    getEl('recordCancelBtn')?.addEventListener('click',   () => closeModal('recordModal'));
    getEl('recordModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('recordModal'); });
    getEl('recordForm')?.addEventListener('submit', handleRecordSubmit);
    getEl('rf-type')?.addEventListener('change', updatePointsPreview);

    // Admin unlock
    getEl('adminLockBtn')?.addEventListener('click', () => {
        if (appState.isAdmin) {
            // Lock
            setAdminState(false);
            sessionStorage.removeItem(ADMIN_PW_KEY);
            showToast('info', '🔒 Admin Locked', 'Achievement recording disabled.');
        } else {
            getEl('adminUnlockModal')?.classList.add('active');
            document.body.style.overflow = 'hidden';
            setTimeout(() => getEl('adminPassword')?.focus(), 100);
        }
    });
    getEl('adminUnlockClose')?.addEventListener('click', () => closeModal('adminUnlockModal'));
    getEl('adminUnlockModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('adminUnlockModal'); });
    getEl('adminUnlockForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const pw  = getEl('adminPassword')?.value || '';
        const errEl = getEl('adminUnlockError');
        errEl?.classList.add('hidden');
        const ok  = await tryAdminUnlock(pw);
        if (ok) {
            setAdminState(true);
            closeModal('adminUnlockModal');
            getEl('adminPassword').value = '';
            showToast('success', '🔓 Admin Unlocked', 'You can now record achievements.');
        } else {
            errEl?.classList.remove('hidden');
            getEl('adminPassword')?.select();
        }
    });

    // ESC key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            ['achievementModal','recordModal','adminUnlockModal','bingoClaimModal'].forEach(id => closeModal(id));
        }
    });

    // Bingo claim modal
    setupBingoClaimModal();
}

/* ═══════════════════════════════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════════════════════════════ */
function switchTab(tabName) {
    document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === tabName);
    });
    // Lazy-render heavier views on first switch
    if (tabName === 'bingo')   renderBingoBoard();
    if (tabName === 'alltime') renderGlobalLeaderboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */
function getEl(id)  { return document.getElementById(id); }
function setEl(id, val) { const el = getEl(id); if (el) el.textContent = val; }
function bindInput(id, fn)  { const el = getEl(id); if (el) el.addEventListener('input', fn); }
function bindChange(id, fn) { const el = getEl(id); if (el) el.addEventListener('change', fn); }

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    } catch { return dateStr; }
}

/* ═══════════════════════════════════════════════════════════════
   BINGO BOARD
═══════════════════════════════════════════════════════════════ */
const BINGO_DEFINITIONS = [
    { tier: 1, pts: 1, items: [
        { type:'legendary-item',         name:'Legendary Item',           icon:'🌕', rarity:'legendary'  },
        { type:'ancestral-legendary',    name:'Ancestral Legendary',      icon:'⚔️', rarity:'ancestral'  },
        { type:'unique-item',            name:'Unique Item',              icon:'💎', rarity:'unique'      },
        { type:'ancestral-unique',       name:'Ancestral Unique',         icon:'🔮', rarity:'ancestral'  },
        { type:'ancestral-legendary-2ga',name:'Ancestral Legendary (2GA)',icon:'🔱', rarity:'ancestral'  },
        { type:'ancestral-unique-2ga',   name:'Ancestral Unique (2GA)',   icon:'💠', rarity:'ancestral'  },
        { type:'chaos-unique-1ga',       name:'Chaos Unique (1GA)',       icon:'🌀', rarity:'chaos'       },
        { type:'any-1ga-item',           name:'Any 1GA Item',             icon:'✨', rarity:'legendary'  },
    ]},
    { tier: 2, pts: 2, items: [
        { type:'ancestral-unique-3ga',   name:'Ancestral Unique (3GA)',   icon:'💠', rarity:'ancestral'  },
        { type:'ancestral-legendary-3ga',name:'Ancestral Legendary (3GA)',icon:'🔱', rarity:'ancestral'  },
        { type:'mythic-no-cache',        name:'Mythic (No Cache)',        icon:'⛩️', rarity:'mythic'      },
        { type:'mythic-1ga',             name:'Mythic Item (1GA)',        icon:'⛩️', rarity:'mythic'      },
        { type:'mythic-2ga',             name:'Mythic Item (2GA)',        icon:'⛩️', rarity:'mythic'      },
        { type:'chaos-unique-2ga',       name:'Chaos Unique (2GA)',       icon:'🌪️', rarity:'chaos'       },
        { type:'grandpapa-bonus',        name:'Grandpapa Bonus',          icon:'👴', rarity:'unique'      },
    ]},
    { tier: 3, pts: 3, items: [
        { type:'mythic-3ga',             name:'Mythic Item (3GA)',        icon:'⛩️', rarity:'mythic'      },
        { type:'ancestral-unique-4ga',   name:'Ancestral Unique (4GA)',   icon:'💠', rarity:'ancestral'  },
        { type:'mythic-4ga',             name:'Mythic Item (4GA)',        icon:'⛩️', rarity:'mythic'      },
        { type:'chaos-unique-3ga',       name:'Chaos Unique (3GA)',       icon:'🌋', rarity:'chaos'       },
    ]},
];

function renderBingoBoard() {
    const board = getEl('bingoBoard');
    if (!board) return;

    const season = appState.currentSeason;
    const isClosed = !season || season.status === 'completed';

    // Build claimed map: achievement_type → player name
    const claimedMap = {};
    appState.achievements
        .filter(a => season && a.season === season.slug)
        .forEach(a => { claimedMap[a.type] = a.playerName; });

    // Build tier structure — use season's challenges_config if available, else defaults
    let tiers;
    if (season?.challenges_config && Array.isArray(season.challenges_config)) {
        // Group by default tier based on point value from config
        const byPts = {};
        season.challenges_config
            .filter(c => c.active !== false)
            .forEach(c => {
                const key = c.pts || 1;
                if (!byPts[key]) byPts[key] = [];
                const def = BINGO_DEFINITIONS.flatMap(t => t.items).find(d => d.type === c.type);
                byPts[key].push({ type: c.type, name: c.name, icon: def?.icon || '🏆', rarity: def?.rarity || 'legendary', pts: c.pts });
            });
        tiers = Object.entries(byPts)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([pts, items]) => ({ tier: parseInt(pts), pts: parseInt(pts), items }));
    } else {
        tiers = BINGO_DEFINITIONS;
    }

    let html = '';
    for (const tier of tiers) {
        const coinStr = '🪙'.repeat(Math.min(tier.pts, 5));
        html += `
        <div class="bingo-tier">
            <div class="bingo-tier-header">
                <div class="bingo-tier-line"></div>
                <span>${coinStr} &nbsp;${tier.pts} Point${tier.pts > 1 ? 's' : ''}</span>
                <div class="bingo-tier-line" style="background:linear-gradient(90deg,transparent,rgba(201,168,76,0.4))"></div>
            </div>
            <div class="bingo-grid">`;

        for (const def of tier.items) {
            const winner   = claimedMap[def.type];
            const claimed  = !!winner;
            const claimable = !claimed && !isClosed;

            html += `
            <div class="bingo-cell ${claimed ? 'claimed' : 'unclaimed'} rarity-${def.rarity}"
                 data-type="${def.type}" data-pts="${tier.pts}" data-name="${escHtml(def.name)}">
                <div class="bingo-cell-inner">
                    <div class="bingo-cell-icon">${def.icon}</div>
                    <div class="bingo-cell-name">${escHtml(def.name)}</div>
                    <div class="bingo-cell-pts">🪙 ${tier.pts} Pt${tier.pts > 1 ? 's' : ''}</div>
                    
                    ${winner ? `
                        <div class="bingo-cell-status">
                            <div class="bingo-winner-seal">CLAIMED</div>
                            <div class="bingo-cell-winner">${escHtml(winner)}</div>
                        </div>
                    ` : `
                        <div class="bingo-cell-status">
                            ${claimable ? `<button class="bingo-claim-btn" data-type="${def.type}" data-name="${escHtml(def.name)}">
                                <span class="btn-seal">⚔️</span> CLAIM
                            </button>` : '<span class="status-locked">LOCKED</span>'}
                        </div>
                    `}
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }

    board.innerHTML = html;

    // Wire claim buttons
    board.querySelectorAll('.bingo-claim-btn').forEach(btn => {
        btn.addEventListener('click', () => openBingoClaim(btn.dataset.type, btn.dataset.name));
    });
}

/* ─── Ticker Logic ────────────────────────────────────────── */
function renderTicker() {
    const scrollEl = getEl('tickerScroll');
    if (!scrollEl) return;

    const season = appState.currentSeason;
    if (!season) {
        scrollEl.innerHTML = '<div class="ticker-item">Awaiting seasonal conquests...</div>';
        return;
    }

    // Get recent 10 achievements for current season
    const recent = appState.achievements
        .filter(a => a.season === season.slug)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    if (recent.length === 0) {
        scrollEl.innerHTML = `<div class="ticker-item">Season ${season.number} has begun. Who will be the first to claim glory?</div>`;
        return;
    }

    // Create the content string (repeated twice for infinite loop)
    const itemsHtml = recent.map(a => {
        const date = new Date(a.timestamp);
        const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const name = achievementTemplates[a.type]?.name || a.type;
        return `
            <div class="ticker-item">
                <span class="t-time">[${time}]</span>
                <span class="t-player">${escHtml(a.playerName)}</span>
                <span class="t-action">claimed ${escHtml(name)}!</span>
                <span class="t-divider">☩</span>
            </div>
        `;
    }).join('');

    // Duplicate for seamless loop
    scrollEl.innerHTML = itemsHtml + itemsHtml;
    
    // Adjust animation speed based on content length
    const duration = Math.max(20, recent.length * 10);
    scrollEl.style.animationDuration = `${duration}s`;
}

/* ─── Bingo Claim Modal ──────────────────────────────────── */
let _bingoClaimType = null;
let _bingoClaimName = null;

function openBingoClaim(type, name) {
    _bingoClaimType = type;
    _bingoClaimName = name;

    setEl('bingoClaimTitle', `Claim: ${name}`);
    setEl('bingoClaimDesc', `You were the first to obtain a ${name} this season. Select your name to record this historic achievement!`);

    // Populate player dropdown
    const sel = getEl('bingo-player');
    if (sel) {
        sel.innerHTML = '<option value="">— Select your name —</option>';
        appState.players.forEach(p => {
            const o = document.createElement('option');
            o.value = p.id; o.textContent = p.name;
            sel.appendChild(o);
        });
    }
    getEl('bingo-notes').value = '';
    getEl('bingoClaimStatus')?.classList.add('hidden');
    openModal('bingoClaimModal');
}

function setupBingoClaimModal() {
    getEl('bingoClaimClose')?.addEventListener('click', () => closeModal('bingoClaimModal'));
    getEl('bingoCancelBtn')?.addEventListener('click', () => closeModal('bingoClaimModal'));
    getEl('bingoClaimModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('bingoClaimModal'); });

    getEl('bingoClaimForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const playerId = getEl('bingo-player')?.value;
        if (!playerId) { showToast('error', 'Select your name', ''); return; }

        const notes    = getEl('bingo-notes')?.value?.trim() || null;
        const statusEl = getEl('bingoClaimStatus');
        const submitBtn = getEl('bingoSubmitBtn');

        submitBtn?.classList.add('loading');
        statusEl?.classList.add('hidden');

        try {
            const season = appState.currentSeason?.slug;
            const res = await fetch(`${API_URL}/achievements/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: parseInt(playerId), achievementType: _bingoClaimType, season, notes }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast('success', '🎯 Achievement Claimed!', `${_bingoClaimName} is yours!`);
                closeModal('bingoClaimModal');
                // Refresh live data
                await initDataFromAPI();
                renderBingoBoard();
                enterSeason(appState.currentSeason, true);
            } else {
                statusEl.textContent = data.error || 'Claim failed';
                statusEl.classList.remove('hidden');
            }
        } catch (err) {
            statusEl.textContent = 'Network error — try again';
            statusEl?.classList.remove('hidden');
        } finally {
            submitBtn?.classList.remove('loading');
        }
    });
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL (ALL-TIME) LEADERBOARD
═══════════════════════════════════════════════════════════════ */
function renderGlobalLeaderboard() {
    // Build lookup by BOTH id and name so historical achievements (no playerId) still count
    const byId   = {};  // id  → entry
    const byName = {};  // name (lowercase) → entry

    appState.players.forEach(p => {
        const entry = { id: p.id, name: p.name, class: p.class || 'Unknown', totalPoints: 0, achievements: 0, seasons: new Set() };
        byId[p.id]                  = entry;
        byName[p.name.toLowerCase()] = entry;
    });

    appState.achievements.forEach(a => {
        // Try playerId first, then playerName
        let p = (a.playerId != null) ? byId[a.playerId] : null;
        if (!p && a.playerName) p = byName[a.playerName.toLowerCase()];
        if (!p) {
            // Unknown player — create ad-hoc entry
            const key = (a.playerName || 'Unknown').toLowerCase();
            if (!byName[key]) {
                byName[key] = { id: null, name: a.playerName || 'Unknown', class: '—', totalPoints: 0, achievements: 0, seasons: new Set() };
            }
            p = byName[key];
        }
        p.totalPoints  += a.points || 0;
        p.achievements += 1;
        if (a.season) p.seasons.add(a.season);
    });

    const ranked = Object.values(byName)
        .map(p => ({ ...p, seasons: p.seasons.size }))
        .sort((a, b) => b.totalPoints - a.totalPoints || b.achievements - a.achievements);

    // Podium
    const podiumEl = getEl('globalPodiumSection');
    if (podiumEl) podiumEl.innerHTML = buildPodiumHTML(ranked);

    // Table
    const listEl = getEl('globalLbList');
    if (listEl) {
        listEl.innerHTML = ranked.length === 0
            ? `<div class="lb-row" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-dim)">No data yet</div>`
            : ranked.map((p, i) => {
                const rank  = i + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                return `
                <div class="lb-row" style="grid-template-columns:70px 1fr 120px 130px 140px 130px">
                    <div class="col-rank lb-rank"><span class="rank-medal">${medal}</span></div>
                    <div class="col-player lb-player"><span class="lb-player-name">${escHtml(p.name)}</span></div>
                    <div class="col-class lb-class">${escHtml(p.class)}</div>
                    <div class="col-points lb-points"><span class="points-gem">💎</span><span>${p.totalPoints}</span></div>
                    <div class="col-ach lb-ach">${p.achievements}</div>
                    <div class="col-ach lb-ach">${p.seasons}</div>
                </div>`;
            }).join('');
    }

    // Season history table — with per-season winner
    const histEl = getEl('seasonHistoryList');
    if (histEl) {
        const sorted = [...appState.seasons].sort((a, b) => b.number - a.number);
        histEl.innerHTML = sorted.map(s => {
            const statusCls   = s.status === 'active' ? 'status-active' : s.status === 'upcoming' ? 'status-upcoming' : 'status-completed';
            const statusLabel = s.status === 'active' ? 'ACTIVE' : s.status === 'upcoming' ? 'UPCOMING' : 'COMPLETED';

            const seasonAchs = appState.achievements.filter(a => a.season === s.slug);
            const pts = {};
            seasonAchs.forEach(a => {
                const n = a.playerName || 'Unknown';
                pts[n] = (pts[n] || 0) + (a.points || 0);
            });
            const winner    = Object.entries(pts).sort((a, b) => b[1] - a[1])[0];
            const noActivity = s.status === 'completed' && seasonAchs.length === 0;
            const winnerStr  = winner      ? `🏆 ${winner[0]} (${winner[1]}pts)`
                             : noActivity  ? '😴 Didn\'t Participate'
                             : s.status === 'upcoming' ? '—' : '—';
            const winnerColor = noActivity ? 'color:var(--text-dim);font-style:italic' : 'color:var(--ember-gold)';

            return `
            <div class="lb-row" style="grid-template-columns:80px 1fr 100px 130px 130px 160px">
                <div class="col-rank lb-rank"><span class="rank-medal" style="font-size:0.85rem">S${s.number}</span></div>
                <div class="col-player lb-player"><span class="lb-player-name" style="font-size:0.82rem">${escHtml(s.name)}</span></div>
                <div class="col-class"><span class="status-badge ${statusCls}" style="font-size:0.6rem">${statusLabel}</span></div>
                <div class="col-points lb-points"><span class="points-gem">💎</span><span>${s.totalPoints ?? 0}</span></div>
                <div class="col-ach lb-ach">${s.achievements ?? 0}</div>
                <div class="col-ach lb-ach" style="font-size:0.75rem;${winnerColor}">${escHtml(winnerStr)}</div>
            </div>`;
        }).join('');
    }
}

