import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { extractContent, extractContentFromImage } from '../services/llm.js';
import { createNotionPage } from '../services/notion.js';

const router = Router();

function normalizeImageBase64(raw: string): string {
  const m = /^data:image\/[\w+.-]+;base64,(.+)$/i.exec(raw.trim());
  return m ? m[1] : raw.trim();
}

router.post('/message', async (req, res) => {
  const {
    userId,
    type,
    content = '',
    source_type = 'text',
    image_base64,
    mime_type,
    chat_label,
    ingest_note,
  } = req.body;

  const caption = typeof content === 'string' ? content : '';
  const chatLabel = typeof chat_label === 'string' ? chat_label.trim() : '';
  const ingestNote = typeof ingest_note === 'string' ? ingest_note.trim() : '';
  const hasImage =
    typeof image_base64 === 'string' &&
    image_base64.length > 0 &&
    typeof mime_type === 'string' &&
    /^image\/(png|jpe?g|gif|webp)$/i.test(mime_type.trim());

  if (!userId || !type || (!hasImage && !caption.trim())) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const imessagePrefix =
    !hasImage && chatLabel ? `[iMessage · ${chatLabel}]\n\n` : '';
  const storedOriginal = hasImage
    ? `[Screenshot] ${caption.trim() || '(image only)'}`.slice(0, 8000)
    : `${imessagePrefix}${caption.trim()}`.slice(0, 8000);

  const preambleParts: string[] = [];
  if (chatLabel) preambleParts.push(`Chat display name (from client): ${chatLabel}`);
  if (ingestNote) preambleParts.push(ingestNote);
  const userPreamble = preambleParts.length > 0 ? preambleParts.join('\n') : undefined;

  // 1. Insert initial item with placeholder summary
  const { data: insertData, error: insertError } = await supabase
    .from('knowledge_items')
    .insert({
      user_id: userId,
      original_content_url: storedOriginal,
      summary: 'Summarizing...',
      source_type,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error inserting item:', insertError);
    return res.status(500).json({ error: insertError.message });
  }

  // 2. Extract structured content via MiniMax (Vision when image provided)
  const extraction = hasImage
    ? await extractContentFromImage({
        imageBase64: normalizeImageBase64(image_base64),
        mimeType: mime_type.trim(),
        caption: caption.trim() || undefined,
      })
    : await extractContent(caption.trim(), userPreamble ? { userPreamble } : undefined);
  if (!extraction) {
    await supabase
      .from('knowledge_items')
      .update({ summary: 'Failed to extract content.' })
      .eq('id', insertData.id);
    return res.status(500).json({ error: 'Failed to extract content' });
  }

  // 3. Update item with all structured fields
  let { data: extractedData, error: extractError } = await supabase
    .from('knowledge_items')
    .update({
      summary: extraction.summary,
      category: extraction.category,
      location_city: extraction.location.city,
      location_name: extraction.location.specific_name,
      action_items: extraction.action_items,
      source_context: extraction.source_context,
      persona: extraction.persona ?? null,
      recall_enrichment: extraction.recall_enrichment ?? null,
    })
    .eq('id', insertData.id)
    .select()
    .single();

  if (extractError) {
    console.error('Error updating extraction:', extractError);
    return res.status(500).json({ error: extractError.message });
  }

  // 4. Get user's Notion credentials
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('notion_token, notion_database_id')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return res.json({ status: 'success', message: 'Message extracted, Notion not configured', data: extractedData });
  }

  // 5. Create Notion page if configured
  if (user.notion_token && user.notion_database_id) {
    const notionPageId = await createNotionPage(
      user.notion_token,
      user.notion_database_id,
      storedOriginal,
      extraction.summary,
    );

    if (notionPageId) {
      const { data: finalData, error: notionUpdateError } = await supabase
        .from('knowledge_items')
        .update({ notion_page_id: notionPageId })
        .eq('id', extractedData.id)
        .select()
        .single();

      if (notionUpdateError) {
        return res.json({ status: 'success', message: 'Extracted, but failed to link Notion page', data: extractedData });
      }
      return res.json({ status: 'success', message: 'Extracted and saved to Notion', data: finalData });
    }
  }

  res.json({ status: 'success', message: 'Message extracted, Notion not configured', data: extractedData });
});

export default router;
