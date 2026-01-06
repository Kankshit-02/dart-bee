-- V008: Create Performance Indexes
-- Description: Creates indexes for common query patterns on all tables
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START INDEX CREATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V008: Creating performance indexes...';
  RAISE NOTICE 'This may take a few minutes on large datasets...';
END $$;

-- ============================================================================
-- GAMES TABLE INDEXES
-- ============================================================================

-- Primary timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_games_created_at
  ON games_new(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_completed_at
  ON games_new(completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_updated_at
  ON games_new(updated_at DESC);

-- Status-based queries
CREATE INDEX IF NOT EXISTS idx_games_active
  ON games_new(is_active)
  WHERE is_active = true;

-- Winner lookups
CREATE INDEX IF NOT EXISTS idx_games_winner
  ON games_new(winner_id)
  WHERE winner_id IS NOT NULL;

-- Device-specific queries
CREATE INDEX IF NOT EXISTS idx_games_device
  ON games_new(device_id)
  WHERE device_id IS NOT NULL;

-- Game type filtering
CREATE INDEX IF NOT EXISTS idx_games_type
  ON games_new(game_type);

-- Composite index for completed games by date
CREATE INDEX IF NOT EXISTS idx_games_completed_created
  ON games_new(completed_at DESC, created_at DESC)
  WHERE completed_at IS NOT NULL;

RAISE NOTICE '  ✓ Games table indexes created (8 indexes)';

-- ============================================================================
-- PLAYERS TABLE INDEXES
-- ============================================================================

-- Name lookups (most common)
CREATE INDEX IF NOT EXISTS idx_players_name
  ON players_new(name);

-- Leaderboard rankings
CREATE INDEX IF NOT EXISTS idx_players_total_wins
  ON players_new(total_games_won DESC)
  WHERE total_games_played > 0;

CREATE INDEX IF NOT EXISTS idx_players_total_games
  ON players_new(total_games_played DESC)
  WHERE total_games_played > 0;

-- Stats-based sorting
CREATE INDEX IF NOT EXISTS idx_players_total_score
  ON players_new(total_score DESC)
  WHERE total_games_played > 0;

CREATE INDEX IF NOT EXISTS idx_players_total_180s
  ON players_new(total_180s DESC)
  WHERE total_180s > 0;

CREATE INDEX IF NOT EXISTS idx_players_max_dart
  ON players_new(max_dart_score DESC);

CREATE INDEX IF NOT EXISTS idx_players_max_turn
  ON players_new(max_turn_score DESC);

-- Timestamps
CREATE INDEX IF NOT EXISTS idx_players_created_at
  ON players_new(created_at DESC);

RAISE NOTICE '  ✓ Players table indexes created (8 indexes)';

-- ============================================================================
-- GAME_PLAYERS TABLE INDEXES
-- ============================================================================

-- Foreign key lookups
CREATE INDEX IF NOT EXISTS idx_game_players_game
  ON game_players(game_id);

CREATE INDEX IF NOT EXISTS idx_game_players_player
  ON game_players(player_id);

-- Player game history (most common query)
CREATE INDEX IF NOT EXISTS idx_game_players_player_created
  ON game_players(player_id, created_at DESC);

-- Winner lookups
CREATE INDEX IF NOT EXISTS idx_game_players_winners
  ON game_players(player_id, is_winner)
  WHERE is_winner = true;

-- Game completion rankings
CREATE INDEX IF NOT EXISTS idx_game_players_finish_rank
  ON game_players(game_id, finish_rank)
  WHERE finish_rank IS NOT NULL;

-- Stats-based queries
CREATE INDEX IF NOT EXISTS idx_game_players_total_darts
  ON game_players(total_darts DESC);

-- Player order within game
CREATE INDEX IF NOT EXISTS idx_game_players_order
  ON game_players(game_id, player_order);

RAISE NOTICE '  ✓ Game_players table indexes created (7 indexes)';

-- ============================================================================
-- TURNS TABLE INDEXES
-- ============================================================================

-- Foreign key lookup (most common)
CREATE INDEX IF NOT EXISTS idx_turns_game_player
  ON turns(game_player_id);

-- Turn sequence
CREATE INDEX IF NOT EXISTS idx_turns_game_player_turn
  ON turns(game_player_id, turn_number);

-- 180 score queries
CREATE INDEX IF NOT EXISTS idx_turns_180s
  ON turns(turn_total)
  WHERE turn_total = 180;

-- 140+ scores
CREATE INDEX IF NOT EXISTS idx_turns_140_plus
  ON turns(turn_total)
  WHERE turn_total >= 140;

-- Checkout queries
CREATE INDEX IF NOT EXISTS idx_turns_checkouts
  ON turns(game_player_id, is_successful_checkout)
  WHERE is_successful_checkout = true;

-- Bust queries
CREATE INDEX IF NOT EXISTS idx_turns_busts
  ON turns(game_player_id, is_busted)
  WHERE is_busted = true;

-- Timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_turns_created_at
  ON turns(created_at DESC);

-- GIN index for dart_scores array (advanced queries)
CREATE INDEX IF NOT EXISTS idx_turns_dart_scores
  ON turns USING GIN (dart_scores);

RAISE NOTICE '  ✓ Turns table indexes created (8 indexes)';

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Game history with player filter
CREATE INDEX IF NOT EXISTS idx_game_players_game_player_order
  ON game_players(game_id, player_id, player_order);

-- Leaderboard by date range
CREATE INDEX IF NOT EXISTS idx_game_players_player_created_winner
  ON game_players(player_id, created_at DESC, is_winner);

RAISE NOTICE '  ✓ Composite indexes created (2 indexes)';

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE games_new;
ANALYZE players_new;
ANALYZE game_players;
ANALYZE turns;

RAISE NOTICE '  ✓ Tables analyzed for query optimizer';

-- ============================================================================
-- VERIFY INDEX CREATION
-- ============================================================================

DO $$
DECLARE
  total_indexes INTEGER;
  games_indexes INTEGER;
  players_indexes INTEGER;
  game_players_indexes INTEGER;
  turns_indexes INTEGER;
BEGIN
  -- Count indexes on each table
  SELECT COUNT(*) INTO games_indexes
  FROM pg_indexes
  WHERE tablename = 'games_new';

  SELECT COUNT(*) INTO players_indexes
  FROM pg_indexes
  WHERE tablename = 'players_new';

  SELECT COUNT(*) INTO game_players_indexes
  FROM pg_indexes
  WHERE tablename = 'game_players';

  SELECT COUNT(*) INTO turns_indexes
  FROM pg_indexes
  WHERE tablename = 'turns';

  total_indexes := games_indexes + players_indexes + game_players_indexes + turns_indexes;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Index Summary:';
  RAISE NOTICE '  games_new: % indexes', games_indexes;
  RAISE NOTICE '  players_new: % indexes', players_indexes;
  RAISE NOTICE '  game_players: % indexes', game_players_indexes;
  RAISE NOTICE '  turns: % indexes', turns_indexes;
  RAISE NOTICE '  Total: % indexes', total_indexes;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V008', 'Create performance indexes on all tables')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V008: Performance indexes created successfully';
  RAISE NOTICE 'Next step: Run V009 to add foreign key constraints';
END $$;
