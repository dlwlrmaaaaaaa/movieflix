import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { movieDiscoveryRateLimiter } from '../middlewares/rateLimiter.middleware';
import { TmdbService, UpstreamServiceError } from '../services/tmdb.service';
import type { SearchCategory } from '@togetherflix/shared';

const router = Router();
router.get('/', authMiddleware, movieDiscoveryRateLimiter, async (req, res, next) => {
  try {
    const value = (key: string) => typeof req.query[key] === 'string' ? req.query[key] as string : undefined;
    res.json(await TmdbService.searchContent(value('query') || '', req.query.page, { category: value('category') as SearchCategory | undefined, year: value('year'), country: value('country'), genre: value('genre') }));
  } catch (error) {
    if (error instanceof UpstreamServiceError) {
      if (error.retryAfterSeconds) res.setHeader('Retry-After', error.retryAfterSeconds);
      res.status(error.statusCode).json({ message: error.message });
    } else next(error);
  }
});
export default router;
