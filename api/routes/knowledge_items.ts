import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/knowledge_items/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ status: 'success', data });
});

export default router;
