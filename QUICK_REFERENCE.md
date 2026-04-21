# Quick Reference Guide

## 🎮 File Structure

```
diablo4-hof/
├── index.html              # Main Hall of Fame page
├── admin.html              # Admin panel for managing data
├── script.js               # Frontend logic & UI
├── styles.css              # Dark D4-themed styling
├── worker.js               # Cloudflare Worker backend
├── package.json            # Dependencies
├── wrangler.toml           # Cloudflare configuration
├── database-schema.sql     # D1 database schema
├── SETUP_GUIDE.md          # Complete setup instructions
└── QUICK_REFERENCE.md      # This file
```

## 🚀 Common Commands

### Local Development
```bash
# Install dependencies
npm install

# Start local development server
npm run dev
# Access at http://localhost:8787

# Deploy worker
npm run deploy

# Initialize/reset database
npm run db:init
```

### Cloudflare D1 Console Commands

**Access**: Cloudflare Dashboard → D1 → diablo4-hof → Console

#### View All Data
```sql
-- All players
SELECT * FROM players;

-- All achievements
SELECT * FROM achievements;

-- All seasons
SELECT * FROM seasons;
```

#### Add New Player
```sql
INSERT INTO players (id, name, discord_id) 
VALUES (6, 'NewPlayerName', '@discord_username');
```

#### Record Achievement
```sql
INSERT INTO achievements (player_id, player_name, achievement_type, points, season, timestamp)
VALUES (2, 'Jubbs', 'mythic-3ga', 3, 'season-10', datetime('now'));
```

#### Update Leaderboard (Top 5)
```sql
SELECT 
    p.name,
    COUNT(a.id) as achievements,
    SUM(a.points) as total_points
FROM players p
LEFT JOIN achievements a ON p.id = a.player_id
GROUP BY p.id
ORDER BY total_points DESC
LIMIT 5;
```

#### Get Season Statistics
```sql
SELECT 
    s.name,
    COUNT(DISTINCT a.player_id) as num_players,
    COUNT(a.id) as num_achievements,
    SUM(a.points) as total_points
FROM seasons s
LEFT JOIN achievements a ON s.slug = a.season
GROUP BY s.id
ORDER BY s.name;
```

#### Get Player's Achievements
```sql
SELECT 
    achievement_type,
    points,
    season,
    timestamp
FROM achievements
WHERE player_id = 2  -- Replace 2 with player ID
ORDER BY timestamp DESC;
```

#### Delete Achievement
```sql
DELETE FROM achievements WHERE id = 5;
```

#### Reset All Data (WARNING!)
```sql
DELETE FROM achievements;
DELETE FROM players;
DELETE FROM seasons;
```

## 🎨 Customize Theme Colors

In `styles.css`, modify these variables:

```css
:root {
    --primary-dark: #0a0e27;       /* Main background */
    --accent-purple: #8b5cf6;      /* Primary accent */
    --accent-gold: #fbbf24;        /* Gold highlights */
    --accent-cyan: #06b6d4;        /* Cyan highlights */
    --accent-red: #dc2626;         /* Red accents */
}
```

### Preset Color Schemes

**Dark Red (Hellfire)**
```css
--accent-purple: #b91c1c;
--accent-gold: #f59e0b;
--accent-red: #dc2626;
```

**Neon Cyan (Corruption)**
```css
--accent-purple: #0891b2;
--accent-cyan: #00d9ff;
--accent-red: #ff006e;
```

## 📊 Achievement Point Values

All types and their point values are defined in `script.js` under `achievementTemplates`:

| Type | Points | Rarity | ID |
|------|--------|--------|-----|
| Legendary Item | 1 | Legendary | `legendary-item` |
| Ancestral Legendary | 1 | Ancestral | `ancestral-legendary` |
| Unique Item | 1 | Unique | `unique-item` |
| Ancestral Unique | 1 | Ancestral | `ancestral-unique` |
| Ancestral Legendary 2GA | 1 | Ancestral | `ancestral-legendary-2ga` |
| Ancestral Unique 2GA | 1 | Ancestral | `ancestral-unique-2ga` |
| Chaos Unique 1GA | 1 | Chaos | `chaos-unique-1ga` |
| Ancestral Unique 3GA | 2 | Ancestral | `ancestral-unique-3ga` |
| Ancestral Legendary 3GA | 2 | Ancestral | `ancestral-legendary-3ga` |
| Mythic 1GA | 2 | Mythic | `mythic-1ga` |
| Mythic 2GA | 2 | Mythic | `mythic-2ga` |
| Chaos Unique 2GA | 2 | Chaos | `chaos-unique-2ga` |
| Mythic 3GA | 3 | Mythic | `mythic-3ga` |
| Ancestral Unique 4GA | 3 | Ancestral | `ancestral-unique-4ga` |
| Mythic 4GA | 3 | Mythic | `mythic-4ga` |
| Chaos Unique 3GA | 3 | Chaos | `chaos-unique-3ga` |

## 🔧 Add New Achievement Type

### Step 1: Update `achievementTemplates` in `script.js`
```javascript
'mythic-5ga': {
    name: 'Mythic Item (5GA)',
    description: 'Mythic item with 5 greater affixes',
    rarity: 'mythic',
    points: 4,
    icon: '✨'
}
```

### Step 2: Update `getAchievementPoints()` in `worker.js`
```javascript
'mythic-5ga': 4,
```

### Step 3: Update `admin.html` dropdown
```html
<option value="mythic-5ga">Mythic Item (5GA)</option>
```

### Step 4: Add CSS styling (optional)
If new rarity type, add to `styles.css`:
```css
.achievement-rarity.epic { 
    background: #7c3aed; 
    color: white; 
}
```

## 🎯 Discord Webhook Integration

### Getting Your Webhook URL

1. Go to your Discord server
2. Server Settings → Webhooks
3. Create Webhook
4. Copy URL (keep SECRET!)
5. Add to `wrangler.toml`:
```toml
[env.production.vars]
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"
```

### Webhook Message Format

The worker sends this format:
```json
{
    "username": "Hall of Fame Bot",
    "embeds": [{
        "title": "⚡ Achievement Unlocked ⚡",
        "description": "PlayerName just achieved AchievementName!",
        "color": 9142518,
        "fields": [
            {"name": "Points Earned", "value": "🪙 3", "inline": true},
            {"name": "Season", "value": "season-10", "inline": true}
        ]
    }]
}
```

To customize the Discord embed, edit `handleDiscordWebhook()` in `worker.js`.

## 🔒 Security Checklist

- [ ] Discord webhook URL is in `wrangler.toml` (not committed to git)
- [ ] Cloudflare API tokens never in code
- [ ] Add `.gitignore` with:
  ```
  node_modules/
  .wrangler/
  wrangler.toml (if using local secrets)
  ```
- [ ] Enable Cloudflare CORS restrictions if needed
- [ ] Monitor D1 usage (free tier has limits)

## 🐛 Debugging Tips

### Enable Debug Mode
Add to `script.js`:
```javascript
const DEBUG = true;
```

Then log all API calls:
```javascript
if (DEBUG) console.log('API Response:', data);
```

### Check Worker Logs
```bash
wrangler tail
```

### Test API Endpoint
```bash
curl https://your-worker.workers.dev/api/data
```

### Check D1 Query
In Cloudflare console, run query and check for errors

### Browser Console
Open DevTools (F12) → Console tab to see JavaScript errors

## 📈 Performance Tips

1. **Limit displayed results** - Pagination for large datasets
2. **Use indexes** - Already in schema.sql
3. **Cache API responses** - Add cache headers in worker.js
4. **Lazy load achievements** - Use intersection observer
5. **Optimize images** - Use WebP if adding images

## 🌐 Deploy to Custom Domain

### Option 1: Cloudflare Pages (Recommended)
1. Connect GitHub repo to Pages
2. Set custom domain in Pages settings
3. Update `wrangler.toml` with zone_id

### Option 2: GitHub Pages
1. Push to GitHub
2. Enable Pages in repo settings
3. Deploy from main branch

### Option 3: Vercel
1. Connect GitHub repo
2. Set build command: (blank)
3. Output directory: ./

## 💾 Backup Your Data

Export all achievements:
```bash
# Via D1 CLI
wrangler d1 execute diablo4-hof --file=backup.sql --remote

# Or manually export from console
```

## 📞 Troubleshooting Checklist

| Issue | Solution |
|-------|----------|
| Pages shows old version | Clear browser cache (Ctrl+Shift+Del) |
| API returns 404 | Check worker deployment: `wrangler deploy` |
| Discord webhook fails | Verify URL in wrangler.toml, check Discord perms |
| Database errors | Run `npm run db:init` to reset schema |
| Search not working | Check filter selectors in HTML match data |
| Leaderboard empty | Verify players/achievements in D1 console |
| Styles not loading | Check CSS file path is relative `./styles.css` |

## 🎓 Learning Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Discord Webhooks API](https://discord.com/developers/docs/resources/webhook)
- [MDN - Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [SQL Tutorial](https://www.w3schools.com/sql/)

## 🚀 Next Steps

1. ✅ Set up Cloudflare account & resources
2. ✅ Deploy frontend to Pages
3. ✅ Deploy worker
4. ✅ Initialize D1 database
5. 📝 Add initial players
6. 🎯 Record first achievements
7. 🔔 Configure Discord webhook
8. 📊 Monitor leaderboard
9. 🎉 Celebrate with your squad!

---

**Have fun tracking those epic drops!** ⚔️🎮
