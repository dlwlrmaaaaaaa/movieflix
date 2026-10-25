import { Router } from 'express';
import { CallController } from '../controllers/call.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/:roomCode/token', CallController.getCallToken);

export default router;
