// Runner untuk VPS / lokal / Docker. (Di Vercel, api/index.js yang dipakai.)
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import app from './app.js';

const DIST = fileURLToPath(new URL('../client/dist', import.meta.url));
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(DIST + '/index.html'); });
}
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Restoku jalan di http://localhost:${PORT}`));
