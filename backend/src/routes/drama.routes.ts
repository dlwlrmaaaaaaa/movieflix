import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { movieDiscoveryRateLimiter, roomRateLimiter } from '../middlewares/rateLimiter.middleware';
import { TmdbService, UpstreamServiceError } from '../services/tmdb.service';
import { DramaService, episodeSummary } from '../services/drama.service';
import { RoomService } from '../services/room.service';
import { validatedRoomCode } from '../utils/roomCode';
import type { DramaCategory } from '@togetherflix/shared';

const router = Router();
const handle = (work: (req: AuthenticatedRequest, res: Response) => Promise<void>) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await work(req, res); } catch (error) {
    if (error instanceof UpstreamServiceError) {
      if (error.retryAfterSeconds) res.setHeader('Retry-After', error.retryAfterSeconds);
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else if (error instanceof Error && !('code' in error)) res.status(400).json({ success: false, message: error.message });
    else next(error);
  }
};
router.use(authMiddleware);
router.get('/', movieDiscoveryRateLimiter, handle(async (req, res) => {
  const value = (key: string) => typeof req.query[key] === 'string' ? req.query[key] as string : undefined;
  res.json({ success: true, ...await TmdbService.dramas((value('category') || 'tv') as DramaCategory, req.query.page, req.query.trending === 'true', { query: value('query'), year: value('year'), country: value('country'), genre: value('genre') }) });
}));
router.get('/continue', handle(async (req, res) => { res.json({ items: await DramaService.continueWatching(req.user!.id) }); }));
router.get('/recent', handle(async (_req, res) => { res.json({ items: await DramaService.recent() }); }));
router.get('/episodes/:id/playback', handle(async (req, res) => { res.json(await DramaService.playback(req.user!.id, req.params.id, req.query.subtitles !== 'false')); }));
router.post('/episodes/:id/progress-session', handle(async (req, res) => {
  const progress = await DramaService.beginProgress(req.user!.id, req.params.id);
  res.json({ sessionId: progress.sessionId, positionSeconds: progress.completed ? 0 : progress.positionSeconds });
}));
router.put('/episodes/:id/progress', handle(async (req, res) => { res.json({ accepted: (await DramaService.saveProgress(req.user!.id, req.params.id, req.body)).count === 1 }); }));
router.get('/episodes/:id/next', handle(async (req, res) => {
  const episode = await DramaService.next(req.params.id); res.json({ episode: episode ? episodeSummary(episode) : null });
}));
router.get('/episodes/:id/subtitles', handle(async (req, res) => { res.json({ subtitles: await DramaService.subtitles(req.params.id, req.query.cues === 'true') }); }));
router.post('/episodes/:id/subtitles', requireAdmin, handle(async (req, res) => {
  await DramaService.addSubtitle(req.params.id, req.body); res.json({ success: true });
}));
router.put('/episodes/:id/source', requireAdmin, handle(async (req, res) => {
  if (typeof req.body.movieId !== 'string') throw new UpstreamServiceError('Choose a validated library source.', 400);
  await DramaService.attachSource(req.user!.id, req.params.id, req.body.movieId); res.json({ success: true });
}));
router.post('/episodes/:id/party', roomRateLimiter, handle(async (req, res) => { res.status(201).json({ room: await DramaService.createParty(req.user!.id, req.params.id) }); }));
router.post('/rooms/:code/episode', roomRateLimiter, handle(async (req, res) => {
  const code = validatedRoomCode(req.params.code);
  if (typeof req.body.episodeId !== 'string') throw new UpstreamServiceError('Select an episode.', 400);
  const room = await DramaService.selectParty(code, req.user!.id, req.body.episodeId, req.body.expected, req.body.ended === true);
  await req.app.get('roomGateway')?.publishPlaybackSelection(code);
  res.json({ room });
}));
router.get('/rooms/:code/next', handle(async (req, res) => {
  const room = await RoomService.getRoomByCode(validatedRoomCode(req.params.code));
  if (!room || room.status === 'ENDED' || ![room.hostId, room.guestId].includes(req.user!.id)) throw new UpstreamServiceError('Join this room first.', 403);
  const id = room.catalogSelection?.episodeId;
  const next = id ? await DramaService.next(id) : null;
  res.json({ episode: next ? episodeSummary(next) : null });
}));
router.post('/:tmdbId/seasons/:season/import', requireAdmin, handle(async (req, res) => { await DramaService.importSeason(req.params.tmdbId, req.params.season); res.json({ success: true }); }));
router.get('/:tmdbId/seasons/:season', movieDiscoveryRateLimiter, handle(async (req, res) => { res.json({ episodes: await DramaService.season(req.params.tmdbId, req.params.season, req.user!.id) }); }));
router.get('/:tmdbId', movieDiscoveryRateLimiter, handle(async (req, res) => { res.json({ drama: await TmdbService.dramaDetails(req.params.tmdbId) }); }));
export default router;
