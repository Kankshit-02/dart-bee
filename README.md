# Dart Bee - Game Score Manager

A modern, responsive web app for tracking dart games with detailed statistics and leaderboards. Built with vanilla HTML, CSS, and JavaScript for fast, offline-capable gameplay.

## Features

### Game Management
- **Create New Games**: Set number of players, custom names, starting points (101-1001), and win conditions
- **Active Game Scoring**: Enter darts per turn with quick number pad for common scores
- **Two Scoring Modes**:
  - Per-dart entry (3 inputs) - recommended for detailed statistics
  - Per-turn total - faster gameplay
- **Game History**: Browse, search, and view detailed game records
- **Resume Games**: Automatically resume interrupted games

### Statistics & Analytics
- **Player Profiles**: Comprehensive individual statistics
  - Games played/won, win rate
  - Average per dart, per turn
  - Highest scores (180s, 140+s)
  - Checkout percentage
  - Max dart and max turn scores
- **Head-to-Head Records**: Track records against specific opponents
- **Leaderboards**: Multiple ranking options
  - Most wins
  - Best win rate
  - Highest average per dart
  - Most 180s
- **Time Filters**: All-time, last 30 days, last 7 days

### User Experience
- **Nudge Bee Design**: Modern purple theme matching Nudge Bee aesthetic
- **Responsive Design**: Mobile-first approach, optimized for phones and tablets
- **Offline Support**: Progressive Web App (PWA) with offline capability
- **Data Persistence**: All data stored in browser LocalStorage
- **Auto-save**: Automatic save after each turn
- **Toast Notifications**: Real-time feedback on actions

## Getting Started

### Installation

1. **Clone or fork this repository**
   ```bash
   git clone https://github.com/yourusername/dart-bee.git
   cd dart-bee
   ```

2. **Enable GitHub Pages** (if hosting on GitHub)
   - Go to repository Settings → Pages
   - Select "main" branch as source
   - Your app will be available at `https://yourusername.github.io/dart-bee`

3. **Local Development**
   - Simply open `index.html` in a web browser
   - Or use a local server: `python -m http.server 8000`

### First Use

1. Click "Start New Game" on the home page
2. Select number of players and optionally enter their names
3. Choose starting points (default: 501)
4. Choose win condition (exact zero or zero/below)
5. Select scoring mode (per-dart recommended)
6. Click "Start Playing"
7. Enter dart scores and submit turns
8. Game ends when a player reaches zero

## Usage Guide

### Creating a Game
- **Number of Players**: 1-8 players
- **Player Names**: Optional (auto-generates if blank)
- **Starting Points**: 101, 201, 301, 501, 701, 1001, or custom
- **Win Condition**:
  - Exact zero (standard darts rules)
  - Zero or below (game ends at or below zero)
- **Scoring Mode**: Per-dart (recommended) or per-turn total

### During Gameplay
- **Dart Entry**: Click numbers or use number pad
- **Quick Buttons**: Common dart scores for fast entry (20, 25, 30, 40, 50, 60, 80, 100, 120, 140, 160, 180)
- **Undo**: Remove last turn if needed
- **Turn History**: View all turns in current game
- **Bust Detection**: Automatic handling of invalid turns

### Viewing Statistics
- **Home**: Quick overview of your stats and recent games
- **Leaderboard**: Rankings by wins, win rate, average, or 180s
- **Player Profile**: Detailed stats, records, and head-to-head data
- **Game History**: Search and view detailed turn-by-turn breakdowns

### Data Management

#### Export Data
```javascript
const data = Storage.exportData();
const json = JSON.stringify(data);
// Save to file or share
```

#### Import Data
```javascript
Storage.importData(importedData);
```

#### Clear All Data
- Use Settings (when added) or console:
```javascript
Storage.clearAll();
```

## Architecture

### File Structure
```
dart-bee/
├── index.html           # Main app entry point
├── manifest.json        # PWA configuration
├── README.md           # This file
├── styles/
│   ├── main.css        # Design system and global styles
│   └── components.css   # Component-specific styles
└── scripts/
    ├── storage.js      # LocalStorage management
    ├── game.js         # Game logic and scoring
    ├── stats.js        # Statistics calculations
    ├── ui.js           # DOM rendering
    └── app.js          # Routing and event handlers
```

### Key Modules

#### Storage (`storage.js`)
- LocalStorage wrapper for games and players
- Data validation and integrity checks
- Export/import functionality
- Player profile management

#### Game (`game.js`)
- Game creation and initialization
- Turn submission and validation
- Bust detection
- Score calculation
- Winner determination

#### Stats (`stats.js`)
- Player statistics calculation
- Leaderboard generation
- Head-to-head records
- Time-based filtering

#### UI (`ui.js`)
- Page rendering and updates
- Form handling
- Toast notifications
- Modal dialogs

#### App (`app.js`)
- Application routing
- Event listeners
- Game state management
- Page navigation

## Data Model

### Game Object
```javascript
{
  id: "uuid",
  createdAt: timestamp,
  completedAt: timestamp,
  gameType: 501,
  winCondition: "exact" | "below",
  scoringMode: "per-dart" | "per-turn",
  currentPlayerIndex: 0,
  currentTurn: 0,
  isActive: true,
  players: [
    {
      id: "uuid",
      name: "Player 1",
      startingScore: 501,
      currentScore: 0,
      turns: [
        {
          darts: [60, 60, 60],
          remaining: 321,
          busted: false,
          timestamp: timestamp
        }
      ],
      winner: false,
      stats: {
        totalDarts: 15,
        totalScore: 180,
        avgPerDart: 12.0,
        maxTurn: 180,
        maxDart: 60,
        checkoutAttempts: 0,
        checkoutSuccess: 0
      }
    }
  ]
}
```

### Player Profile
```javascript
{
  id: "uuid",
  name: "Player Name",
  createdAt: timestamp,
  aggregateStats: {
    gamesPlayed: 50,
    gamesWon: 25,
    totalDarts: 1500,
    total180s: 5,
    total140plus: 25,
    totalCheckoutAttempts: 50,
    totalCheckoutSuccess: 23,
    bestCheckout: 170,
    maxDart: 180,
    totalScore: 15000
  }
}
```

## Design System

### Color Palette (Nudge Bee Theme)
- **Primary Dark**: #573e69
- **Primary**: #7d5f92
- **Primary Light**: #9d7fb2
- **Accent Green**: #2de36d
- **Accent Yellow**: #facf39
- **Accent Blue**: #38a2ff
- **Background**: #fbf5ff
- **Text Dark**: #271f36
- **Text Light**: #6b5b7a

### Typography
- **Font Family**: Inter (Google Fonts)
- **Sizes**: XS (12px) to 3XL (40px)
- **Weights**: Regular (400) to Extra Bold (800)

## Performance

- **No Build Step**: Run directly in browser
- **Fast Loading**: ~15KB gzipped
- **Offline First**: Works without internet connection
- **Lazy Statistics**: Calculated on demand
- **Auto-save**: Every 30 seconds
- **Responsive**: Mobile-optimized

## Browser Support

- Chrome/Chromium: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Edge: Latest 2 versions

## Technical Details

### Storage Limits
- LocalStorage: ~5-10MB per domain
- Supports approximately 1000+ games depending on data size

### Performance Considerations
- Statistics calculated on-demand
- Virtual scrolling for long lists (future enhancement)
- Debounced search inputs
- Minimal DOM manipulation

## Future Enhancements

- [ ] Settings page (notifications, themes, data management)
- [ ] Player avatars and profiles
- [ ] Social sharing (scores, achievements)
- [ ] Team/league management
- [ ] Mobile app version (React Native)
- [ ] Cloud sync (Firebase/Supabase)
- [ ] Match statistics (leg analysis)
- [ ] Replay game feature
- [ ] Achievements/badges system
- [ ] Advanced filtering and search
- [ ] Custom tournaments
- [ ] Live multiplayer scoring

## Development

### Running Locally
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Then visit http://localhost:8000
```

### Code Organization
- Modular IIFE (Immediately Invoked Function Expression) pattern
- No external dependencies
- Pure vanilla JavaScript
- CSS Grid and Flexbox layouts

### Adding Features
1. Update data model if needed (Game/Player objects)
2. Add logic to appropriate module (game.js, stats.js, etc.)
3. Add UI rendering to ui.js
4. Add event listeners to app.js
5. Test across different screen sizes

## Testing

### Manual Testing Checklist
- [ ] Create game with 1-8 players
- [ ] Submit turns and validate score calculations
- [ ] Test bust detection
- [ ] Verify undo functionality
- [ ] Check game history filtering
- [ ] Test leaderboard sorting/filtering
- [ ] View player profiles and stats
- [ ] Test on mobile devices
- [ ] Test offline functionality
- [ ] Verify data persistence

### Edge Cases
- Game with 1 player
- Custom point values
- Undo on first turn
- Resume interrupted game
- Large number of games (performance)

## Troubleshooting

### Data Not Saving
- Check browser's LocalStorage is enabled
- Try clearing cache and reloading
- Check browser's storage quota

### Game Not Resuming
- Manually navigate to home, then back to game
- Check that currentGame isn't null

### Stats Not Updating
- Stats are calculated on-demand
- Reload the leaderboard page

## License

MIT License - Feel free to use, modify, and distribute

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

- Report issues on GitHub Issues
- Check existing issues first
- Include browser/device info and steps to reproduce

## Credits

Designed with the Nudge Bee aesthetic by [Nudge Bee](https://nudgebee.com/)

---

Built with ❤️ for dart enthusiasts
