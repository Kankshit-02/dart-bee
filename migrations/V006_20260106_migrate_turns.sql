-- V006: Migrate Individual Turns
-- Description: Extracts individual turn records from nested JSONB arrays
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V006: Starting turns migration...';
  RAISE NOTICE 'This is the most complex migration and may take several minutes...';
END $$;

-- Update progress
UPDATE migration_progress
SET started_at = NOW(), status = 'running'
WHERE step = 'V006_migrate_turns';

-- ============================================================================
-- STEP 1: Extract and Insert Turns from Nested JSONB
-- ============================================================================

INSERT INTO turns (
  id,
  game_player_id,
  turn_number,
  round_number,
  score_before,
  score_after,
  turn_total,
  dart_scores,
  is_busted,
  is_checkout_attempt,
  is_successful_checkout,
  created_at
)
WITH turn_extraction AS (
  SELECT
    gp.id as game_player_id,
    gp.game_id,
    gp.starting_score,
    g.players,
    p.name as player_name,
    jsonb_array_length(g.players) as total_players_in_game
  FROM game_players gp
  JOIN games g ON g.id = gp.game_id
  JOIN players_new p ON p.id = gp.player_id
),
player_turns AS (
  SELECT
    te.game_player_id,
    te.starting_score,
    te.total_players_in_game,
    (turn_ord.ordinality - 1)::INTEGER as turn_index,
    turn_ord.turn_data,
    -- Extract timestamp if available
    CASE
      WHEN turn_ord.turn_data ? 'timestamp' THEN
        to_timestamp((turn_ord.turn_data->>'timestamp')::BIGINT / 1000.0)
      ELSE
        NOW()
    END as turn_timestamp
  FROM turn_extraction te,
  LATERAL (
    SELECT player_elem
    FROM jsonb_array_elements(te.players) player_elem
    WHERE player_elem->>'name' = te.player_name
    LIMIT 1
  ) player_data,
  LATERAL jsonb_array_elements(
    COALESCE(player_data.player_elem->'turns', '[]'::jsonb)
  ) WITH ORDINALITY turn_ord(turn_data, ordinality)
)
SELECT
  gen_random_uuid() as id,
  pt.game_player_id,
  (pt.turn_index + 1)::INTEGER as turn_number,
  FLOOR(pt.turn_index::NUMERIC / pt.total_players_in_game)::INTEGER as round_number,
  -- Calculate score_before (remaining score before this turn)
  safe_jsonb_int(pt.turn_data, 'remaining', 0) +
    (SELECT SUM((dart::TEXT)::INTEGER) FROM jsonb_array_elements(pt.turn_data->'darts') dart)
    as score_before,
  safe_jsonb_int(pt.turn_data, 'remaining', 0) as score_after,
  (SELECT SUM((dart::TEXT)::INTEGER) FROM jsonb_array_elements(pt.turn_data->'darts') dart) as turn_total,
  extract_dart_scores(pt.turn_data) as dart_scores,
  safe_jsonb_bool(pt.turn_data, 'busted', false) as is_busted,
  -- Detect checkout attempts (when remaining would be 0 or below)
  CASE
    WHEN safe_jsonb_int(pt.turn_data, 'remaining', 0) <= 0 THEN true
    ELSE false
  END as is_checkout_attempt,
  -- Successful checkout (remaining exactly 0, not busted)
  CASE
    WHEN safe_jsonb_int(pt.turn_data, 'remaining', 0) = 0
      AND safe_jsonb_bool(pt.turn_data, 'busted', false) = false THEN true
    ELSE false
  END as is_successful_checkout,
  pt.turn_timestamp as created_at
FROM player_turns pt;

-- ============================================================================
-- STEP 2: Verification
-- ============================================================================

DO $$
DECLARE
  total_turns_old INTEGER;
  total_turns_new INTEGER;
  turns_with_180 INTEGER;
  avg_darts_per_turn NUMERIC;
  max_turn_score INTEGER;
BEGIN
  -- Count turns in old schema
  SELECT count_total_turns_old_schema() INTO total_turns_old;

  -- Count turns in new table
  SELECT COUNT(*) INTO total_turns_new FROM turns;

  -- Count 180s
  SELECT COUNT(*) INTO turns_with_180
  FROM turns
  WHERE turn_total = 180;

  -- Average darts per turn
  SELECT AVG(array_length(dart_scores, 1)) INTO avg_darts_per_turn
  FROM turns;

  -- Max turn score
  SELECT MAX(turn_total) INTO max_turn_score FROM turns;

  -- Verify counts
  IF ABS(total_turns_old - total_turns_new) <= 5 THEN -- Allow small discrepancy
    RAISE NOTICE 'Turns migration successful: % turns migrated', total_turns_new;

    UPDATE migration_progress
    SET
      completed_at = NOW(),
      status = 'completed',
      rows_processed = total_turns_new
    WHERE step = 'V006_migrate_turns';
  ELSE
    RAISE WARNING 'Turn count mismatch! Old: %, New: %', total_turns_old, total_turns_new;

    UPDATE migration_progress
    SET
      status = 'warning',
      rows_processed = total_turns_new,
      errors = ARRAY[format('Count mismatch: %s vs %s', total_turns_old, total_turns_new)]
    WHERE step = 'V006_migrate_turns';
  END IF;

  RAISE NOTICE '  180s found: %', turns_with_180;
  RAISE NOTICE '  Average darts per turn: %', ROUND(avg_darts_per_turn, 2);
  RAISE NOTICE '  Maximum turn score: %', max_turn_score;
END $$;

-- ============================================================================
-- STEP 3: Verify Turn Sequence Integrity
-- ============================================================================

DO $$
DECLARE
  games_with_gaps INTEGER;
  games_with_duplicates INTEGER;
BEGIN
  -- Check for gaps in turn numbers
  SELECT COUNT(DISTINCT game_player_id) INTO games_with_gaps
  FROM (
    SELECT
      game_player_id,
      turn_number,
      LAG(turn_number) OVER (PARTITION BY game_player_id ORDER BY turn_number) as prev_turn
    FROM turns
  ) subq
  WHERE turn_number - COALESCE(prev_turn, 0) > 1;

  IF games_with_gaps > 0 THEN
    RAISE WARNING 'Found % game-players with gaps in turn numbers', games_with_gaps;
  END IF;

  -- Check for duplicate turn numbers
  SELECT COUNT(*) INTO games_with_duplicates
  FROM (
    SELECT game_player_id, turn_number
    FROM turns
    GROUP BY game_player_id, turn_number
    HAVING COUNT(*) > 1
  ) subq;

  IF games_with_duplicates > 0 THEN
    RAISE WARNING 'Found % duplicate turn numbers', games_with_duplicates;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Display Summary Statistics
-- ============================================================================

DO $$
DECLARE
  total_turns INTEGER;
  total_darts INTEGER;
  checkout_attempts INTEGER;
  successful_checkouts INTEGER;
  bust_count INTEGER;
BEGIN
  SELECT
    COUNT(*),
    SUM(array_length(dart_scores, 1)),
    COUNT(*) FILTER (WHERE is_checkout_attempt = true),
    COUNT(*) FILTER (WHERE is_successful_checkout = true),
    COUNT(*) FILTER (WHERE is_busted = true)
  INTO total_turns, total_darts, checkout_attempts, successful_checkouts, bust_count
  FROM turns;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Turns Migration Summary:';
  RAISE NOTICE '  Total turns: %', total_turns;
  RAISE NOTICE '  Total darts thrown: %', total_darts;
  RAISE NOTICE '  Checkout attempts: %', checkout_attempts;
  RAISE NOTICE '  Successful checkouts: %', successful_checkouts;
  RAISE NOTICE '  Busts: %', bust_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V006', 'Migrate individual turns from nested JSONB')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V006: Turns migration completed';
  RAISE NOTICE 'Next step: Run V007 to update player aggregate statistics';
END $$;
