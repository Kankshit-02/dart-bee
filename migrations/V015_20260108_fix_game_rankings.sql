-- ============================================================================
-- Migration V015: Fix Game Rankings
-- Created: 2026-01-08
-- Description: Recalculate finish_rank for all completed games
--              Players finishing in same round get SAME rank (ties allowed)
-- ============================================================================

-- Update all game_players with correct rankings
-- Players in same round = same rank
UPDATE game_players gp
SET finish_rank = ranked.new_rank
FROM (
  SELECT
    id,
    DENSE_RANK() OVER (
      PARTITION BY game_id
      ORDER BY
        CASE WHEN finish_round IS NULL THEN 999999 ELSE finish_round END
    ) as new_rank
  FROM game_players
) ranked
WHERE gp.id = ranked.id;
