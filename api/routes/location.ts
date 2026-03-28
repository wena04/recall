import { Router } from 'express';
import { handleLocationUpdate } from '../services/location';

const router = Router();

router.post('/location', async (req, res) => {
  const { userId, latitude, longitude } = req.body;

  if (!userId || !latitude || !longitude) {
    return res.status(400).json({ error: 'userId, latitude, and longitude are required' });
  }

  try {
    await handleLocationUpdate(userId, latitude, longitude);
    res.status(200).json({ message: 'Location updated' });
  } catch (error) {
    console.error('Error handling location update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
