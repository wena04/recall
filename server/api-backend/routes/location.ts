import { Router } from 'express';
import { handleLocationUpdate } from '../services/location.js';
import { processLocationReport } from '../services/location_ping.js';

const router = Router();

router.post('/location', async (req, res) => {
  const { userId, latitude, longitude } = req.body;

  if (!userId || !latitude || !longitude) {
    return res.status(400).json({ error: 'userId, latitude, and longitude are required' });
  }

  try {
    // WebSocket push for live UI feedback
    await handleLocationUpdate(userId, latitude, longitude);

    // Queue iMessage notification via Photon notify-poll pipeline (fire-and-forget)
    processLocationReport(userId, latitude, longitude).catch((e) =>
      console.warn('location_ping non-fatal:', e?.message ?? e),
    );

    res.status(200).json({ message: 'Location updated' });
  } catch (error) {
    console.error('Error handling location update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
