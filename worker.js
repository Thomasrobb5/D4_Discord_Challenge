/**
 * Cloudflare Worker — Diablo IV Hall of Legends API
 *
 * Bindings required (wrangler.toml):
 *   DB               — Cloudflare D1 database
 *
 * Secrets (set via: wrangler secret put <NAME>):
 *   DISCORD_WEBHOOK_URL  — Discord channel webhook URL
 *   ADMIN_PASSWORD       — Password for protected admin routes
 *
 * Routes:
 *   GET    /api/data                 — All data (players, achievements, seasons)
 *   GET    /api/seasons              — Seasons list
 *   GET    /api/leaderboard          — All-time global leaderboard (all seasons)
 *   POST   /api/achievements/claim   — Self-claim achievement (PUBLIC — no admin needed)
 *   POST   /api/players              — Create player           [ADMIN]
 *   PATCH  /api/players/:id          — Update player details   [ADMIN]
 *   DELETE /api/players/:id          — Delete player           [ADMIN]
 *   POST   /api/achievements         — Record achievement      [ADMIN]
 *   DELETE /api/achievements/:id     — Delete achievement      [ADMIN]
 *   PATCH  /api/seasons/:id          — Update season          [ADMIN]
 *   POST   /api/seasons              — Create season           [ADMIN]
 */

// ── Achievement point map (source of truth) ─────────────────────
const POINT_MAP = {
    'legendary-item':         1,
    'ancestral-legendary':    1,
    'unique-item':            1,
    'ancestral-unique':       1,
    'ancestral-legendary-2ga':1,
    'ancestral-unique-2ga':   1,
    'chaos-unique-1ga':       1,
    'any-1ga-item':           1,
    'ancestral-unique-3ga':   2,
    'ancestral-legendary-3ga':2,
    'mythic-1ga':             2,
    'mythic-no-cache':        2,
    'mythic-2ga':             2,
    'chaos-unique-2ga':       2,
    'grandpapa-bonus':        2,
    'mythic-3ga':             3,
    'ancestral-unique-4ga':   3,
    'mythic-4ga':             3,
    'chaos-unique-3ga':       3,
};

// ── Rarity map ───────────────────────────────────────────────────
const RARITY_MAP = {
    'legendary-item':         'legendary',
    'ancestral-legendary':    'ancestral',
    'unique-item':            'unique',
    'ancestral-unique':       'ancestral',
    'ancestral-legendary-2ga':'ancestral',
    'ancestral-unique-2ga':   'ancestral',
    'chaos-unique-1ga':       'chaos',
    'any-1ga-item':           'legendary',
    'ancestral-unique-3ga':   'ancestral',
    'ancestral-legendary-3ga':'ancestral',
    'mythic-1ga':             'mythic',
    'mythic-no-cache':        'mythic',
    'mythic-2ga':             'mythic',
    'chaos-unique-2ga':       'chaos',
    'grandpapa-bonus':        'unique',
    'mythic-3ga':             'mythic',
    'ancestral-unique-4ga':   'ancestral',
    'mythic-4ga':             'mythic',
    'chaos-unique-3ga':       'chaos',
};

// Discord embed colours per rarity
const RARITY_COLORS = {
    legendary: 0xC9A84C,
    ancestral: 0x9B59B6,
    unique:    0x1ABC9C,
    mythic:    0xE74C3C,
    chaos:     0xE67E22,
};

// ── CORS helpers ────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'https://diablo4-hof-site.pages.dev',
    'http://localhost:3333',
    'http://localhost:8787',
];

function getAllowedOrigin(requestOrigin) {
    if (!requestOrigin) return '*';
    if (requestOrigin.endsWith('.pages.dev') || requestOrigin.startsWith('http://localhost')) {
        return requestOrigin;
    }
    return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : '*';
}

function corsHeaders(requestOrigin) {
    return {
        'Access-Control-Allow-Origin':  getAllowedOrigin(requestOrigin),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
        'Access-Control-Max-Age':       '86400',
        'Vary': 'Origin',
    };
}

function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders('*'),
            ...extraHeaders,
        },
    });
}

function err(msg, status = 400) {
    return json({ error: msg }, status);
}

// ── Admin auth middleware ─────────────────────────────────────────
function requireAdmin(request, env) {
    const password = request.headers.get('X-Admin-Password') || '';
    const expected = env.ADMIN_PASSWORD || 'diablo4admin'; // fallback for local dev
    if (password !== expected) {
        return err('Unauthorized — invalid admin password', 401);
    }
    return null; // null = allowed
}

// ════════════════════════════════════════════════════════════════
// MAIN FETCH HANDLER
// ════════════════════════════════════════════════════════════════
export default {
    async fetch(request, env) {
        const url    = new URL(request.url);
        const path   = url.pathname;
        const method = request.method;
        const origin = request.headers.get('Origin') || '*';

        // Preflight
        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        try {
            // ── Public routes ────────────────────────────────────
            if (method === 'GET' && path === '/api/data')         return handleGetData(env);
            if (method === 'GET' && path === '/api/seasons')      return handleGetSeasons(env);
            if (method === 'GET' && path === '/api/leaderboard')  return handleGetLeaderboard(env);

            // ── Players ──────────────────────────────────────────
            if (method === 'POST' && path === '/api/players') {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleCreatePlayer(request, env);
            }
            const playerMatch = path.match(/^\/api\/players\/(\d+)$/);
            if (playerMatch) {
                if (method === 'PATCH') {
                    const deny = requireAdmin(request, env);
                    if (deny) return deny;
                    return handleUpdatePlayer(parseInt(playerMatch[1]), request, env);
                }
                if (method === 'DELETE') {
                    const deny = requireAdmin(request, env);
                    if (deny) return deny;
                    return handleDeletePlayer(parseInt(playerMatch[1]), env);
                }
            }

            // ── Achievements ─────────────────────────────────────
            // Public self-claim (must come before admin POST route)
            if (method === 'POST' && path === '/api/achievements/claim') {
                return handleClaimAchievement(request, env, origin);
            }
            if (method === 'POST' && path === '/api/achievements') {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleCreateAchievement(request, env);
            }
            const achDel = path.match(/^\/api\/achievements\/(\d+)$/);
            if (method === 'DELETE' && achDel) {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleDeleteAchievement(parseInt(achDel[1]), env);
            }

            // ── Seasons ──────────────────────────────────────────
            if (method === 'POST' && path === '/api/seasons') {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleCreateSeason(request, env);
            }
            const seasonPatch = path.match(/^\/api\/seasons\/(\d+)$/);
            if (method === 'PATCH' && seasonPatch) {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleUpdateSeason(parseInt(seasonPatch[1]), request, env);
            }

            // ── Discord Integration ─────────────────────────────
            if (path === '/api/discord/webhook') {
                if (method === 'GET') {
                    const deny = requireAdmin(request, env);
                    if (deny) return deny;
                    return handleGetDiscordWebhook(env);
                }
            }
            if (method === 'POST' && path === '/api/discord/settings') {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleUpdateDiscordSettings(request, env);
            }
            if (method === 'POST' && path === '/api/discord/test') {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleDiscordTest(env);
            }
            if (method === 'POST' && path === '/api/discord/welcome') {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleDiscordWelcome(env);
            }
            if (method === 'POST' && path === '/api/discord/leaderboard') {
                const deny = requireAdmin(request, env);
                if (deny) return deny;
                return handleDiscordLeaderboard(request, env);
            }

            // Legacy proxy route
            if (method === 'POST' && path === '/api/discord-webhook') {
                return handleDiscordWebhook(request, env);
            }

            return err('Not found', 404);
        } catch (e) {
            console.error('Worker error:', e);
            return err(e.message || 'Internal server error', 500);
        }
    }
};

// ════════════════════════════════════════════════════════════════
// GET /api/data — full payload for the frontend
// ════════════════════════════════════════════════════════════════
async function handleGetData(env) {
    const [playersRes, achRes, seasonsRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM players ORDER BY name').all(),
        env.DB.prepare('SELECT * FROM achievements ORDER BY timestamp DESC').all(),
        env.DB.prepare('SELECT * FROM seasons ORDER BY number DESC').all(),
    ]);

    const players = playersRes.results;
    const achs    = achRes.results;
    const seasons = seasonsRes.results;

    // Compute per-player stats
    const playerStats = players.map(p => {
        const mine = achs.filter(a => a.player_id === p.id);
        return {
            id:           p.id,
            name:         p.name,
            class:        p.class || 'Unknown',
            discord_id:   p.discord_id,
            totalPoints:  mine.reduce((s, a) => s + a.points, 0),
            achievements: mine.length,
        };
    });

    // Map achievements to frontend shape
    const achievements = achs.map(a => ({
        id:         a.id,
        type:       a.achievement_type,
        playerId:   a.player_id,
        playerName: a.player_name,
        timestamp:  a.timestamp,
        season:     a.season,
        notes:      a.notes,
        points:     a.points,
    }));

    // Compute per-season aggregates
    const seasonData = seasons.map(s => {
        const seasonAchs    = achs.filter(a => a.season === s.slug);
        const uniquePlayers = new Set(seasonAchs.map(a => a.player_id)).size;
        const totalPoints   = seasonAchs.reduce((sum, a) => sum + a.points, 0);
        return {
            id:                s.id,
            number:            s.number,
            name:              s.name,
            slug:              s.slug,
            status:            s.status,
            start_date:        s.start_date,
            end_date:          s.end_date,
            next_season_start: s.next_season_start,
            challenges_config: s.challenges_config ? JSON.parse(s.challenges_config) : null,
            players:           uniquePlayers,
            achievements:      seasonAchs.length,
            totalPoints,
        };
    });

    return json({ players: playerStats, achievements, seasons: seasonData });
}

// ════════════════════════════════════════════════════════════════
// GET /api/seasons
// ════════════════════════════════════════════════════════════════
async function handleGetSeasons(env) {
    const res = await env.DB.prepare('SELECT * FROM seasons ORDER BY number DESC').all();
    return json({ seasons: res.results });
}

// ════════════════════════════════════════════════════════════════
// GET /api/leaderboard
// ════════════════════════════════════════════════════════════════
async function handleGetLeaderboard(env) {
    const res = await env.DB.prepare(`
        SELECT
            p.id,
            p.name,
            p.class,
            COALESCE(SUM(a.points), 0) AS total_points,
            COUNT(a.id)                 AS achievement_count
        FROM players p
        LEFT JOIN achievements a ON p.id = a.player_id
        GROUP BY p.id, p.name, p.class
        ORDER BY total_points DESC
    `).all();

    return json({
        leaderboard: res.results.map(r => ({
            id:           r.id,
            name:         r.name,
            class:        r.class,
            totalPoints:  r.total_points,
            achievements: r.achievement_count,
        }))
    });
}

// ════════════════════════════════════════════════════════════════
// POST /api/players  [ADMIN]
// ════════════════════════════════════════════════════════════════
async function handleCreatePlayer(request, env) {
    const body = await request.json().catch(() => null);
    if (!body?.name) return err('name is required');

    const { name, class: cls = 'Unknown', discord_id = null } = body;

    const existing = await env.DB.prepare(
        'SELECT id FROM players WHERE name = ?'
    ).bind(name).first();
    if (existing) return err(`Player "${name}" already exists`, 409);

    const res = await env.DB.prepare(
        'INSERT INTO players (name, class, discord_id) VALUES (?, ?, ?)'
    ).bind(name, cls, discord_id).run();

    firePlayerAddedNotification(env, { name, class: cls, discord_id }).catch(e => console.error('Player notification failed:', e));

    return json({ success: true, id: res.meta.last_row_id }, 201);
}

// ════════════════════════════════════════════════════════════════
// DELETE /api/players/:id  [ADMIN]
// ════════════════════════════════════════════════════════════════
async function handleDeletePlayer(id, env) {
    const player = await env.DB.prepare('SELECT name FROM players WHERE id = ?').bind(id).first();
    await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run();
    if (player) {
        fireAdminLog(env, `🗑️ **Player Deleted**: ${player.name} (ID: ${id})`).catch(() => {});
    }
    return json({ success: true });
}

// ════════════════════════════════════════════════════════════════
// PATCH /api/players/:id  [ADMIN] — update name/class/discord_id
// ════════════════════════════════════════════════════════════════
async function handleUpdatePlayer(id, request, env) {
    const body = await request.json().catch(() => null);
    if (!body) return err('Invalid JSON body');

    const existing = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
    if (!existing) return err('Player not found', 404);

    const allowed = ['name', 'class', 'discord_id'];
    const sets = [];
    const vals = [];
    for (const field of allowed) {
        if (body[field] !== undefined) {
            sets.push(`${field} = ?`);
            vals.push(body[field]);
        }
    }
    if (sets.length === 0) return err('No valid fields to update');

    vals.push(id);
    await env.DB.prepare(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    return json({ success: true });
}

// ════════════════════════════════════════════════════════════════
// POST /api/achievements  [ADMIN]
// ════════════════════════════════════════════════════════════════
async function handleCreateAchievement(request, env) {
    const body = await request.json().catch(() => null);
    if (!body) return err('Invalid JSON body');

    const { playerId, achievementType, season, timestamp, notes } = body;
    if (!playerId || !achievementType || !season) {
        return err('playerId, achievementType and season are required');
    }

    // Allow explicit points override for custom challenge types
    let points = body.points !== undefined ? parseInt(body.points) : POINT_MAP[achievementType];
    if (points === undefined || isNaN(points)) {
        // Try to look up from season's challenges_config
        const seasonRow = await env.DB.prepare('SELECT challenges_config FROM seasons WHERE slug = ?').bind(season).first();
        if (seasonRow?.challenges_config) {
            try {
                const cfg = JSON.parse(seasonRow.challenges_config);
                const match = Array.isArray(cfg) && cfg.find(c => c.type === achievementType);
                if (match) points = match.pts;
            } catch (_) {}
        }
    }
    if (points === undefined || isNaN(points)) return err(`Unknown achievement type: ${achievementType}`);

    const player = await env.DB.prepare(
        'SELECT id, name, discord_id FROM players WHERE id = ?'
    ).bind(playerId).first();
    if (!player) return err('Player not found', 404);

    const ts = timestamp || new Date().toISOString();

    const res = await env.DB.prepare(`
        INSERT INTO achievements (player_id, player_name, achievement_type, points, season, notes, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(player.id, player.name, achievementType, points, season, notes || null, ts).run();

    const seasonInfo = await env.DB.prepare('SELECT name FROM seasons WHERE slug = ?').bind(season).first();
    fireAchievementNotification(env, {
        playerName:      player.name,
        discordId:       player.discord_id,
        achievementType,
        points,
        seasonName:      seasonInfo?.name || season,
        timestamp:       ts,
        notes,
    }).catch(e => console.error('Discord webhook failed:', e));

    return json({ success: true, achievementId: res.meta.last_row_id }, 201);
}

// ════════════════════════════════════════════════════════════════
// DELETE /api/achievements/:id  [ADMIN]
// ════════════════════════════════════════════════════════════════
async function handleDeleteAchievement(id, env) {
    const existing = await env.DB.prepare(
        'SELECT * FROM achievements WHERE id = ?'
    ).bind(id).first();
    if (!existing) return err('Achievement not found', 404);

    await env.DB.prepare('DELETE FROM achievements WHERE id = ?').bind(id).run();
    
    fireAdminLog(env, `🗑️ **Achievement Deleted**: #${id} (${existing.achievement_type} for ${existing.player_name})`).catch(() => {});
    
    return json({ success: true });
}

// ════════════════════════════════════════════════════════════════
// POST /api/achievements/claim  [PUBLIC]
// Self-claim: any player can mark an unclaimed achievement
// ════════════════════════════════════════════════════════════════
async function handleClaimAchievement(request, env, origin) {
    const body = await request.json().catch(() => null);
    if (!body) return err('Invalid JSON body');

    const { playerId, achievementType, season, notes } = body;
    if (!playerId || !achievementType || !season) {
        return err('playerId, achievementType and season are required');
    }

    // Allow points override for custom types (same logic as admin route)
    let points = body.points !== undefined ? parseInt(body.points) : POINT_MAP[achievementType];
    if (points === undefined || isNaN(points)) {
        const seasonRow = await env.DB.prepare('SELECT challenges_config FROM seasons WHERE slug = ?').bind(season).first();
        if (seasonRow?.challenges_config) {
            try {
                const cfg = JSON.parse(seasonRow.challenges_config);
                const match = Array.isArray(cfg) && cfg.find(c => c.type === achievementType);
                if (match) points = match.pts;
            } catch (_) {}
        }
    }
    if (points === undefined || isNaN(points)) return err(`Unknown achievement type: ${achievementType}`);

    const player = await env.DB.prepare(
        'SELECT id, name, discord_id FROM players WHERE id = ?'
    ).bind(playerId).first();
    if (!player) return err('Player not found', 404);

    // Check: is this achievement type already claimed this season?
    const alreadyClaimed = await env.DB.prepare(
        'SELECT id, player_name FROM achievements WHERE achievement_type = ? AND season = ? LIMIT 1'
    ).bind(achievementType, season).first();

    if (alreadyClaimed) {
        return err(`Already claimed by ${alreadyClaimed.player_name} this season`, 409);
    }

    const ts = new Date().toISOString();
    const res = await env.DB.prepare(`
        INSERT INTO achievements (player_id, player_name, achievement_type, points, season, notes, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(player.id, player.name, achievementType, points, season, notes || null, ts).run();

    // Fire Discord webhook with @mention
    const seasonRow = await env.DB.prepare('SELECT name FROM seasons WHERE slug = ?').bind(season).first();
    fireAchievementNotification(env, {
        playerName:      player.name,
        discordId:       player.discord_id,
        achievementType, points,
        seasonName:      seasonRow?.name || season,
        timestamp:       ts, notes,
    }).catch(e => console.error('Discord webhook failed:', e));

    return json({ success: true, achievementId: res.meta.last_row_id, points }, 201,
        corsHeaders(origin));
}

// ════════════════════════════════════════════════════════════════
// POST /api/seasons  [ADMIN]
// ════════════════════════════════════════════════════════════════
async function handleCreateSeason(request, env) {
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.slug || !body?.number) {
        return err('name, slug and number are required');
    }

    const { number, name, slug, status = 'upcoming', start_date, end_date, next_season_start, challenges_config } = body;

    const existing = await env.DB.prepare(
        'SELECT id FROM seasons WHERE slug = ?'
    ).bind(slug).first();
    if (existing) return err(`Season "${slug}" already exists`, 409);

    const configJson = challenges_config ? JSON.stringify(challenges_config) : null;

    const res = await env.DB.prepare(`
        INSERT INTO seasons (number, name, slug, status, start_date, end_date, next_season_start, challenges_config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(number, name, slug, status, start_date || null, end_date || null, next_season_start || null, configJson).run();

    fireSeasonAnnouncedNotification(env, { number, name, status, start_date }).catch(e => console.error('Season notification failed:', e));

    return json({ success: true, id: res.meta.last_row_id }, 201);
}

// ════════════════════════════════════════════════════════════════
// PATCH /api/seasons/:id  [ADMIN]
// ════════════════════════════════════════════════════════════════
async function handleUpdateSeason(id, request, env) {
    const body = await request.json().catch(() => null);
    if (!body) return err('Invalid JSON body');

    const existing = await env.DB.prepare(
        'SELECT * FROM seasons WHERE id = ?'
    ).bind(id).first();
    if (!existing) return err('Season not found', 404);

    // Build dynamic SET clause from allowed fields
    const allowed = ['name', 'status', 'start_date', 'end_date', 'next_season_start', 'number'];
    const sets = [];
    const vals = [];

    for (const field of allowed) {
        if (body[field] !== undefined) {
            sets.push(`${field} = ?`);
            vals.push(body[field]);
        }
    }
    // Handle challenges_config separately (needs JSON serialisation)
    if (body.challenges_config !== undefined) {
        sets.push('challenges_config = ?');
        vals.push(body.challenges_config ? JSON.stringify(body.challenges_config) : null);
    }
    if (sets.length === 0) return err('No valid fields to update');

    vals.push(id);
    await env.DB.prepare(
        `UPDATE seasons SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...vals).run();

    // If season is being set to active, fire a season-start Discord announcement
    if (body.status === 'active' && existing.status !== 'active') {
        const updated = await env.DB.prepare('SELECT * FROM seasons WHERE id = ?').bind(id).first();
        const players = await env.DB.prepare('SELECT name, discord_id FROM players ORDER BY name').all();
        fireSeasonStartNotification(env, updated, players.results || [])
            .catch(e => console.error('Season start Discord notification failed:', e));
    }

    return json({ success: true });
}

// ════════════════════════════════════════════════════════════════
// POST /api/discord-webhook  — proxy route (e.g. for custom messages)
// ════════════════════════════════════════════════════════════════
async function handleDiscordWebhook(request, env) {
    const body = await request.json().catch(() => null);
    if (!body) return err('Invalid JSON body');

    await fireDiscordWebhook(env, body);
    return json({ success: true });
}

// ════════════════════════════════════════════════════════════════
// DISCORD HELPERS
// ════════════════════════════════════════════════════════════════

const ACHIEVEMENT_NAMES = {
    'legendary-item':         'Legendary Item',
    'ancestral-legendary':    'Ancestral Legendary',
    'unique-item':            'Unique Item',
    'ancestral-unique':       'Ancestral Unique',
    'ancestral-legendary-2ga':'Ancestral Legendary (2GA)',
    'ancestral-unique-2ga':   'Ancestral Unique (2GA)',
    'chaos-unique-1ga':       'Chaos Unique (1GA)',
    'any-1ga-item':           'Any 1GA Item',
    'ancestral-unique-3ga':   'Ancestral Unique (3GA)',
    'ancestral-legendary-3ga':'Ancestral Legendary (3GA)',
    'mythic-1ga':             'Mythic Item (1GA)',
    'mythic-no-cache':        'Mythic (No Cache)',
    'mythic-2ga':             'Mythic Item (2GA)',
    'chaos-unique-2ga':       'Chaos Unique (2GA)',
    'grandpapa-bonus':        'Grandpapa Bonus',
    'mythic-3ga':             'Mythic Item (3GA)',
    'ancestral-unique-4ga':   'Ancestral Unique (4GA)',
    'mythic-4ga':             'Mythic Item (4GA)',
    'chaos-unique-3ga':       'Chaos Unique (3GA)',
};

const ACHIEVEMENT_ICONS = {
    legendary: '🪙', ancestral: '⚔️', unique: '👑', mythic: '✨', chaos: '🌀',
};

/* Low-level: POST any payload to the Discord webhook */
async function postToDiscord(env, payload) {
    const url = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('discord_webhook_url').first()
                .then(r => r?.value || env.DISCORD_WEBHOOK_URL);

    if (!url) { console.warn('DISCORD_WEBHOOK_URL not set — skipping'); return; }
    const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
    });
    if (!res.ok) console.error('Discord responded', res.status, await res.text());
}

/* --- ACHIEVEMENT NOTIFICATION --- */
async function fireAchievementNotification(env, data) {
    const { playerName, discordId, achievementType, points, seasonName, timestamp, notes } = data;

    const rarity     = RARITY_MAP[achievementType] || 'legendary';
    const color      = RARITY_COLORS[rarity] || 0xC9A84C;
    const achName    = ACHIEVEMENT_NAMES[achievementType] || achievementType;
    const icon       = ACHIEVEMENT_ICONS[rarity] || '🏆';
    const ptStr      = points === 1 ? '🪙 1 Point' : `🪙 ${points} Points`;
    const rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    const dateStr    = timestamp
        ? new Date(timestamp).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : 'Just now';

    // @mention if we have a discord_id, otherwise bold name
    const mention = discordId ? `<@${discordId}>` : `**${playerName}**`;

    const embed = {
        title:       `${icon} Achievement Unlocked — ${achName}`,
        description: `${mention} has claimed a new achievement in **${seasonName || 'current season'}**! 🎉`,
        color,
        fields: [
            { name: 'Rarity',   value: rarityName,      inline: true },
            { name: 'Points',   value: ptStr,           inline: true },
            { name: 'Season',   value: seasonName||'—', inline: true },
            { name: 'Claimed',  value: dateStr,         inline: true },
        ],
        footer:    { text: 'Diablo IV — Hall of Legends' },
        timestamp: timestamp || new Date().toISOString(),
    };
    if (notes) embed.fields.push({ name: 'Notes', value: notes, inline: false });

    await postToDiscord(env, { username: 'Hall of Legends', embeds: [embed] });
}

/* Legacy alias so the proxy route still works */
async function fireDiscordWebhook(env, data) {
    return fireAchievementNotification(env, data);
}

/* --- SEASON START NOTIFICATION --- */
async function fireSeasonStartNotification(env, season, players) {
    // Parse challenges_config
    let cfg = [];
    try { cfg = season.challenges_config ? JSON.parse(season.challenges_config) : []; } catch (_) {}
    const active = cfg.filter(c => c.active !== false);

    // Group by point value
    const byPts = {};
    active.forEach(c => {
        const k = c.pts || 1;
        if (!byPts[k]) byPts[k] = [];
        byPts[k].push(c.name || c.type);
    });

    const challengeLines = Object.keys(byPts)
        .sort((a, b) => Number(a) - Number(b))
        .map(pts => {
            const ptsNum  = Number(pts);
            const coins   = '🪙'.repeat(ptsNum);
            const list    = byPts[pts].map(n => `• ${n}`).join('\n');
            return { name: `${coins} ${ptsNum} Point${ptsNum > 1 ? 's' : ''}`, value: list, inline: false };
        });

    // @mention all players with a discord_id
    const mentions = players
        .filter(p => p.discord_id)
        .map(p => `<@${p.discord_id}>`)
        .join(' ');

    const seasonNum   = season.number ? `Season ${season.number}` : '';
    const endDateStr  = season.end_date
        ? new Date(season.end_date).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })
        : 'TBD';

    const embed = {
        title:       `⚔️ ${seasonNum ? seasonNum + ' — ' : ''}${season.name} Has Begun!`,
        description: `The new Diablo IV season is now **ACTIVE**. Time to grind for glory, Champions!\n\n📅 **Season ends:** ${endDateStr}`,
        color:       0x8B0000, // blood red
        image:       { url: 'https://images.blzstatic.com/diablo4/season-banner.jpg' }, // Placeholder for potential future dynamic image
        fields:      challengeLines.length > 0
            ? [{ name: '🏆 Available Challenges', value: '​', inline: false }, ...challengeLines]
            : [{ name: 'Challenges', value: 'No challenges configured yet', inline: false }],
        footer:    { text: 'Diablo IV — Hall of Legends • May the best champion win!' },
        timestamp: new Date().toISOString(),
    };

    const content = mentions
        ? `🔔 **NEW SEASON ALERT!** ${mentions} — your competition begins now! ⚔️`
        : '🔔 **A new Diablo IV Hall of Legends season has started!** ⚔️';

    await postToDiscord(env, { content, username: 'Hall of Legends', embeds: [embed] });
}

/* --- PLAYER ADDED NOTIFICATION --- */
async function firePlayerAddedNotification(env, player) {
    const embed = {
        title: `🆕 New Champion Joined!`,
        description: `A new warrior has entered the Hall of Legends. Welcome, **${player.name}**!`,
        color: 0x3498db,
        fields: [
            { name: 'Class', value: player.class, inline: true },
            { name: 'Status', value: 'Ready for the Grind ⚔️', inline: true }
        ],
        footer: { text: 'Diablo IV — Hall of Legends' },
        timestamp: new Date().toISOString()
    };
    if (player.discord_id) embed.description += ` (<@${player.discord_id}>)`;

    await postToDiscord(env, { username: 'Hall of Legends', embeds: [embed] });
}

/* --- SEASON ANNOUNCED NOTIFICATION --- */
async function fireSeasonAnnouncedNotification(env, season) {
    const dateStr = season.start_date 
        ? new Date(season.start_date).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }) 
        : 'To Be Announced';

    const embed = {
        title: `📜 New Season Announced: ${season.name}`,
        description: `Preparation begins! A new season has been recorded in the archives.`,
        color: 0xf39c12,
        fields: [
            { name: 'Season Number', value: String(season.number), inline: true },
            { name: 'Status', value: season.status.toUpperCase(), inline: true },
            { name: 'Start Date', value: dateStr, inline: false }
        ],
        footer: { text: 'Diablo IV — Hall of Legends' },
        timestamp: new Date().toISOString()
    };

    await postToDiscord(env, { username: 'Hall of Legends', embeds: [embed] });
}

// ════════════════════════════════════════════════════════════════
// DISCORD ADMIN HANDLERS
// ════════════════════════════════════════════════════════════════

async function handleGetDiscordWebhook(env) {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('discord_webhook_url').first();
    const url = row?.value || env.DISCORD_WEBHOOK_URL || '';
    return json({ url });
}

async function handleUpdateDiscordSettings(request, env) {
    const body = await request.json().catch(() => null);
    if (!body?.url) return err('URL is required');

    await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .bind('discord_webhook_url', body.url).run();

    return json({ success: true });
}

async function handleDiscordTest(env) {
    const embed = {
        title: '📡 System Connection Test',
        description: 'Successfully connected to the Diablo IV Hall of Legends portal! ✅',
        color: 0x4ade80,
        fields: [
            { name: 'Status', value: 'Online', inline: true },
            { name: 'Time', value: new Date().toISOString(), inline: true }
        ],
        footer: { text: 'Diablo IV — Admin Tools' }
    };
    await postToDiscord(env, { username: 'Hall of Legends', embeds: [embed] });
    return json({ success: true });
}

async function handleDiscordWelcome(env) {
    const season = await env.DB.prepare('SELECT * FROM seasons WHERE status = "active" LIMIT 1').first();

    const embed = {
        title: '🎉 Welcome to the Hall of Legends!',
        description: 'The definitive platform for tracking our Diablo IV conquests and competitive seasonal achievements.',
        color: 0xc9a84c,
        fields: [
            { name: '🌐 Access the Portal', value: 'https://diablo4-hof-site.pages.dev', inline: false },
            { name: '🎯 How it Works', value: 'Record your rare drops and achievements. Compete for the top spot on the seasonal and all-time leaderboards!', inline: false },
            { name: '⚔️ Current Season', value: season ? `**${season.name}** is currently active!` : 'No active season at the moment.', inline: true },
            { name: '📦 Features', value: '• Bingo Board\n• Live Leaderboards\n• Achievement History\n• Discord Sync', inline: true }
        ],
        footer: { text: 'Diablo IV — Built for the Grind' },
        timestamp: new Date().toISOString()
    };

    await postToDiscord(env, { username: 'Hall of Legends', embeds: [embed] });
    return json({ success: true });
}

async function handleDiscordLeaderboard(request, env) {
    const body = await request.json().catch(() => null);
    const seasonSlug = body?.season;
    if (!seasonSlug) return err('Season slug is required');

    const season = await env.DB.prepare('SELECT * FROM seasons WHERE slug = ?').bind(seasonSlug).first();
    if (!season) return err('Season not found', 404);

    // Get standings
    const res = await env.DB.prepare(`
        SELECT p.name, COALESCE(SUM(a.points), 0) as pts, COUNT(a.id) as achs
        FROM players p
        JOIN achievements a ON p.id = a.player_id
        WHERE a.season = ?
        GROUP BY p.id
        ORDER BY pts DESC, achs DESC
    `).bind(seasonSlug).all();

    const results = res.results || [];
    if (results.length === 0) {
        return err('No scores found for this season yet');
    }

    // Top 3 medals
    const medals = ['🥇', '🥈', '🥉'];
    let rankedList = results.map((r, i) => {
        const medal = medals[i] || `${i + 1}.`;
        return `${medal} **${r.name}** — ${r.pts} pts (${r.achs} achievements)`;
    }).join('\n');

    // Limit if too long
    if (rankedList.length > 2000) rankedList = rankedList.substring(0, 1990) + '...';

    const embed = {
        title: `🏆 ${season.name} — Current Standings`,
        description: results.length > 0 ? rankedList : 'No participants yet.',
        color: 0xc9a84c,
        footer: { text: `Diablo IV — Hall of Legends • ${season.name}` },
        timestamp: new Date().toISOString()
    };

    await postToDiscord(env, { username: 'Hall of Legends', embeds: [embed] });
    return json({ success: true });
}

/* --- GENERIC ADMIN LOG --- */
async function fireAdminLog(env, message) {
    const embed = {
        description: message,
        color: 0x2c3e50,
        footer: { text: 'Admin Log — Hall of Legends' },
        timestamp: new Date().toISOString()
    };
    await postToDiscord(env, { username: 'Admin Bot', embeds: [embed] });
}
