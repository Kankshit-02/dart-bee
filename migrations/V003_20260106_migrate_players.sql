-- V003: Migrate Players from JSONB to Normalized Table
-- Description: Extracts unique player names from games and creates player records
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V003: Starting player migration...';
END $$;

-- Update progress
UPDATE migration_progress
SET started_at = NOW(), status = 'running'
WHERE step = 'V003_migrate_players';

-- ============================================================================
-- STEP 1: Extract and Insert Unique Players
-- ============================================================================

-- Extract all unique player names from games JSONB and create player records
INSERT INTO players_new (id, name, created_at)
SELECT
  gen_random_uuid() as id,
  player_name,
  first_seen as created_at
FROM extract_player_names_from_games()
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 2: Handle Existing Players from Old players Table (If Exists)
-- ============================================================================

-- Check if old players table exists and merge data
DO $$
DECLARE
  old_players_exist BOOLEAN;
  players_migrated INTEGER;
BEGIN
  -- Check if old players table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'players'
  ) INTO old_players_exist;

  IF old_players_exist THEN
    RAISE NOTICE 'Found existing players table, merging data...';

    -- Update created_at for players that exist in old table
    UPDATE players_new pn
    SET created_at = LEAST(pn.created_at, p.created_at)
    FROM players p
    WHERE pn.name = p.name;

    GET DIAGNOSTICS players_migrated = ROW_COUNT;
    RAISE NOTICE 'Updated timestamps for % existing players', players_migrated;
  ELSE
    RAISE NOTICE 'No existing players table found, using game data only';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  unique_players_in_games INTEGER;
  players_in_new_table INTEGER;
BEGIN
  -- Count unique players in old games JSONB
  SELECT COUNT(DISTINCT elem->>'name') INTO unique_players_in_games
  FROM games,
  LATERAL jsonb_array_elements(players) elem;

  -- Count players in new table
  SELECT COUNT(*) INTO players_in_new_table
  FROM players_new;

  -- Verify counts match
  IF unique_players_in_games = players_in_new_table THEN
    RAISE NOTICE 'Player migration successful: % players migrated', players_in_new_table;

    -- Update progress
    UPDATE migration_progress
    SET
      completed_at = NOW(),
      status = 'completed',
      rows_processed = players_in_new_table
    WHERE step = 'V003_migrate_players';
  ELSE
    RAISE WARNING 'Player count mismatch! Games: %, New table: %',
      unique_players_in_games, players_in_new_table;

    UPDATE migration_progress
    SET
      status = 'warning',
      rows_processed = players_in_new_table,
      errors = ARRAY[format('Count mismatch: %s vs %s', unique_players_in_games, players_in_new_table)]
    WHERE step = 'V003_migrate_players';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Display Sample Data
-- ============================================================================

DO $$
DECLARE
  sample_players TEXT;
BEGIN
  SELECT string_agg(name, ', ')
  INTO sample_players
  FROM (SELECT name FROM players_new ORDER BY created_at LIMIT 10) s;

  RAISE NOTICE 'Sample players: %', sample_players;
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V003', 'Migrate players from JSONB to players_new table')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
DECLARE
  player_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO player_count FROM players_new;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'V003: Player migration completed';
  RAISE NOTICE 'Total players migrated: %', player_count;
  RAISE NOTICE 'Next step: Run V004 to migrate games';
  RAISE NOTICE '========================================';
END $$;
