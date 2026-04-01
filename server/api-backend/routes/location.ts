import { Router } from 'express';
import { handleLocationUpdate } from '../services/location.js';
import { processLocationReport } from '../services/location_ping.js';
import {
  assertTargetUser,
  requireUserOrAgent,
  type AuthedRequest,
} from '../middleware/auth.js';

const router = Router();

router.post('/location', requireUserOrAgent, async (req: AuthedRequest, res) => {
  const { userId, latitude, longitude, lat, lng } = req.body as {
    userId?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };

  const latN = latitude ?? lat;
  const lngN = longitude ?? lng;

  if (!userId || latN === undefined || lngN === undefined) {
    return res
      .status(400)
      .json({ error: 'userId, latitude, and longitude are required (lat/lng accepted as aliases)' });
  }

  if (!assertTargetUser(req, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // WebSocket push for live UI feedback
    await handleLocationUpdate(userId, latN, lngN);

    // Queue iMessage notification via Photon notify-poll pipeline (fire-and-forget)
    processLocationReport(userId, latN, lngN).catch((e) =>
      console.warn('location_ping non-fatal:', e?.message ?? e),
    );

    res.status(200).json({ message: 'Location updated' });
  } catch (error) {
    console.error('Error handling location update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
