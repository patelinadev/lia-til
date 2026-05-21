-- =============================================================================
-- lia-til v1 backend schema
--
-- Goal: track which LeetCode problems Lia has checked off, synced across
-- her laptop, phone, and tablet. Single user. No auth.
--
-- This file is run ONCE in Neon's SQL editor to create the table.
-- =============================================================================

-- Design decisions made:
--   - PK: INTEGER (LeetCode number) — small, fast index, natural unique key.
--   - State: TIMESTAMPTZ (nullable). NULL = not done, value = when checked off.
--     Bonus: gives us "when did I solve this?" for free, useful later.
--   - Eager design: one row per problem exists from the start (seeded). Toggle
--     is UPDATE done_timestamp, never INSERT/DELETE during normal use.
--   - `title` kept alongside id so `SELECT *` is human-readable in Neon.

CREATE TABLE lc_problems (
    problem_id     INTEGER       PRIMARY KEY,
    title          TEXT,
    done_timestamp TIMESTAMPTZ
);
