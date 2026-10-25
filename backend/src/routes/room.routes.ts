import { Router } from 'express';
import { RoomController } from '../controllers/room.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roomRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', roomRateLimiter, RoomController.createRoom);
router.post('/join', RoomController.joinRoom);
router.get('/:code', RoomController.getRoom);
router.patch('/:code/control', RoomController.setControlMode);
router.post('/:code/close', RoomController.closeRoom);

export default router;
