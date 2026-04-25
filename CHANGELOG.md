# Changelog — Diablo IV Hall of Legends

All notable changes to the Diablo IV Hall of Legends platform, documented by version and milestone.

---

## [2.1.0] — 2026-04-25
### 🚀 Major: Discord Identity & Badges
- **Discord OAuth2 Authentication**: Implemented a full login handshake with Discord. Users can now sign in to personalize their experience.
- **JWT Session Management**: Added secure, stateless session tracking using the Web Crypto API for performance and security.
- **The "Character Sheet" (Profile Modal)**: Created a cinematic personal dashboard where users can see their total points, global rank, and earned badges.
- **Legacy Badge System**: Added a persistent badge system to track player history across seasons.
- **Auto-Badging**: Implemented automatic awarding of "The Founder" badge for all users logging in during the expansion launch phase.

### 🎨 UI & Aesthetics
- **Live Achievement Ticker**: Added a "News Broadcast" style scrolling ticker at the top of the site for real-time claim notifications.
- **Bingo Board v2.0**: Overhauled the Bingo Board with ritualistic borders, cinematic "CLAIMED" seals, and rarity-based glowing effects.
- **Leaderboard Flair**: Added badge icons next to achievement counts on the leaderboard to display player prestige.
- **Expansion Classes**: Officially added **Paladin** and **Warlock** to all player creation and editing menus for Season 13.

### ⚙️ Backend & Infrastructure
- **D1 Schema Evolution**: Added `discord_id` and `avatar` support to the `players` table and initialized the `badges` table.
- **API Optimization**: Updated the `/api/data` endpoint to return contextual user data and badge mappings.
- **Discord Setup Utility**: Created a comprehensive `discord_auth_setup_guide.md` for easy environment configuration.

---

## [2.0.0] — 2026-04-20
### ✨ Core Platform Overhaul
- **Modern SPA Architecture**: Refined the application structure for smoother tab transitions and state management.
- **Admin Record Mode**: Implemented the "⚡ Record" button for admins to quickly log achievements directly from the live site.
- **Discord Webhook Integration**: Automated Discord notifications for new claims and seasonal announcements.
- **Season Setup Wizard**: Added a comprehensive admin interface for configuring seasonal challenges and countdowns.

---

## [1.0.0] — Initial Release
- **Bingo Engine**: The original random grid generation and claim tracking system.
- **Hall of Legends**: Global leaderboard for cross-season performance.
- **Cloudflare Stack**: Fully serverless architecture using Workers, D1, and Pages.
