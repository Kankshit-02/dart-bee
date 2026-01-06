-- V005: Migrate Game Players Junction Table
-- Description: Extracts player participation data from games JSONB players array
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V005: Starting game_players migration...';
  RAISE NOTICE 'This may take a while for large datasets...';
END $$;

-- Update progress
UPDATE migration_progress
SET started_at = NOW(), status = 'running'
WHERE step = 'V005_migrate_game_players';

-- ============================================================================
-- STEP 1: Extract and Insert Game Players from JSONB
-- ============================================================================

INSERT INTO game_players (
  id,
  game_id,
  player_id,
  player_order,
  starting_score,
  final_score,
  is_winner,
  finish_rank,
  finish_round,
  total_turns,
  total_darts,
  total_score,
  max_dart,
  max_turn,
  count_180s,
  count_140_plus,
  checkout_attempts,
  checkout_successes,
  created_at
)
SELECT
  gen_random_uuid() as id,
  g.id as game_id,
  p.id as player_id,
  (elem_ord.ordinality - 1)::INTEGER as player_order,
  safe_jsonb_int(elem_ord.elem, 'startingScore', g.game_type) as starting_score,
  safe_jsonb_int(elem_ord.elem, 'currentScore', 0) as final_score,
  safe_jsonb_bool(elem_ord.elem, 'winner', false) as is_winner,
  safe_jsonb_int(elem_ord.elem, 'finish_rank', NULL) as finish_rank,
  safe_jsonb_int(elem_ord.elem, 'finish_round', NULL) as finish_round,
  jsonb_array_length(COALESCE(elem_ord.elem->'turns', '[]'::jsonb)) as total_turns,
  safe_jsonb_int(elem_ord.elem, 'stats.totalDarts', 0) as total_darts,
  safe_jsonb_int(elem_ord.elem, 'stats.totalScore', 0) as total_score,
  safe_jsonb_int(elem_ord.elem, 'stats.maxDart', 0) as max_dart,
  safe_jsonb_int(elem_ord.elem, 'stats.maxTurn', 0) as max_turn,
  -- Count 180s from turns
  (
    SELECT COUNT(*)::INTEGER
    FROM jsonb_array_elements(COALESCE(elem_ord.elem->'turns', '[]'::jsonb)) turn
    WHERE (
      SELECT SUM((dart::TEXT)::INTEGER)
      FROM jsonb_array_elements(turn->'darts') dart
    ) = 180
  ) as count_180s,
  -- Count 140+ scores from turns
  (
    SELECT COUNT(*)::INTEGER
    FROM jsonb_array_elements(COALESCE(elem_ord.elem->'turns', '[]'::jsonb)) turn
    WHERE (
      SELECT SUM((dart::TEXT)::INTEGER)
      FROM jsonb_array_elements(turn->'darts') dart
    ) BETWEEN 140 AND 179
  ) as count_140_plus,
  safe_jsonb_int(elem_ord.elem, 'stats.checkoutAttempts', 0) as checkout_attempts,
  safe_jsonb_int(elem_ord.elem, 'stats.checkoutSuccess', 0) as checkout_successes,
  g.created_at
FROM games g,
LATERAL jsonb_array_elements(g.players) WITH ORDINALITY elem_ord(elem, ordinality)
JOIN players_new p ON p.name = (elem_ord.elem->>'name');

-- ============================================================================
-- STEP 2: Verification
-- ============================================================================

DO $$
DECLARE
  total_player_entries INTEGER;
  games_migrated INTEGER;
  game_players_migrated INTEGER;
  avg_players_per_game NUMERIC;
BEGIN
  -- Count total player entries in old JSONB (sum of array lengths)
  SELECT SUM(jsonb_array_length(players))::INTEGER INTO total_player_entries
  FROM games;

  -- Count game_players records
  SELECT COUNT(*) INTO game_players_migrated
  FROM game_players;

  -- Count distinct games in game_players
  SELECT COUNT(DISTINCT game_id) INTO games_migrated
  FROM game_players;

  -- Average players per game
  SELECT AVG(player_count) INTO avg_players_per_game
  FROM (
    SELECT COUNT(*) as player_count
    FROM game_players
    GROUP BY game_id
  ) subq;

  -- Verify counts
  IF total_player_entries = game_players_migrated THEN
    RAISE NOTICE 'Game players migration successful: % records migrated', game_players_migrated;

    UPDATE migration_progress
    SET
      completed_at = NOW(),
      status = 'completed',
      rows_processed = game_players_migrated
    WHERE step = 'V005_migrate_game_players';
  ELSE
    RAISE WARNING 'Game player count mismatch! Expected: %, Got: %',
      total_player_entries, game_players_migrated;

    UPDATE migration_progress
    SET
      status = 'warning',
      rows_processed = game_players_migrated,
      errors = ARRAY[format('Count mismatch: %s vs %s', total_player_entries, game_players_migrated)]
    WHERE step = 'V005_migrate_game_players';
  END IF;

  RAISE NOTICE '  Games with players: %', games_migrated;
  RAISE NOTICE '  Average players per game: %', ROUND(avg_players_per_game, 1);
END $$;

-- ============================================================================
-- STEP 3: Verify Winner Consistency
-- ============================================================================

DO $$
DECLARE
  games_with_multiple_winners INTEGER;
  completed_games_without_winners INTEGER;
BEGIN
  -- Check for games with multiple winners (should be rare/none)
  SELECT COUNT(*) INTO games_with_multiple_winners
  FROM (
    SELECT game_id
    FROM game_players
    WHERE is_winner = true
    GROUP BY game_id
    HAVING COUNT(*) > 1
  ) subq;

  IF games_with_multiple_winners > 0 THEN
    RAISE WARNING 'Found % games with multiple winners', games_with_multiple_winners;
  END IF;

  -- Check completed games without winners
  SELECT COUNT(*) INTO completed_games_without_winners
  FROM games_new gn
  LEFT JOIN game_players gp ON gn.id = gp.game_id AND gp.is_winner = true
  WHERE gn.completed_at IS NOT NULL AND gp.id IS NULL;

  IF completed_games_without_winners > 0 THEN
    RAISE WARNING 'Found % completed games without winners', completed_games_without_winners;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Display Summary Statistics
-- ============================================================================

DO $$
DECLARE
  total_records INTEGER;
  total_winners INTEGER;
  total_180s INTEGER;
  max_turns_player TEXT;
  max_turns_count INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_winner = true),
    SUM(count_180s)
  INTO total_records, total_winners, total_180s
  FROM game_players;

  -- Find player with most turns in a single game
  SELECT p.name, gp.total_turns
  INTO max_turns_player, max_turns_count
  FROM game_players gp
  JOIN players_new p ON p.id = gp.player_id
  ORDER BY gp.total_turns DESC
  LIMIT 1;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Game Players Migration Summary:';
  RAISE NOTICE '  Total game-player records: %', total_records;
  RAISE NOTICE '  Total winners: %', total_winners;
  RAISE NOTICE '  Total 180s scored: %', total_180s;
  RAISE NOTICE '  Most turns in a game: % by %', max_turns_count, max_turns_player;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V005', 'Migrate game_players junction table from JSONB')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V005: Game players migration completed';
  RAISE NOTICE 'Next step: Run V006 to migrate individual turns';
END $$;
