/**
 * Vercel serverless entry — Express `app` is compatible with Node req/res.
 * Types use `express` only so we do not need the `@vercel/node` package (smaller install, fewer audit deps).
 */
import type { Request, Response } from 'express';
import app from './app.js';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}