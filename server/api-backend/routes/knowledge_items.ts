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

router.patch('/knowledge_items/:id', async (req, res) => {
  const { id } = req.params;
  const { summary, category, location_city, location_name } = req.body as {
    summary?: string;
    category?: string | null;
    location_city?: string | null;
    location_name?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (summary !== undefined) updates.summary = summary;
  if (category !== undefined) updates.category = category;
  if (location_city !== undefined) updates.location_city = location_city;
  if (location_name !== undefined) updates.location_name = location_name;

  const { data, error } = await supabase
    .from('knowledge_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ status: 'success', data });
});

router.delete('/knowledge_items/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('knowledge_items')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
});

export default router;
