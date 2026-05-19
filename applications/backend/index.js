'use strict';

const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'jokes',
  user:     process.env.PGUSER     || 'postgres',
  password: process.env.PGPASSWORD || '',
  ssl:      process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

const SEED_JOKES = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "Why do cows wear bells? Because their horns don't work.",
  "What do you call a fake noodle? An impasta.",
  "How do you organize a space party? You planet.",
  "Why can't you give Elsa a balloon? Because she'll let it go.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "What do you call cheese that isn't yours? Nacho cheese.",
  "Why did the scarecrow win an award? Because he was outstanding in his field.",
  "I would tell you a joke about construction, but I'm still working on it.",
];

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS jokes (
        id    SERIAL PRIMARY KEY,
        joke  TEXT NOT NULL
      )
    `);

    const { rows } = await client.query('SELECT COUNT(*) AS count FROM jokes');
    if (parseInt(rows[0].count, 10) === 0) {
      for (const joke of SEED_JOKES) {
        await client.query('INSERT INTO jokes (joke) VALUES ($1)', [joke]);
      }
      console.log(`Seeded ${SEED_JOKES.length} jokes into the database.`);
    }
  } finally {
    client.release();
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/joke', async (_req, res) => {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      'SELECT joke FROM jokes ORDER BY RANDOM() LIMIT 1'
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No jokes found' });
    }
    res.json({ joke: rows[0].joke });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
