-- V001: Create Base Schema for Normalized Database
-- Description: Creates new normalized tables (games, players, game_players, turns)
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- TABLE: players_new (Player Profiles with Aggregated Stats)
-- ============================================================================

CREATE TABLE IF NOT EXISTS players_new (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Denormalized aggregate stats (will be populated in V007)
  total_games_played INTEGER NOT NULL DEFAULT 0,
  total_games_won INTEGER NOT NULL DEFAULT 0,
  total_darts_thrown INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  total_180s INTEGER NOT NULL DEFAULT 0,
  total_140_plus INTEGER NOT NULL DEFAULT 0,
  max_dart_score INTEGER NOT NULL DEFAULT 0,
  max_turn_score INTEGER NOT NULL DEFAULT 0,
  total_checkout_attempts INTEGER NOT NULL DEFAULT 0,
  total_checkout_successes INTEGER NOT NULL DEFAULT 0,
  best_checkout INTEGER NOT NULL DEFAULT 0,

  -- Computed columns (will be added in V009)
  -- win_rate and avg_per_dart will be generated columns

  CONSTRAINT unique_player_name UNIQUE(name)
);

COMMENT ON TABLE players_new IS 'Player profiles with aggregated statistics';
COMMENT ON COLUMN players_new.total_games_played IS 'Total number of games played by this player';
COMMENT ON COLUMN players_new.total_games_won IS 'Total number of games won by this player';

-- ============================================================================
-- TABLE: games_new (Game Metadata Only - No JSONB)
-- ============================================================================

CREATE TABLE IF NOT EXISTS games_new (
  -- Primary key
  id UUID PRIMARY KEY,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Game configuration
  game_type INTEGER NOT NULL,
  win_condition TEXT NOT NULL CHECK (win_condition IN ('exact', 'below')),
  scoring_mode TEXT NOT NULL CHECK (scoring_mode IN ('per-dart', 'per-turn')),

  -- Game state
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_turn INTEGER NOT NULL DEFAULT 0,

  -- Device tracking
  device_id TEXT,

  -- Metadata
  total_players INTEGER NOT NULL DEFAULT 0,
  winner_id UUID,  -- Foreign key will be added in V009

  CONSTRAINT valid_game_type CHECK (game_type > 0)
);

COMMENT ON TABLE games_new IS 'Game metadata without JSONB players array';
COMMENT ON COLUMN games_new.game_type IS 'Target score for the game (101, 301, 501, etc.)';
COMMENT ON COLUMN games_new.win_condition IS 'Win condition: exact (must hit exactly 0) or below (can go below 0)';

-- ============================================================================
-- TABLE: game_players (Junction Table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_players (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys (constraints will be added in V009)
  game_id UUID NOT NULL,
  player_id UUID NOT NULL,

  -- Game-specific data
  player_order INTEGER NOT NULL,
  starting_score INTEGER NOT NULL,
  final_score INTEGER NOT NULL DEFAULT 0,

  -- Results
  is_winner BOOLEAN NOT NULL DEFAULT false,
  finish_rank INTEGER,
  finish_round INTEGER,

  -- Per-game statistics
  total_turns INTEGER NOT NULL DEFAULT 0,
  total_darts INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  max_dart INTEGER NOT NULL DEFAULT 0,
  max_turn INTEGER NOT NULL DEFAULT 0,
  count_180s INTEGER NOT NULL DEFAULT 0,
  count_140_plus INTEGER NOT NULL DEFAULT 0,
  checkout_attempts INTEGER NOT NULL DEFAULT 0,
  checkout_successes INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraints
  CONSTRAINT unique_game_player UNIQUE(game_id, player_id),
  CONSTRAINT unique_game_player_order UNIQUE(game_id, player_order)
);

COMMENT ON TABLE game_players IS 'Junction table linking games to players with per-game stats';
COMMENT ON COLUMN game_players.player_order IS 'Order in which player takes turns (0-based)';
COMMENT ON COLUMN game_players.finish_rank IS 'Final ranking in the game (1st, 2nd, 3rd, etc.)';
COMMENT ON COLUMN game_players.finish_round IS 'Round number when player finished (for tie detection)';

-- ============================================================================
-- TABLE: turns (Individual Turn Records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS turns (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key (constraint will be added in V009)
  game_player_id UUID NOT NULL,

  -- Turn data
  turn_number INTEGER NOT NULL CHECK (turn_number >= 1),
  round_number INTEGER NOT NULL CHECK (round_number >= 0),

  -- Scores
  score_before INTEGER NOT NULL CHECK (score_before >= 0),
  score_after INTEGER NOT NULL CHECK (score_after >= -200),  -- Allow negative for 'below' win condition
  turn_total INTEGER NOT NULL CHECK (turn_total >= 0 AND turn_total <= 180),

  -- Dart scores as array (PostgreSQL array type)
  dart_scores INTEGER[] NOT NULL,

  -- Turn outcome
  is_busted BOOLEAN NOT NULL DEFAULT false,
  is_checkout_attempt BOOLEAN NOT NULL DEFAULT false,
  is_successful_checkout BOOLEAN NOT NULL DEFAULT false,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE turns IS 'Individual turn records with dart scores';
COMMENT ON COLUMN turns.turn_number IS 'Turn number for this player (1-based)';
COMMENT ON COLUMN turns.round_number IS 'Round number in the game (0-based, increments after all players have thrown)';
COMMENT ON COLUMN turns.dart_scores IS 'Array of individual dart scores (1-3 darts)';
COMMENT ON COLUMN turns.is_busted IS 'True if turn resulted in a bust (went below 0 in exact mode)';

-- ============================================================================
-- MIGRATION TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT,
  success BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE schema_migrations IS 'Tracks applied database migrations';

-- Record this migration
INSERT INTO schema_migrations (version, description)
VALUES ('V001', 'Create base normalized schema')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V001: Base schema created successfully';
  RAISE NOTICE 'Created tables: players_new, games_new, game_players, turns';
  RAISE NOTICE 'Next step: Run V002 to create helper functions';
END $$;
