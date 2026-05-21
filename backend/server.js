// lia-til v1 backend — Express + Postgres
//
// Endpoints:
//   GET  /progress           → { completed: [167, 15, ...] }   list of done problem_ids
//   POST /progress/toggle    → toggles done_timestamp for one problem
//
// Connection: Neon Postgres via the standard `pg` library (connection pool).
// CORS: open for v1 (anyone can call). In a real app you'd restrict to your
//   frontend origin. Interview-relevant fact: CORS is a *browser* policy,
//   not a server security feature — the server just tells the browser what's
//   allowed.

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// One pool = many short-lived connections to Postgres. You DO NOT want to
// open a new connection per request — pooling is essential for any
// production-grade backend. Common interview follow-up: "what's a connection
// pool?" Answer: a reusable set of DB connections kept open by the app to
// avoid the TCP+auth handshake on every query.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires TLS
});

app.use(cors());
app.use(express.json());

// ---- GET /progress ---------------------------------------------------------
// Returns all problem_ids whose done_timestamp is not NULL.
// Note the parameterized query is unnecessary here (no user input), but
// I'm using the same `pool.query` pattern you'll use in the POST below.
app.get('/progress', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT problem_id FROM lc_problems WHERE done_timestamp IS NOT NULL ORDER BY problem_id'
    );
    res.json({ completed: rows.map((r) => r.problem_id) });
  } catch (err) {
    console.error('GET /progress failed:', err);
    res.status(500).json({ error: 'database error' });
  }
});

// ---- POST /progress/toggle -------------------------------------------------
// Body: { "problem_id": 167 }
// Response: { "problem_id": 167, "completed": true }
//
// Flips done_timestamp atomically (NULL ↔ NOW()) in a single SQL statement.
app.post('/progress/toggle', async (req, res) => {
  const { problem_id } = req.body;
  if (typeof problem_id !== 'number' || !Number.isInteger(problem_id)) {
    return res.status(400).json({ error: 'problem_id must be an integer' });
  }

  try {
    // Atomic toggle: one statement does read+decide+write inside the DB,
    // so concurrent requests can't race. RETURNING avoids a follow-up SELECT.
    const { rows } = await pool.query(
      `UPDATE lc_problems
       SET done_timestamp = CASE WHEN done_timestamp IS NULL THEN NOW() ELSE NULL END
       WHERE problem_id = $1
       RETURNING problem_id, done_timestamp`,
      [problem_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: `no problem with id ${problem_id}` });
    }
    res.json({
      problem_id: rows[0].problem_id,
      completed: rows[0].done_timestamp !== null,
    });
  } catch (err) {
    console.error('POST /progress/toggle failed:', err);
    res.status(500).json({ error: 'database error' });
  }
});

app.listen(port, () => {
  console.log(`lia-til backend listening on port ${port}`);
});
