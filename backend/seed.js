// One-shot seed script.
//
// Reads the existing frontend's `data = [...]` literal out of ../index.html,
// extracts every "NNN. Problem Title" string from examples + homework,
// dedupes by LeetCode number, and inserts one row per problem into
// `lc_problems` with NULL done_timestamp.
//
// Idempotent: uses ON CONFLICT DO NOTHING so you can re-run it safely.
//
// Run with:    node seed.js

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

function loadProblemsFromIndexHtml() {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Grab the `const data = [ ... ];` literal. `[\s\S]*?` = any chars,
  // non-greedy, so it stops at the first `\n];` it sees.
  const match = html.match(/const data = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('Could not find `const data = [...]` in index.html');

  // The literal uses unquoted JS object keys, so JSON.parse won't work.
  // Function constructor evaluates it as a JS expression. Safe here because
  // the source file is our own.
  const data = new Function('return ' + match[1])();

  const seen = new Map();
  for (const pattern of data) {
    for (const section of ['examples', 'homework']) {
      for (const itemStr of pattern[section] || []) {
        const m = itemStr.match(/^(\d+)\.\s*(.+)$/);
        if (!m) continue;
        const id = parseInt(m[1], 10);
        const title = m[2].trim();
        if (!seen.has(id)) seen.set(id, { id, title });
      }
    }
  }
  return Array.from(seen.values());
}

async function main() {
  const problems = loadProblemsFromIndexHtml();
  console.log(`Parsed ${problems.length} unique problems from index.html`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let inserted = 0;
  let skipped = 0;
  for (const { id, title } of problems) {
    const result = await pool.query(
      `INSERT INTO lc_problems (problem_id, title)
       VALUES ($1, $2)
       ON CONFLICT (problem_id) DO NOTHING`,
      [id, title]
    );
    if (result.rowCount > 0) inserted++;
    else skipped++;
  }

  console.log(`Inserted ${inserted}, skipped (already existed) ${skipped}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
