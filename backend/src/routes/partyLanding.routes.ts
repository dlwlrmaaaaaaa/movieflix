import { Router } from 'express';
import { RoomService } from '../services/room.service';

const router = Router();
router.get('/:code', async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    if (!/^TF-[2-9A-HJ-NP-Z]{4}$/.test(code)) { res.status(404).send('Watch party not found.'); return; }
    const room = await RoomService.getRoomByCode(code);
    if (!room || room.status === 'ENDED') { res.status(404).send('This watch party is unavailable or has ended.'); return; }
    const webOrigin = process.env.PUBLIC_WEB_URL?.trim().replace(/\/$/, '');
    if (webOrigin) {
      const target = new URL(`/party/${encodeURIComponent(code)}`, webOrigin);
      if (target.protocol === 'https:' || target.protocol === 'http:') { res.redirect(302, target.toString()); return; }
    }
    const deepLink = `togetherflix://party/${encodeURIComponent(code)}`;
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Join ${code} · AnnahFlix</title><style>body{margin:0;background:#0b0b0f;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh}.card{max-width:420px;text-align:center;padding:36px;background:#18181f;border-radius:20px}a{display:inline-block;margin-top:18px;padding:14px 22px;border-radius:999px;background:#e50914;color:#fff;text-decoration:none;font-weight:700}.code{letter-spacing:4px;font-size:28px}</style></head><body><main class="card"><h1>You're invited</h1><p>Join a AnnahFlix watch party.</p><strong class="code">${code}</strong><br><a href="${deepLink}">Open AnnahFlix</a><p>If the app doesn't open, install it and enter room code ${code}.</p></main></body></html>`);
  } catch (error) { next(error); }
});
export default router;
