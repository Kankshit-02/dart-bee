-- V009: Add Foreign Key Constraints and Computed Columns
-- Description: Adds referential integrity constraints and generated columns for calculations
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START CONSTRAINT ADDITION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V009: Adding foreign key constraints and computed columns...';
END $$;

-- ============================================================================
-- STEP 1: Add Foreign Key Constraints
-- ============================================================================

-- games_new.winner_id → players_new.id
ALTER TABLE games_new
ADD CONSTRAINT fk_games_winner
FOREIGN KEY (winner_id)
REFERENCES players_new(id)
ON DELETE SET NULL;

RAISE NOTICE '  ✓ Added FK: games_new.winner_id → players_new.id';

-- game_players.game_id → games_new.id
ALTER TABLE game_players
ADD CONSTRAINT fk_game_players_game
FOREIGN KEY (game_id)
REFERENCES games_new(id)
ON DELETE CASCADE;

RAISE NOTICE '  ✓ Added FK: game_players.game_id → games_new.id';

-- game_players.player_id → players_new.id
ALTER TABLE game_players
ADD CONSTRAINT fk_game_players_player
FOREIGN KEY (player_id)
REFERENCES players_new(id)
ON DELETE CASCADE;

RAISE NOTICE '  ✓ Added FK: game_players.player_id → players_new.id';

-- turns.game_player_id → game_players.id
ALTER TABLE turns
ADD CONSTRAINT fk_turns_game_player
FOREIGN KEY (game_player_id)
REFERENCES game_players(id)
ON DELETE CASCADE;

RAISE NOTICE '  ✓ Added FK: turns.game_player_id → game_players.id';

-- ============================================================================
-- STEP 2: Add Generated Columns to players_new
-- ============================================================================

-- Add win_rate as a generated column
ALTER TABLE players_new
ADD COLUMN IF NOT EXISTS win_rate NUMERIC(5,2)
GENERATED ALWAYS AS (
  CASE
    WHEN total_games_played = 0 THEN 0
    ELSE ROUND((total_games_won::NUMERIC / total_games_played) * 100, 2)
  END
) STORED;

RAISE NOTICE '  ✓ Added generated column: players_new.win_rate';

-- Add avg_per_dart as a generated column
ALTER TABLE players_new
ADD COLUMN IF NOT EXISTS avg_per_dart NUMERIC(6,2)
GENERATED ALWAYS AS (
  CASE
    WHEN total_darts_thrown = 0 THEN 0
    ELSE ROUND(total_score::NUMERIC / total_darts_thrown, 2)
  END
) STORED;

RAISE NOTICE '  ✓ Added generated column: players_new.avg_per_dart';

-- Add checkout_percentage as a generated column
ALTER TABLE players_new
ADD COLUMN IF NOT EXISTS checkout_percentage NUMERIC(5,2)
GENERATED ALWAYS AS (
  CASE
    WHEN total_checkout_attempts = 0 THEN 0
    ELSE ROUND((total_checkout_successes::NUMERIC / total_checkout_attempts) * 100, 2)
  END
) STORED;

RAISE NOTICE '  ✓ Added generated column: players_new.checkout_percentage';

-- ============================================================================
-- STEP 3: Add Generated Column to game_players
-- ============================================================================

-- Add avg_per_turn as a generated column
ALTER TABLE game_players
ADD COLUMN IF NOT EXISTS avg_per_turn NUMERIC(6,2)
GENERATED ALWAYS AS (
  CASE
    WHEN total_turns = 0 THEN 0
    ELSE ROUND(total_score::NUMERIC / total_turns, 2)
  END
) STORED;

RAISE NOTICE '  ✓ Added generated column: game_players.avg_per_turn';

-- ============================================================================
-- STEP 4: Add Additional Check Constraints
-- ============================================================================

-- Ensure completed games have a winner
ALTER TABLE games_new
ADD CONSTRAINT check_completed_has_winner
CHECK (
  (completed_at IS NULL) OR
  (winner_id IS NOT NULL) OR
  (is_active = false)  -- Allow manually ended games
);

RAISE NOTICE '  ✓ Added check: completed games should have winners';

-- Ensure game_players stats are non-negative
ALTER TABLE game_players
ADD CONSTRAINT check_non_negative_stats
CHECK (
  total_turns >= 0 AND
  total_darts >= 0 AND
  total_score >= 0 AND
  max_dart >= 0 AND
  max_turn >= 0
);

RAISE NOTICE '  ✓ Added check: game_players stats must be non-negative';

-- Ensure player_order is valid
ALTER TABLE game_players
ADD CONSTRAINT check_valid_player_order
CHECK (player_order >= 0);

RAISE NOTICE '  ✓ Added check: player_order must be >= 0';

-- Ensure turns have at least 1 dart
ALTER TABLE turns
ADD CONSTRAINT check_has_darts
CHECK (array_length(dart_scores, 1) >= 1 AND array_length(dart_scores, 1) <= 3);

RAISE NOTICE '  ✓ Added check: turns must have 1-3 darts';

-- Ensure dart scores are valid (0-180 per dart)
ALTER TABLE turns
ADD CONSTRAINT check_valid_dart_scores
CHECK (
  (SELECT bool_and(dart >= 0 AND dart <= 60)
   FROM unnest(dart_scores) dart)
);

RAISE NOTICE '  ✓ Added check: individual dart scores must be 0-60';

-- ============================================================================
-- STEP 5: Create Indexes on Generated Columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_players_win_rate
  ON players_new(win_rate DESC)
  WHERE total_games_played > 0;

CREATE INDEX IF NOT EXISTS idx_players_avg_per_dart
  ON players_new(avg_per_dart DESC)
  WHERE total_darts_thrown > 0;

CREATE INDEX IF NOT EXISTS idx_players_checkout_pct
  ON players_new(checkout_percentage DESC)
  WHERE total_checkout_attempts > 0;

RAISE NOTICE '  ✓ Created indexes on generated columns';

-- ============================================================================
-- STEP 6: Verify Referential Integrity
-- ============================================================================

DO $$
DECLARE
  orphaned_game_players INTEGER;
  orphaned_turns INTEGER;
  games_missing_winners INTEGER;
BEGIN
  -- Check for orphaned game_players (should be none after FK addition)
  SELECT COUNT(*) INTO orphaned_game_players
  FROM game_players gp
  LEFT JOIN games_new g ON g.id = gp.game_id
  LEFT JOIN players_new p ON p.id = gp.player_id
  WHERE g.id IS NULL OR p.id IS NULL;

  -- Check for orphaned turns
  SELECT COUNT(*) INTO orphaned_turns
  FROM turns t
  LEFT JOIN game_players gp ON gp.id = t.game_player_id
  WHERE gp.id IS NULL;

  -- Check completed games without winners
  SELECT COUNT(*) INTO games_missing_winners
  FROM games_new
  WHERE completed_at IS NOT NULL AND winner_id IS NULL AND is_active = true;

  IF orphaned_game_players = 0 AND orphaned_turns = 0 THEN
    RAISE NOTICE 'Referential integrity verified: no orphaned records';
  ELSE
    IF orphaned_game_players > 0 THEN
      RAISE WARNING 'Found % orphaned game_players records', orphaned_game_players;
    END IF;
    IF orphaned_turns > 0 THEN
      RAISE WARNING 'Found % orphaned turns records', orphaned_turns;
    END IF;
  END IF;

  IF games_missing_winners > 0 THEN
    RAISE WARNING '% completed games are missing winner_id', games_missing_winners;
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Display Constraint Summary
-- ============================================================================

DO $$
DECLARE
  total_fks INTEGER;
  total_checks INTEGER;
  total_generated INTEGER;
BEGIN
  -- Count foreign keys
  SELECT COUNT(*) INTO total_fks
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name IN ('games_new', 'players_new', 'game_players', 'turns');

  -- Count check constraints
  SELECT COUNT(*) INTO total_checks
  FROM information_schema.table_constraints
  WHERE constraint_type = 'CHECK'
    AND table_schema = 'public'
    AND table_name IN ('games_new', 'players_new', 'game_players', 'turns');

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Constraints Summary:';
  RAISE NOTICE '  Foreign keys: %', total_fks;
  RAISE NOTICE '  Check constraints: %', total_checks;
  RAISE NOTICE '  Generated columns: 4 (win_rate, avg_per_dart, checkout_percentage, avg_per_turn)';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V009', 'Add foreign key constraints and computed columns')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V009: Constraints and computed columns added successfully';
  RAISE NOTICE 'Next step: Run V010 to create triggers for automatic stat updates';
END $$;
