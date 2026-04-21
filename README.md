# Diablo IV — Hall of Legends 🎮⚡

> A fully-featured, gamified achievement & leaderboard tracker for Diablo IV seasonal clan competitions — powered entirely by Cloudflare Workers + D1, with Discord integration.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-diablo4--hof--site.pages.dev-orange?style=flat-square&logo=cloudflare)](https://diablo4-hof-site.pages.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Backend-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare%20D1-F38020?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/d1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)
[![Version](https://img.shields.io/badge/version-2.1.0-blueviolet?style=flat-square)](#)

---

## 🎯 What Is This?

Hall of Legends turns your Diablo IV seasonal group competition into an epic, dynamic leaderboard platform. Track who gets the first Mythic, first 4GA item, or any custom item achievement — with beautiful season-by-season history, an interactive bingo board, Discord notifications, and a powerful admin panel.

Built for a private friend group, but designed for any clan or Discord community.

---

## ✨ Features

### 🏠 Landing Screen
- Cinematic dark background with animated particle embers
- Season countdown clock (days / hours / mins / secs)
- Season cards with status badges (Active / Completed / Didn't Participate / Upcoming)
- Quick-access **All Time Leaderboard** shortcut link below the countdown

### 🏆 Season Leaderboard
- Animated 3-place **podium** (gold / silver / bronze) showing season-specific points
- Full ranked table with player class, season points, and achievement count
- Live search bar to filter players
- Stats bar: Champions · Achievements Claimed · Total Glory Points

### 🎯 Bingo Board (public claims)
- Interactive achievement grid grouped by point tier
- Any player can **self-claim** an achievement (no admin required)
- Claimed cells show the winner's name
- Season-aware: only shows challenges active for that season
- Discord notification auto-fires on claim

### 🎖️ Achievement Gallery
- Full history of all recorded achievements for the season
- Filter by rarity (Legendary / Ancestral / Unique / Mythic / Chaos)
- Filter by point value
- Search by player name or type
- Click any card for a detail modal

### 🌍 All Time Leaderboard
- Aggregated leaderboard across **all seasons** — keyed by player name with fallback ID matching so historical data is never lost
- 3-place podium for all-time rankings
- Season History table with **Season Winner** column (calculated live from achievement records)
- Seasons with no recorded activity show **😴 Didn't Participate** instead of a winner

### 🔒 Admin Panel (`/admin.html`)
Password-protected admin interface with tabs for:

| Tab | What you can do |
|-----|-----------------|
| **⚙️ Setup Season** | Create or edit seasons with challenge configurator and date pickers |
| **⚡ Record Achievement** | Record player achievements with Discord notification |
| **👥 Players** | Add / edit / delete players (name, class, Discord ID) |
| **📅 Seasons** | Legacy season management (end dates, status) |
| **📋 History** | View & delete all achievement records |
| **🔧 Tools** | Quick SQL utilities |

### ✨ Season Setup Wizard (Admin)
- Define season number, name, slug, status, start/end dates
- **Challenge Configurator**: toggle standard challenge types on/off per season, customize point values
- **Custom Challenges**: add brand-new challenge types for new seasons (e.g. new item types in S13 "Lord of Hatred") — auto-appear in bingo board & recording dropdowns
- **Enable All / Disable All** buttons for quick config
- Edit existing seasons (loads current config into the wizard)

---

## 🗂️ Project Structure

```
├── index.html              Main public-facing site (landing + in-season views)
├── admin.html              Admin panel (password-protected)
├── script.js               Frontend application logic (vanilla JS, ~1200 lines)
├── styles.css              Dark D4 theme (CSS variables, animations)
├── worker.js               Cloudflare Worker — REST API backend
├── wrangler.toml           Cloudflare deployment config
├── database-schema.sql     D1 database schema
├── package.json            Dev dependencies (wrangler)
├── .dev.vars.example       Example env vars for local dev
├── SETUP_GUIDE.md          Step-by-step setup instructions
└── QUICK_REFERENCE.md      Commands & troubleshooting cheat sheet
```

---

## 🚀 Quick Start

### Prerequisites
- [Cloudflare account](https://dash.cloudflare.com) (free tier works)
- Node.js & npm
- Discord server with a webhook URL

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Thomasrobb5/D4_Discord_Challenge.git
cd D4_Discord_Challenge

# 2. Install wrangler
npm install

# 3. Login to Cloudflare
npx wrangler login

# 4. Create a D1 database
npx wrangler d1 create diablo4-hof
# → Copy the database_id into wrangler.toml

# 5. Initialise the database schema
npx wrangler d1 execute diablo4-hof --file=database-schema.sql

# 6. Set secrets
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put DISCORD_WEBHOOK_URL

# 7. Deploy the Worker
npx wrangler deploy worker.js --name diablo4-hof

# 8. Deploy the Pages (frontend)
npx wrangler pages deploy . --project-name diablo4-hof-site
```

**Detailed walkthrough:** see [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## 🌐 API Reference

All endpoints are served from the Cloudflare Worker at `https://<worker>.workers.dev/api/`.

### Public Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/data` | Full payload — players, achievements, seasons (with `challenges_config`) |
| `GET` | `/api/seasons` | Season list |
| `GET` | `/api/leaderboard` | Ranked leaderboard |
| `POST` | `/api/achievements/claim` | Public self-claim (no auth required) |

### Admin Routes (require `X-Admin-Password` header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/achievements` | Record an achievement (supports custom types) |
| `DELETE` | `/api/achievements/:id` | Delete achievement |
| `POST` | `/api/players` | Add player |
| `PATCH` | `/api/players/:id` | Update name / class / discord_id |
| `DELETE` | `/api/players/:id` | Delete player |
| `POST` | `/api/seasons` | Create season (with `challenges_config`) |
| `PATCH` | `/api/seasons/:id` | Update season |
| `POST` | `/api/discord-webhook` | Proxy Discord notification |

---

## 🗄️ Database Schema

Three tables in Cloudflare D1 (SQLite):

```sql
-- Players
CREATE TABLE players (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    class      TEXT,
    discord_id TEXT
);

-- Achievements
CREATE TABLE achievements (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id        INTEGER,
    player_name      TEXT NOT NULL,
    achievement_type TEXT NOT NULL,
    points           INTEGER NOT NULL,
    season           TEXT NOT NULL,   -- matches season slug
    notes            TEXT,
    timestamp        TEXT NOT NULL
);

-- Seasons
CREATE TABLE seasons (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    number             INTEGER,
    name               TEXT NOT NULL,
    slug               TEXT,
    status             TEXT DEFAULT 'upcoming',
    start_date         TEXT,
    end_date           TEXT,
    next_season_start  TEXT,
    challenges_config  TEXT     -- JSON: array of { type, name, pts, active, custom? }
);
```

---

## 🏅 Standard Challenge Types

Challenges are configurable per season via the Admin → Setup Season wizard. Defaults:

### 1 Point 🪙
Legendary Item · Ancestral Legendary · Unique Item · Ancestral Unique · Ancestral Legendary (2GA) · Ancestral Unique (2GA) · Chaos Unique (1GA) · Any 1GA Item

### 2 Points 🪙🪙
Ancestral Unique (3GA) · Ancestral Legendary (3GA) · Mythic (No Cache) · Mythic (1GA) · Mythic (2GA) · Chaos Unique (2GA) · Grandpapa Bonus

### 3 Points 🪙🪙🪙
Mythic (3GA) · Ancestral Unique (4GA) · Mythic (4GA) · Chaos Unique (3GA)

**Custom challenges** (e.g. new Season 13 item types) can be added in the Setup wizard and behave identically.

---

## 🔒 Security Notes

- Admin password is a **Cloudflare Worker secret** — never stored in code or committed
- The Discord webhook URL is also a secret
- `.gitignore` excludes `.dev.vars` and `.wrangler/` state
- All admin API routes require the `X-Admin-Password` header validated server-side
- Public self-claim route is intentionally open (by design) with duplicate-claim protection

---

## 🛠️ Local Development

```bash
# Start the Worker locally (hot reload)
npx wrangler dev worker.js

# For Pages preview (serve static files)
npx wrangler pages dev . --port 3333

# Run against local D1
npx wrangler d1 execute diablo4-hof --local --command="SELECT * FROM seasons"
```

Copy `.dev.vars.example` → `.dev.vars` and fill in your secrets for local development.

---

## 📜 Season History

| Season | Name | Status |
|--------|------|--------|
| S13 | Lord of Hatred | 🟢 Upcoming (Apr 28 2026) |
| S12 | Season of Slaughter | ✅ Completed |
| S11 | Season of Divine Intervention | ✅ Completed |
| S10 | Season of the Infernal Hordes | ✅ Completed |
| S9  | Season of the Construct | ✅ Completed |
| S8  | Season of Blood | ✅ Completed |
| S7  | Season of Hatred Rising | ✅ Completed |
| S6  | Season of Hatred Rising | ✅ Completed |

---

## 📝 License

MIT License — see [LICENSE](./LICENSE)

---

## ⚔️ Credits

Built with ❤️ for a private Diablo IV clan group.

> *Conquer the darkness. Claim your glory. Season awaits.*
