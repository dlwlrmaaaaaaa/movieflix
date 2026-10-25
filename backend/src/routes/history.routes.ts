import { Router } from 'express';
import { HistoryController } from '../controllers/history.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', HistoryController.getHistories);
router.post('/', HistoryController.recordMovieNight);

export default router;
