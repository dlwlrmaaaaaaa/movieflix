import { Router } from 'express';
import { UserLibraryController } from '../controllers/userLibrary.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { movieDiscoveryRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/watchlist', UserLibraryController.watchlist);
router.post('/watchlist', movieDiscoveryRateLimiter, UserLibraryController.addWatchlist);
router.delete('/watchlist/:movieId', UserLibraryController.removeWatchlist);
router.get('/continue-watching', UserLibraryController.continueWatching);
router.put('/continue-watching/:movieId', movieDiscoveryRateLimiter, UserLibraryController.saveProgress);
export default router;
