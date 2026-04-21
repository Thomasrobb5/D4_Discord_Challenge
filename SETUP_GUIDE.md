# Diablo IV Season 10 - Hall of Fame

A Diablo 4 gamified achievement tracker with a dark, demon-themed SPA. Track seasonal "firsts" with Discord webhook integration!

## 🎮 Features

- **Dark D4-Themed UI**: Gothic, atmospheric design with purple accents
- **Real-time Leaderboard**: Rankings by conquest points
- **Achievement Gallery**: Filter by rarity, points, and type
- **Seasonal Tracking**: Compare performance across seasons
- **Discord Webhooks**: Auto-post achievements to your Discord server
- **Live Database**: Cloudflare D1 for instant updates
- **Fully Responsive**: Mobile-friendly design

## 🏗️ Architecture

```
Frontend (Cloudflare Pages)
    ├── index.html (SPA structure)
    ├── styles.css (Dark D4 theme)
    └── script.js (UI logic & API calls)

Backend (Cloudflare Worker)
    ├── worker.js (API endpoints)
    └── Discord webhooks

Database (Cloudflare D1)
    ├── Players table
    ├── Achievements table
    └── Seasons table
```

## 📋 Prerequisites

- Cloudflare Account (Free tier works!)
- Node.js & npm
- Discord Server (for webhooks)
- Git (optional, for version control)

## 🚀 Quick Setup

### Step 1: Create Cloudflare Account Resources

1. **Create a D1 Database**
   - Go to Cloudflare Dashboard → Workers & Pages → D1
   - Click "Create database" → name it `diablo4-hof`
   - Note the database ID

2. **Create Discord Webhook**
   - Go to your Discord server → Settings → Webhooks
   - Click "Create Webhook"
   - Copy the webhook URL
   - This URL is sensitive - keep it secret!

### Step 2: Clone/Setup Project Files

```bash
# Clone this project or create a new folder
git clone <your-repo-url>
cd diablo4-hof

# Install dependencies
npm install
```

### Step 3: Configure Environment

1. **Update `wrangler.toml`**:
   ```toml
   account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"  # Get from Dash
   
   [env.production]
   zone_id = "YOUR_ZONE_ID"  # If using custom domain
   
   [[d1_databases]]
   database_id = "YOUR_DATABASE_ID"  # From Step 1
   
   [env.production.vars]
   DISCORD_WEBHOOK_URL = "YOUR_DISCORD_WEBHOOK_URL"  # From Step 2
   ```

2. **Get Your Account ID**:
   - Cloudflare Dashboard → Right sidebar → "Copy" next to your account name

### Step 4: Initialize Database

```bash
# Run the database schema
npm run db:init
```

Or manually:
1. Cloudflare Dashboard → D1 → diablo4-hof → "Console"
2. Copy contents of `database-schema.sql` and run in the console

### Step 5: Deploy

```bash
# Test locally (optional)
npm run dev

# Deploy to production
npm run deploy
```

### Step 6: Set Up Cloudflare Pages

1. Push your code to GitHub (if not already done)
2. Cloudflare Dashboard → Pages → "Create a project" → "Connect to Git"
3. Select your repository
4. Build command: (leave blank - this is static HTML/CSS/JS)
5. Build output directory: `./` (or root)
6. Deploy!

#### Alternative: Direct Upload
```bash
npm install -g @cloudflare/wrangler
wrangler pages deploy .
```

### Step 7: Connect Frontend to Backend

In your deployed Pages URL, update `script.js` line 7:
```javascript
const API_URL = 'https://your-worker.your-subdomain.workers.dev/api';
```

Or set it dynamically to match the current domain.

## 📊 How to Use

### Adding Players

Edit `database-schema.sql` or use D1 Console:
```sql
INSERT INTO players (id, name, discord_id) VALUES (6, 'NewPlayer', '@discord_id');
```

### Recording Achievements

Option 1: **Manual via D1 Console**
```sql
INSERT INTO achievements (player_id, player_name, achievement_type, points, season, timestamp) 
VALUES (2, 'Jubbs', 'mythic-3ga', 3, 'season-10', datetime('now'));
```

Option 2: **Via API (when webhook is built)**
```javascript
await submitAchievement(playerId, 'mythic-3ga');
```

### Achievement Types & Points

**1 Point 🪙**
- legendary-item
- ancestral-legendary
- unique-item
- ancestral-unique
- ancestral-legendary-2ga
- ancestral-unique-2ga
- chaos-unique-1ga

**2 Points 🪙🪙**
- ancestral-unique-3ga
- ancestral-legendary-3ga
- mythic-1ga
- mythic-2ga
- chaos-unique-2ga

**3 Points 🪙🪙🪙**
- mythic-3ga
- ancestral-unique-4ga
- mythic-4ga
- chaos-unique-3ga

## 🎨 Customization

### Change Colors
Edit `styles.css` `:root` variables:
```css
--accent-purple: #8b5cf6;
--accent-gold: #fbbf24;
--accent-red: #dc2626;
```

### Add More Rarities
Update `achievementTemplates` in `script.js` and add new rarity styles in `styles.css`.

### Modify Achievement Types
1. Update `achievementTemplates` in `script.js`
2. Update `getAchievementPoints()` in `worker.js`
3. Update database records

## 🔗 Discord Webhook Customization

Edit the embed in `worker.js` `handleDiscordWebhook()` function:

```javascript
const embed = {
    title: '⚡ Achievement Unlocked ⚡',
    color: 0x8b5cf6, // Hex color (no #)
    // ... customize fields, add images, etc
};
```

[Discord Embed Documentation](https://discord.com/developers/docs/resources/channel#embed-object)

## 🛡️ Security

- **Never commit secrets!** Use Cloudflare environment variables
- Discord webhook URLs are sensitive - keep them in `wrangler.toml` (not in code)
- D1 database access is restricted to your Worker
- CORS enabled for all origins (customize in `worker.js` if needed)

## 📈 Future Enhancements

- [ ] Admin panel for managing achievements
- [ ] Real-time leaderboard updates via WebSocket
- [ ] Achievement images/icons
- [ ] Mobile app (React Native)
- [ ] Season-end rewards & badges
- [ ] Achievement statistics & trends
- [ ] Multi-server support
- [ ] Automated achievement detection

## 🐛 Troubleshooting

### "API returns 404"
- Check `wrangler.toml` D1 database ID
- Verify Worker is deployed: `wrangler deploy`
- Check browser console for full error

### "Discord webhook fails"
- Verify webhook URL in `wrangler.toml`
- Check Discord server permissions
- Webhook URL should NOT have trailing `/`

### "Database query error"
- Ensure `database-schema.sql` was executed
- Check table names match (lowercase with underscores)
- Verify player_id exists in achievements inserts

### "Pages won't load"
- Clear browser cache (Ctrl+Shift+Del)
- Verify all 3 files deployed: index.html, styles.css, script.js
- Check file paths are relative

## 📞 Support

- Cloudflare Docs: https://developers.cloudflare.com/
- D1 Guide: https://developers.cloudflare.com/d1/
- Discord Webhooks: https://discord.com/developers/docs/resources/webhook
- Workers Guide: https://developers.cloudflare.com/workers/

## 📝 License

MIT - Feel free to customize!

## 🎮 Let's Hunt Some Demons!

Go forth and conquer! The Hall of Fame awaits your legendary achievements.

⚡ **Diablo IV - Season 10 Hall of Fame** ⚡
