/** Bearer `RECALL_AGENT_SECRET` for Express routes (must match server .env / Vercel). */
export function recallAgentHeaders(extra?: Record<string, string>): Record<string, string> {
  const secret = process.env.RECALL_AGENT_SECRET?.trim();
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra ?? {}),
  };
  if (secret) {
    h.Authorization = `Bearer ${secret}`;
  }
  return h;
}
