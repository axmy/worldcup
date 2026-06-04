-- ============================================================
-- Performance: index predictions by match_id
-- ============================================================
-- The scoring trigger runs `update public.predictions ... where match_id = X`
-- for EVERY result that's published/synced, and deleting a match cascades to
-- predictions on match_id. Neither was indexed: the unique constraint
-- (user_id, league_id, match_id) can't serve a match_id-only lookup, so both
-- did a full table scan. At tens/hundreds of thousands of predictions this is
-- the main bottleneck — this index turns those into fast index lookups.
--
-- (Other hot paths are already covered: predictions(league_id) exists;
--  (user_id) / (user_id, league_id) lookups use the unique index prefix;
--  league_members has a PK on (league_id, user_id) + a user_id index.)

create index if not exists predictions_match_idx on public.predictions (match_id);
