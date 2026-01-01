-- ============================================
-- Dart Bee - Supabase Database Schema
-- ============================================
--
-- SETUP INSTRUCTIONS:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Copy and paste this entire file
-- 5. Click "Run"
--
-- This will create:
-- - games table (for storing game data)
-- - players table (for storing player aggregate stats)
-- - Realtime subscriptions for live updates
-- - Row-level security policies for data access
--

-- ============================================
-- 1. GAMES TABLE
-- ============================================

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  game_type INTEGER NOT NULL,
  win_condition TEXT NOT NULL CHECK (win_condition IN ('exact', 'below')),
  scoring_mode TEXT NOT NULL CHECK (scoring_mode IN ('per-dart', 'per-turn')),
  current_player_index INTEGER DEFAULT 0,
  current_turn INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  players JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_games_active ON games(is_active) WHERE is_active = true;
CREATE INDEX idx_games_created ON games(created_at DESC);
CREATE INDEX idx_games_updated ON games(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read games (for spectators)
CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT
  USING (true);

-- RLS Policy: Anyone can create games (anonymous mode)
CREATE POLICY "Anyone can create games"
  ON games FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Anyone can update games
CREATE POLICY "Anyone can update games"
  ON games FOR UPDATE
  USING (true);

-- RLS Policy: Anyone can delete games
CREATE POLICY "Anyone can delete games"
  ON games FOR DELETE
  USING (true);

-- ============================================
-- 2. PLAYERS TABLE (Aggregate Statistics)
-- ============================================

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  aggregate_stats JSONB NOT NULL DEFAULT '{
    "gamesPlayed": 0,
    "gamesWon": 0,
    "totalDarts": 0,
    "total180s": 0,
    "total140plus": 0,
    "totalCheckoutAttempts": 0,
    "totalCheckoutSuccess": 0,
    "bestCheckout": 0,
    "maxDart": 0,
    "totalScore": 0
  }'::jsonb
);

-- Create index on player name for lookups
CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_players_created ON players(created_at DESC);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read player stats
CREATE POLICY "Players are viewable by everyone"
  ON players FOR SELECT
  USING (true);

-- RLS Policy: Anyone can create players
CREATE POLICY "Anyone can create players"
  ON players FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Anyone can update player stats
CREATE POLICY "Anyone can update players"
  ON players FOR UPDATE
  USING (true);

-- ============================================
-- 3. REALTIME PUBLICATIONS
-- ============================================
-- Enable realtime for games table (for live updates)
BEGIN;
  -- Check if the publication exists
  DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
  CREATE PUBLICATION supabase_realtime FOR TABLE games;
COMMIT;

-- ============================================
-- 4. HELPER FUNCTION (Optional)
-- ============================================
-- Function to clean up old completed games (optional maintenance)
-- Uncomment if you want to automatically delete games older than 90 days
--
-- CREATE OR REPLACE FUNCTION cleanup_old_games()
-- RETURNS void AS $$
-- BEGIN
--   DELETE FROM games
--   WHERE completed_at IS NOT NULL
--     AND completed_at < NOW() - INTERVAL '90 days';
-- END;
-- $$ LANGUAGE plpgsql;
--
-- -- Schedule the cleanup to run daily (requires pg_cron extension)
-- -- SELECT cron.schedule('cleanup_old_games', '0 2 * * *', 'SELECT cleanup_old_games()');

-- ============================================
-- SETUP COMPLETE
-- ============================================
--
-- Next steps:
-- 1. Update scripts/config.js with your Supabase credentials
-- 2. Reload your app in the browser
-- 3. Try creating a new game
-- 4. Share the game link with friends!
--
-- Tables created:
-- ✓ games (stores all game data)
-- ✓ players (stores player aggregate statistics)
--
-- Realtime enabled for:
-- ✓ games table (live updates when games change)
--
-- Security policies enabled:
-- ✓ Anyone can view games and player stats
-- ✓ Anyone can create/update/delete games and players
-- ✓ (Optional: Can restrict to authenticated users later)

  ALTER TABLE games ADD COLUMN device_id TEXT DEFAULT NULL;
