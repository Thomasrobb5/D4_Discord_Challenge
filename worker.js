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
    'legendary-item':   1, 'unique-item':      1, 'rare-1ga':         1, 'legendary-1ga':    1, 'unique-1ga':       1, 'pre-torment-set':  1, 'tower-500':        1, 'journey-4':        1,
    'rare-2ga':         2, 'legendary-2ga':    2, 'unique-2ga':       2, 'legendary-rune':   2, 'pit-50':           2, 'echoing-50':       2, 'torment-set':      2, 'tower-250':        2, 'journey-5':        2, 'paragon-225':      2,
    'rare-3ga':         3, 'legendary-3ga':    3, 'unique-3ga':       3, 'mythic-1ga':       3, 'pit-100':          3, 'echoing-100':      3, 'journey-6':        3, 'paragon-250':      3,
    'rare-4ga':         4, 'legendary-4ga':    4, 'unique-4ga':       4, 'mythic-2ga':       4, 'paragon-275':      4,
    'mythic-3ga':       5, 'journey-9':        5, 'paragon-300':      5,
    'mythic-4ga':       10,
};

// ── Rarity map ───────────────────────────────────────────────────
const RARITY_MAP = {
    'legendary-item':   'legendary', 'unique-item':      'unique',    'rare-1ga':         'legendary', 'legendary-1ga':    'legendary', 'unique-1ga':       'unique',    'pre-torment-set':  'ancestral', 'tower-500':        'legendary', 'journey-4':        'legendary',
    'rare-2ga':         'legendary', 'legendary-2ga':    'legendary', 'unique-2ga':       'unique',    'legendary-rune':   'legendary', 'pit-50':           'legendary', 'echoing-50':       'legendary', 'torment-set':      'ancestral', 'tower-250':        'legendary', 'journey-5':        'legendary', 'paragon-225':      'legendary',
    'rare-3ga':         'legendary', 'legendary-3ga':    'legendary', 'unique-3ga':       'unique',    'mythic-1ga':       'mythic',    'pit-100':          'legendary', 'echoing-100':      'legendary', 'journey-6':        'legendary', 'paragon-250':      'legendary',
    'rare-4ga':         'legendary', 'legendary-4ga':    'legendary', 'unique-4ga':       'unique',    'mythic-2ga':       'mythic',    'paragon-275':      'legendary',
    'mythic-3ga':       'mythic',    'journey-9':        'legendary', 'paragon-300':      'legendary',
    'mythic-4ga':       'mythic',
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
    'https://d4-discord-challenge.pages.dev',
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
            if (method === 'GET' && path === '/api/data')         return handleGetData(env, request);
            if (method === 'GET' && path === '/api/seasons')      return handleGetSeasons(env);
            if (method === 'GET' && path === '/api/leaderboard')  return handleGetLeaderboard(env);
            if (method === 'GET' && path === '/api/auth/login')   return handleAuthLogin(env, origin);
            if (method === 'GET' && path === '/api/auth/callback') return handleAuthCallback(request, env, origin);

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
            const seasonMatch = path.match(/^\/api\/seasons\/(\d+)$/);
            if (seasonMatch) {
                if (method === 'PATCH') {
                    const deny = requireAdmin(request, env);
                    if (deny) return deny;
                    return handleUpdateSeason(parseInt(seasonMatch[1]), request, env);
                }
                if (method === 'DELETE') {
                    const deny = requireAdmin(request, env);
                    if (deny) return deny;
                    return handleDeleteSeason(parseInt(seasonMatch[1]), env);
                }
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
    },

    // ── Background Task (Cron) ───────────────────────────────────
    async scheduled(event, env, ctx) {
        ctx.waitUntil(handleScheduled(env));
    }
};

// ════════════════════════════════════════════════════════════════
// BACKGROUND MANAGEMENT (AUTO-START/END)
// ════════════════════════════════════════════════════════════════
async function handleScheduled(env) {
    console.log('Running background season maintenance...');
    const nowISO = new Date().toISOString();

    // 1. AUTO-START: Upcoming -> Active
    const toStart = await env.DB.prepare(
        'SELECT * FROM seasons WHERE status = "upcoming" AND start_date IS NOT NULL AND start_date <= ?'
    ).bind(nowISO).all();

    for (const season of toStart.results || []) {
        console.log(`Auto-activating season: ${season.name}`);
        await env.DB.prepare('UPDATE seasons SET status = "active" WHERE id = ?').bind(season.id).run();
        
        const playersRes = await env.DB.prepare('SELECT name, discord_id FROM players WHERE discord_id IS NOT NULL').all();
        await fireSeasonStartNotification(env, season, playersRes.results || [])
            .catch(e => console.error('Auto-activation Discord failed:', e));
    }

    // 2. AUTO-ARCHIVE: Active -> Completed
    const toEnd = await env.DB.prepare(
        'SELECT * FROM seasons WHERE status = "active" AND end_date IS NOT NULL AND end_date <= ?'
    ).bind(nowISO).all();

    for (const season of toEnd.results || []) {
        console.log(`Auto-archiving season: ${season.name}`);
        await env.DB.prepare('UPDATE seasons SET status = "completed" WHERE id = ?').bind(season.id).run();
        
        await fireAdminLog(env, `🏁 **Season Ended**: **${season.name}** has reached its end date and is now archived. Check the leaderboard for the final standings!`)
            .catch(() => {});
    }
}

// ════════════════════════════════════════════════════════════════
// GET /api/data — full payload for the frontend
// ════════════════════════════════════════════════════════════════
async function handleGetData(env, request) {
    const [playersRes, achRes, seasonsRes] = await Promise.all([
        env.DB.prepare('SELECT id, name, class, discord_id, avatar FROM players ORDER BY name').all(),
        env.DB.prepare('SELECT * FROM achievements ORDER BY timestamp DESC').all(),
        env.DB.prepare('SELECT * FROM seasons ORDER BY number DESC').all(),
    ]);

    const players = playersRes.results;
    const achs    = achRes.results;
    const seasons = seasonsRes.results;

    // Optional: Check if requester is logged in
    let user = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        user = await verifyJWT(token, env.JWT_SECRET).catch(() => null);
    }

    // Fetch badges
    const badgesRes = await env.DB.prepare('SELECT * FROM badges').all();
    const badges    = badgesRes.results || [];

    // Compute per-player stats
    const playerStats = players.map(p => {
        const mine = achs.filter(a => a.player_id === p.id);
        return {
            id:           p.id,
            name:         p.name,
            class:        p.class || 'Unknown',
            discord_id:   p.discord_id,
            avatar:       p.avatar,
            totalPoints:  mine.reduce((s, a) => s + a.points, 0),
            achievements: mine.length,
            badges:       badges.filter(b => b.player_id === p.id).map(b => b.badge_type)
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

    return json({ 
        players: playerStats, 
        achievements, 
        seasons: seasonData,
        user // session info
    });
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

    await firePlayerAddedNotification(env, { name, class: cls, discord_id }).catch(e => console.error('Player notification failed:', e));

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
    await fireAchievementNotification(env, {
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
    await fireAchievementNotification(env, {
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

    await fireSeasonAnnouncedNotification(env, { number, name, status, start_date }).catch(e => console.error('Season notification failed:', e));

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

    // 1. If season is being set to active (from something else)
    const becameActive = body.status === 'active' && existing.status !== 'active';
    // 2. If challenges were updated on an ALREADY active season
    const challengesUpdated = body.challenges_config !== undefined && existing.status === 'active';

    if (becameActive || challengesUpdated) {
        const updated = await env.DB.prepare('SELECT * FROM seasons WHERE id = ?').bind(id).first();
        const playersRes = await env.DB.prepare('SELECT name, discord_id FROM players WHERE discord_id IS NOT NULL').all();
        
        if (becameActive) {
            await fireSeasonStartNotification(env, updated, playersRes.results || [])
                .catch(e => console.error('Season start notification failed:', e));
        } else {
            await fireAdminLog(env, `🔄 **Season Challenges Updated**: The challenge list for **${updated.name}** has been updated! Check the portal for details.`)
                .catch(e => console.error('Challenge update log failed:', e));
        }
    }

    return json({ success: true });
}

async function handleDeleteSeason(id, env) {
    const season = await env.DB.prepare('SELECT name FROM seasons WHERE id = ?').bind(id).first();
    if (!season) return err('Season not found', 404);

    await env.DB.prepare('DELETE FROM seasons WHERE id = ?').bind(id).run();
    // Also delete achievements for this season? For now, we'll keep them in history or delete them?
    // User asked to "delete seasons", usually implies wiping it. 
    // We'll leave achievements to avoid accidental mass-deletion of data if they just want to hide it, 
    // BUT actually DB schema might have foreign keys or it might just be a string slug.
    // Let's just delete the season record.
    
    fireAdminLog(env, `🗑️ **Season Deleted**: ${season.name} (ID: ${id})`).catch(() => {});
    return json({ success: true });
}

// ════════════════════════════════════════════════════════════════
// POST /api/discord-webhook  — proxy route (e.g. for custom messages)
// ════════════════════════════════════════════════════════════════
async function handleDiscordWebhook(request, env) {
    const body = await request.json().catch(() => null);
    if (!body) return err('Invalid JSON body');

    await fireAdminLog(env, body.message || 'Manual webhook trigger');
    return json({ success: true });
}

// ════════════════════════════════════════════════════════════════
// DISCORD HELPERS
// ════════════════════════════════════════════════════════════════

const ACHIEVEMENT_NAMES = {
    'legendary-item':   'Legendary (Non GA)', 'unique-item':      'Unique',    'rare-1ga':         'Rare 1GA', 'legendary-1ga':    'Legendary 1GA', 'unique-1ga':       'Unique 1GA',       'pre-torment-set':  'Pre-Torment Set (Charm)', 'tower-500':        'Tower Rank Top-500', 'journey-4':        'Season Journey Rank: IV',
    'rare-2ga':         'Rare 2GA', 'legendary-2ga':    'Legendary 2GA', 'unique-2ga':       'Unique 2GA',       'legendary-rune':   'Legendary Rune',   'pit-50':           'Solo Pit 50',              'echoing-50':       'Solo Echoing Hatred 50',   'torment-set':      'Torment Set Item', 'tower-250':        'Tower Rank Top-250', 'journey-5':        'Season Journey Rank: V', 'paragon-225':      'Paragon Lvl 225',
    'rare-3ga':         'Rare 3GA', 'legendary-3ga':    'Legendary 3GA', 'unique-3ga':       'Unique 3GA',       'mythic-1ga':       'Mythic 1GA',       'pit-100':          'Solo Pit 100',             'echoing-100':      'Solo Echoing Hatred 100',  'journey-6':        'Season Journey Rank: VI', 'paragon-250':      'Paragon Lvl 250',
    'rare-4ga':         'Rare 4GA', 'legendary-4ga':    'Legendary 4GA', 'unique-4ga':       'Unique 4GA',       'mythic-2ga':       'Mythic 2GA',       'paragon-275':      'Paragon Lvl 275',
    'mythic-3ga':       'Mythic 3GA',    'journey-9':        'Season Journey Rank: IX', 'paragon-300':      'Paragon Lvl 300',
    'mythic-4ga':       'Mythic 4GA',
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
    if (!res.ok) {
        const text = await res.text();
        console.error(`Discord Error [${res.status}]:`, text);
        throw new Error(`Discord responded with ${res.status}: ${text}`);
    }
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
    const portalUrl = 'https://d4-discord-challenge.pages.dev';

    const embed = {
        title: '🔥 Welcome to the Hall of Legends!',
        description: 'The definitive competitive platform for tracking our Clan\'s Diablo IV conquests and legendary seasonal achievements.',
        color: 0xc9a84c,
        thumbnail: { url: 'https://images.blzstatic.com/diablo4/logo-icon.png' },
        fields: [
            { 
                name: '🌐 The Portal', 
                value: `[**Enter the Hall of Legends**](${portalUrl})\n*Track standings, view the Bingo board, and browse the history of our mightiest champions.*`, 
                inline: false 
            },
            { 
                name: '🎯 How it Works', 
                value: 'Our competition is simple: **Conquer the darkness and record your spoils.**\n\n1. Find rare Ancestral, Unique, or Mythic items.\n2. Record your feat via the Portal.\n3. Gain **Glory Points** to climb the Seasonal and All-Time leaderboards.', 
                inline: false 
            },
            { 
                name: '🪙 Point System', 
                value: '• **1 Point**: Legendaries, Uniques, 1GA Items, Tower Top-500, Journey IV.\n• **2 Points**: 2GA Items, Solo Pit 50, Paragon 225, Legendary Runes.\n• **3 Points**: 3GA Items, Mythic 1GA, Solo Pit 100, Paragon 250.\n• **4-10 Points**: 4GA Items, Mythic 2-4GA, Paragon 300, End-game Conquests.', 
                inline: true 
            },
            { 
                name: '⚔️ Current Status', 
                value: season ? `**Season ${season.number}: ${season.name}** is currently **ACTIVE**!` : 'We are currently between seasons. Prepare for the next grind!', 
                inline: true 
            },
            { 
                name: '📦 Portal Features', 
                value: '• **Bingo Board**: First to claim a slot wins it for the season!\n• **Live Leaderboards**: Real-time ranking of our clan members.\n• **Achievement Gallery**: A permanent record of every legendary drop.', 
                inline: false 
            }
        ],
        footer: { text: 'Diablo IV — Hall of Legends • Built for the Eternal Grind' },
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
// ════════════════════════════════════════════════════════════════
// DISCORD AUTH & JWT HELPERS
// ════════════════════════════════════════════════════════════════

async function handleAuthLogin(env, origin) {
    if (!env.DISCORD_CLIENT_ID) return err('Discord Auth not configured on server', 500);
    
    const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: `${origin}/api/auth/callback`,
        response_type: 'code',
        scope: 'identify',
    });
    
    return Response.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`, 302);
}

async function handleAuthCallback(request, env, origin) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) return err('No code provided', 400);

    // 1. Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${origin}/api/auth/callback`,
        }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenRes.ok) return err('Failed to exchange token', 400);
    const tokenData = await tokenRes.json();

    // 2. Get User Info
    const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userRes.ok) return err('Failed to fetch user info', 400);
    const discordUser = await userRes.json();

    // 3. Upsert Player in DB
    let player = await env.DB.prepare('SELECT * FROM players WHERE discord_id = ?').bind(discordUser.id).first();
    
    if (!player) {
        // Create new player or match by name? For now, create new.
        const res = await env.DB.prepare('INSERT INTO players (name, discord_id, avatar) VALUES (?, ?, ?)')
            .bind(discordUser.username, discordUser.id, discordUser.avatar).run();
        player = { id: res.meta.last_row_id, name: discordUser.username, discord_id: discordUser.id };
        await env.DB.prepare('INSERT INTO badges (player_id, badge_type) VALUES (?, ?)').bind(player.id, 'the-founder').run().catch(() => {});
    } else {
        // Update avatar if changed
        await env.DB.prepare('UPDATE players SET avatar = ? WHERE id = ?').bind(discordUser.avatar, player.id).run();
    }

    // 4. Generate JWT
    const jwt = await generateJWT({ id: player.id, name: player.name, discord_id: player.discord_id }, env.JWT_SECRET);

    // Redirect back to main site with token in URL (fragment is safer)
    return Response.redirect(`${origin}/#token=${jwt}`, 302);
}

// ── JWT UTILS (Web Crypto) ──────────────────────────────────────
async function generateJWT(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) })); // 1 week
    
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    
    const signature = await crypto.subtle.sign(
        'HMAC', key,
        new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJWT(token, secret) {
    const [header, payload, signature] = token.split('.');
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['verify']
    );
    
    const sigArray = new Uint8Array(atob(signature.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)));
    const isValid = await crypto.subtle.verify(
        'HMAC', key, sigArray,
        new TextEncoder().encode(`${header}.${payload}`)
    );
    
    if (!isValid) throw new Error('Invalid token');
    return JSON.parse(atob(payload));
}
