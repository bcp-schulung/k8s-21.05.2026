'use strict';

const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', async (_req, res) => {
  let joke = 'Could not load a joke right now. Try again later.';
  let isError = false;

  try {
    const response = await fetch(`${BACKEND_URL}/joke`);
    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }
    const data = await response.json();
    joke = data.joke;
  } catch (err) {
    console.error('Failed to fetch joke from backend:', err.message);
    isError = true;
  }

  const escapedJoke = joke
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Random Joke</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f0f4f8;
      color: #333;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 2.5rem 3rem;
      max-width: 560px;
      width: 90%;
      text-align: center;
    }
    h1 { font-size: 1.6rem; margin-bottom: 1.5rem; color: #2d3a4a; }
    p {
      font-size: 1.15rem;
      line-height: 1.6;
      margin-bottom: 2rem;
      color: ${isError ? '#c0392b' : '#444'};
    }
    button {
      background: #4a90e2;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 0.7rem 1.8rem;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #357abd; }
  </style>
</head>
<body>
  <div class="card">
    <h1>&#128516; Random Joke</h1>
    <p>${escapedJoke}</p>
    <form method="GET" action="/">
      <button type="submit">Another one!</button>
    </form>
  </div>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Frontend listening on port ${PORT}`);
  console.log(`Using backend at ${BACKEND_URL}`);
});
