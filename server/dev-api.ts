/**
 * Local API only — HTTP + WebSocket upgrade. Not deployed to Vercel (use api/index.ts there).
 */
import app from './api-backend/internal/app.js';
import { attachWebSocketServer } from './api-backend/services/location.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

attachWebSocketServer(server);

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
