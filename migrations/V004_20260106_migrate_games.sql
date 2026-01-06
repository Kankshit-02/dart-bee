-- V004: Migrate Games Metadata
-- Description: Migrates game metadata from old games table to games_new (without JSONB players)
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V004: Starting games metadata migration...';
END $$;

-- Update progress
UPDATE migration_progress
SET started_at = NOW(), status = 'running'
WHERE step = 'V004_migrate_games';

-- ============================================================================
-- STEP 1: Migrate Game Metadata (Without Players Array)
-- ============================================================================

INSERT INTO games_new (
  id,
  created_at,
  completed_at,
  updated_at,
  game_type,
  win_condition,
  scoring_mode,
  is_active,
  current_turn,
  device_id,
  total_players
)
SELECT
  g.id,
  g.created_at,
  g.completed_at,
  COALESCE(g.updated_at, g.created_at) as updated_at,
  g.game_type,
  g.win_condition,
  g.scoring_mode,
  g.is_active,
  g.current_turn,
  g.device_id,
  jsonb_array_length(g.players) as total_players
FROM games g
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Set Winner IDs (Will be fully resolved after game_players migration)
-- ============================================================================

-- Update winner_id based on players JSONB where winner = true
UPDATE games_new gn
SET winner_id = (
  SELECT p.id
  FROM games g,
  LATERAL jsonb_array_elements(g.players) player_elem
  JOIN players_new p ON p.name = (player_elem->>'name')
  WHERE g.id = gn.id
    AND (player_elem->>'winner')::BOOLEAN = true
  LIMIT 1
)
WHERE gn.winner_id IS NULL
  AND gn.completed_at IS NOT NULL;

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  old_game_count INTEGER;
  new_game_count INTEGER;
  completed_with_winners INTEGER;
  completed_without_winners INTEGER;
BEGIN
  -- Count games in old table
  SELECT COUNT(*) INTO old_game_count FROM games;

  -- Count games in new table
  SELECT COUNT(*) INTO new_game_count FROM games_new;

  -- Count completed games with winners
  SELECT COUNT(*) INTO completed_with_winners
  FROM games_new
  WHERE completed_at IS NOT NULL AND winner_id IS NOT NULL;

  -- Count completed games without winners
  SELECT COUNT(*) INTO completed_without_winners
  FROM games_new
  WHERE completed_at IS NOT NULL AND winner_id IS NULL;

  -- Verify counts
  IF old_game_count = new_game_count THEN
    RAISE NOTICE 'Game migration successful: % games migrated', new_game_count;

    -- Update progress
    UPDATE migration_progress
    SET
      completed_at = NOW(),
      status = 'completed',
      rows_processed = new_game_count
    WHERE step = 'V004_migrate_games';
  ELSE
    RAISE WARNING 'Game count mismatch! Old: %, New: %', old_game_count, new_game_count;

    UPDATE migration_progress
    SET
      status = 'warning',
      rows_processed = new_game_count,
      errors = ARRAY[format('Count mismatch: %s vs %s', old_game_count, new_game_count)]
    WHERE step = 'V004_migrate_games';
  END IF;

  -- Report on winners
  RAISE NOTICE 'Completed games with winners: %', completed_with_winners;
  IF completed_without_winners > 0 THEN
    RAISE WARNING 'Completed games without winners: %', completed_without_winners;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Display Summary Statistics
-- ============================================================================

DO $$
DECLARE
  total_games INTEGER;
  active_games INTEGER;
  completed_games INTEGER;
  avg_players NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL),
    AVG(total_players)
  INTO total_games, active_games, completed_games, avg_players
  FROM games_new;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Games Migration Summary:';
  RAISE NOTICE '  Total games: %', total_games;
  RAISE NOTICE '  Active games: %', active_games;
  RAISE NOTICE '  Completed games: %', completed_games;
  RAISE NOTICE '  Average players per game: %', ROUND(avg_players, 1);
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V004', 'Migrate games metadata to games_new table')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V004: Games metadata migration completed';
  RAISE NOTICE 'Next step: Run V005 to migrate game_players junction data';
END $$;
