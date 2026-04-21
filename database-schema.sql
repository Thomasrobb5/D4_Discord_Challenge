-- ═══════════════════════════════════════════════════════════════
-- Cloudflare D1 Schema — Diablo IV Hall of Legends
-- Run: npm run db:init          (local dev)
-- Run: npm run db:init:remote   (production)
-- ═══════════════════════════════════════════════════════════════

-- ── PLAYERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE NOT NULL,
    class      TEXT DEFAULT 'Unknown',
    discord_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── SEASONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasons (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    number              INTEGER NOT NULL,
    name                TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    status              TEXT DEFAULT 'active',   -- 'active' | 'upcoming' | 'completed'
    start_date          DATETIME,
    end_date            DATETIME,                -- countdown target for active season
    next_season_start   DATETIME,                -- countdown target for upcoming season
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── ACHIEVEMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id        INTEGER NOT NULL,
    player_name      TEXT NOT NULL,
    achievement_type TEXT NOT NULL,
    points           INTEGER NOT NULL DEFAULT 1,
    season           TEXT NOT NULL,              -- season slug
    notes            TEXT,
    timestamp        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- ── SETTINGS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- ── INDEXES ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ach_player  ON achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_ach_season  ON achievements(season);
CREATE INDEX IF NOT EXISTS idx_ach_type    ON achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_ach_ts      ON achievements(timestamp DESC);

-- ═══════════════════════════════════════════════════════════════
-- SEED: PLAYERS
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO players (id, name, class, discord_id) VALUES
(1, 'Telchis',     'Necromancer',  NULL),
(2, 'Jubbs',       'Rogue',        NULL),
(3, 'Tom',         'Barbarian',    NULL),
(4, 'Ross',        'Sorcerer',     NULL),
(5, 'Mitchell',    'Druid',        NULL);

-- ═══════════════════════════════════════════════════════════════
-- SEED: SEASONS
-- Season 10 active — ends ~mid-July 2025 (adjust accordingly)
-- Season 11 upcoming — starts when S10 ends
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO seasons (id, number, name, slug, status, start_date, end_date, next_season_start) VALUES
(1, 10, 'Season of the Infernal Hordes', 'season-10', 'active',
    '2025-04-15 17:00:00',
    '2025-07-15 17:00:00',      -- Season 10 end — UPDATE THIS
    '2025-07-15 17:00:00'),     -- Season 11 start (same day S10 ends)

(2, 9, 'Season of the Construct', 'season-9', 'completed',
    '2025-01-15 17:00:00',
    '2025-04-15 17:00:00',
    NULL),

(3, 8, 'Season of Blood', 'season-8', 'completed',
    '2024-10-15 17:00:00',
    '2025-01-15 17:00:00',
    NULL),

(4, 7, 'Season of the Witch', 'season-7', 'completed',
    '2024-07-15 17:00:00',
    '2024-10-15 17:00:00',
    NULL),

(5, 6, 'Season of Hatred Rising', 'season-hatred-rising', 'completed',
    '2024-04-15 17:00:00',
    '2024-07-15 17:00:00',
    NULL);

-- ═══════════════════════════════════════════════════════════════
-- SEED: ACHIEVEMENTS — Season 10
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO achievements (id, player_id, player_name, achievement_type, points, season, timestamp) VALUES
(1,  1, 'Telchis', 'legendary-item',         1, 'season-10', '2025-04-15 08:30:00'),
(2,  2, 'Jubbs',   'ancestral-unique',        1, 'season-10', '2025-04-15 10:45:00'),
(3,  2, 'Jubbs',   'ancestral-legendary-2ga', 1, 'season-10', '2025-04-16 14:20:00'),
(4,  2, 'Jubbs',   'chaos-unique-1ga',        1, 'season-10', '2025-04-17 09:15:00'),
(5,  2, 'Jubbs',   'ancestral-legendary-3ga', 2, 'season-10', '2025-04-18 11:30:00'),
(6,  3, 'Tom',     'legendary-item',          1, 'season-10', '2025-04-15 12:00:00'),
(7,  3, 'Tom',     'mythic-1ga',              2, 'season-10', '2025-04-19 15:30:00'),
(8,  4, 'Ross',    'unique-item',             1, 'season-10', '2025-04-16 09:00:00'),
(9,  1, 'Telchis', 'chaos-unique-2ga',        2, 'season-10', '2025-04-18 16:45:00');

-- Season 9 Achievements
INSERT OR IGNORE INTO achievements (id, player_id, player_name, achievement_type, points, season, timestamp) VALUES
(10, 2, 'Jubbs',   'legendary-item',          1, 'season-9', '2025-01-15 09:00:00'),
(11, 2, 'Jubbs',   'ancestral-legendary',     1, 'season-9', '2025-01-16 10:30:00'),
(12, 1, 'Telchis', 'unique-item',             1, 'season-9', '2025-01-17 08:15:00'),
(13, 3, 'Tom',     'ancestral-unique',        1, 'season-9', '2025-01-18 12:45:00'),
(14, 2, 'Jubbs',   'ancestral-legendary-2ga', 1, 'season-9', '2025-01-19 14:20:00'),
(15, 3, 'Tom',     'ancestral-unique-2ga',    1, 'season-9', '2025-01-20 11:00:00'),
(16, 1, 'Telchis', 'ancestral-unique-3ga',    2, 'season-9', '2025-01-21 15:30:00'),
(17, 3, 'Tom',     'mythic-1ga',              2, 'season-9', '2025-01-22 13:45:00'),
(18, 1, 'Telchis', 'mythic-2ga',              2, 'season-9', '2025-01-23 16:20:00'),
(19, 2, 'Jubbs',   'ancestral-unique-4ga',    3, 'season-9', '2025-02-01 10:30:00');

-- Season 8 Achievements
INSERT OR IGNORE INTO achievements (id, player_id, player_name, achievement_type, points, season, timestamp) VALUES
(20, 4, 'Ross',    'legendary-item',          1, 'season-8', '2024-10-15 09:30:00'),
(21, 3, 'Tom',     'ancestral-legendary',     1, 'season-8', '2024-10-16 11:00:00'),
(22, 4, 'Ross',    'unique-item',             1, 'season-8', '2024-10-17 08:45:00'),
(23, 2, 'Jubbs',   'ancestral-unique',        1, 'season-8', '2024-10-18 13:15:00'),
(24, 3, 'Tom',     'ancestral-legendary-2ga', 1, 'season-8', '2024-10-19 14:30:00'),
(25, 3, 'Tom',     'ancestral-unique-2ga',    1, 'season-8', '2024-10-20 12:00:00'),
(26, 3, 'Tom',     'ancestral-unique-3ga',    2, 'season-8', '2024-10-21 15:45:00'),
(27, 2, 'Jubbs',   'mythic-1ga',              2, 'season-8', '2024-10-22 10:20:00'),
(28, 2, 'Jubbs',   'mythic-2ga',              2, 'season-8', '2024-10-23 16:00:00'),
(29, 2, 'Jubbs',   'mythic-3ga',              3, 'season-8', '2024-10-28 14:30:00'),
(30, 3, 'Tom',     'ancestral-unique-4ga',    3, 'season-8', '2024-11-02 11:15:00');
