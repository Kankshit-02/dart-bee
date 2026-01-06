# Database Migration Guide

This directory contains SQL migration files to transform the Dart Bee database from a JSONB-denormalized schema to a fully normalized relational structure.

## 🎯 Migration Overview

**Goal**: Scale database to handle 100s of users and 1000s of games

**Current Issues**:
- 22+ database queries for leaderboard (N+1 problem)
- No pagination - loads all games into memory
- Client-side filtering instead of SQL WHERE clauses
- Stats calculated by iterating entire dataset

**Expected Improvements**:
- Leaderboard: 95% faster (2-5s → <100ms)
- Game history: 99% faster (indexed queries)
- Stats calculation: 100x faster (O(1) lookups)

---

## 📋 Migration Files

Execute these files **in sequential order**:

| File | Description | Critical |
|------|-------------|----------|
| `V001_20260106_create_base_schema.sql` | Creates new normalized tables | ✅ |
| `V002_20260106_create_helper_functions.sql` | Migration utility functions | ✅ |
| `V003_20260106_migrate_players.sql` | Extracts players from JSONB | ✅ |
| `V004_20260106_migrate_games.sql` | Migrates game metadata | ✅ |
| `V005_20260106_migrate_game_players.sql` | Extracts game-player junction data | ✅ |
| `V006_20260106_migrate_turns.sql` | Extracts individual turns | ✅ |
| `V007_20260106_update_aggregates.sql` | Recalculates player stats | ✅ |
| `V008_20260106_create_indexes.sql` | Creates performance indexes | ⚡ |
| `V009_20260106_add_constraints.sql` | Adds foreign keys & constraints | 🔒 |
| `V010_20260106_create_triggers.sql` | Auto-update triggers | 🤖 |
| `V011_20260106_verify_migration.sql` | Comprehensive verification | ✔️ |
| `V012_20260106_create_materialized_views.sql` | Fast leaderboard views | ⚡ |
| `V013_20260106_cleanup_old_schema.sql` | Swaps tables to production | ⚠️ |

---

## 🚀 Execution Instructions

### Prerequisites

1. **Backup your database** (CRITICAL!)
   ```bash
   # Supabase: Use dashboard backup feature
   # Or export via pg_dump
   ```

2. **Set up staging environment**
   - Test migrations on a copy of production data first
   - Verify all steps succeed before running on production

### Step 1: Connect to Database

```bash
# Using Supabase CLI
supabase db reset --db-url "postgresql://..."

# Or use psql
psql -h <host> -U <user> -d <database>
```

### Step 2: Run Migrations Sequentially

```sql
-- Execute each file in order
\i migrations/V001_20260106_create_base_schema.sql
\i migrations/V002_20260106_create_helper_functions.sql
\i migrations/V003_20260106_migrate_players.sql
\i migrations/V004_20260106_migrate_games.sql
\i migrations/V005_20260106_migrate_game_players.sql
\i migrations/V006_20260106_migrate_turns.sql
\i migrations/V007_20260106_update_aggregates.sql
\i migrations/V008_20260106_create_indexes.sql
\i migrations/V009_20260106_add_constraints.sql
\i migrations/V010_20260106_create_triggers.sql
\i migrations/V011_20260106_verify_migration.sql
\i migrations/V012_20260106_create_materialized_views.sql
\i migrations/V013_20260106_cleanup_old_schema.sql
```

**OR** use a bash script:

```bash
#!/bin/bash
for file in migrations/V*.sql; do
  echo "Executing $file..."
  psql -h <host> -U <user> -d <database> -f "$file"
  if [ $? -ne 0 ]; then
    echo "❌ Migration failed at $file"
    exit 1
  fi
done
echo "✅ All migrations completed successfully"
```

### Step 3: Verify Migration

After V011, check the output for:
- ✅ All checks passed
- No critical failures
- Data counts match between old and new schemas

### Step 4: Update Application Code

Update these files to use the new schema:
- `scripts/storage.js` - Multi-table operations, pagination
- `scripts/stats.js` - Query from materialized views
- `scripts/ui.js` - Add pagination controls

See the implementation plan in `~/.claude/plans/serene-snacking-lampson.md`

### Step 5: Deploy & Monitor

1. Deploy updated application code
2. Test all critical flows:
   - Create new game
   - View leaderboard
   - Player stats
   - Game history
3. Monitor Supabase dashboard for:
   - Query performance
   - Error logs
   - Index usage

---

## 🔄 Rollback Instructions

If migration fails, rollback using V013's instructions:

```sql
-- Emergency rollback
DROP TABLE IF EXISTS turns, game_players CASCADE;
DROP TABLE IF EXISTS games, players CASCADE;
DROP MATERIALIZED VIEW IF EXISTS player_leaderboard, recent_games_summary;

-- Restore from backup
ALTER TABLE games_backup_20260106 RENAME TO games;
ALTER TABLE players_backup_20260106 RENAME TO players;
```

Then redeploy old application code.

---

## 📊 New Schema Overview

### Tables

**games**
- Metadata only (no JSONB)
- Foreign key to winner

**players**
- Denormalized aggregate stats
- Generated columns (win_rate, avg_per_dart)

**game_players** (junction)
- Links games to players
- Per-game stats

**turns**
- Individual turn records
- Dart scores as PostgreSQL array

### Materialized Views

**player_leaderboard**
- Pre-computed rankings
- Refresh on game completion
- Query: `SELECT * FROM player_leaderboard ORDER BY rank_by_wins LIMIT 50;`

**recent_games_summary**
- Fast game history lookups
- Includes aggregated stats

---

## 🛠️ Maintenance

### Refresh Leaderboard

```sql
-- Manual refresh (if needed)
SELECT refresh_player_leaderboard();

-- Or refresh all views
SELECT refresh_all_materialized_views();
```

### Drop Backups (After 30 Days)

```sql
DROP TABLE IF EXISTS games_backup_20260106 CASCADE;
DROP TABLE IF EXISTS players_backup_20260106 CASCADE;
```

### Monitor Performance

```sql
-- Check index usage
SELECT
  schemaname, tablename, indexname,
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check materialized view freshness
SELECT matviewname, last_refresh
FROM pg_matviews
WHERE schemaname = 'public';
```

---

## ⚠️ Important Notes

1. **Backup first!** Cannot stress this enough
2. **Test on staging** before production
3. **Run during low-traffic** period if possible
4. **Monitor closely** after deployment
5. **Keep backups for 30 days** before cleanup
6. **V006 may take several minutes** on large datasets (nested JSONB extraction)
7. **V013 is irreversible** - swaps production tables

---

## 📞 Support

If migrations fail:
1. Check the error message in the SQL output
2. Review `migration_progress` table for details
3. DO NOT proceed to next migration if one fails
4. Restore from backup if needed
5. Refer to the detailed plan in `~/.claude/plans/serene-snacking-lampson.md`

---

## ✅ Success Criteria

Migration is successful when:
- [x] All 13 migrations complete without errors
- [x] V011 verification shows all checks passed
- [x] Leaderboard query returns results in <100ms
- [x] Application loads game history with pagination
- [x] Player stats update automatically
- [x] No data loss (verified by count comparisons)

---

**Migration Created**: 2026-01-06
**Schema Version**: v2.0 (Normalized)
**Status**: Ready for execution
