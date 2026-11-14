import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const distDir = path.resolve(__dirname, 'dist');

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Health endpoint for Docker, Kubernetes, Railway, Render, and load balancers
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'wendoro-erp',
    runtime: 'node-express',
    timestamp: new Date().toISOString(),
  });
});

// Serve static Vite build output
app.use(express.static(distDir, { index: false }));

// SPA fallback for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`WENDORO ERP server listening on http://0.0.0.0:${port}`);
});
