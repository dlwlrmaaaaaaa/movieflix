import { Router } from 'express';
import { validatedRoomCode } from '../utils/roomCode';
import { RoomController } from '../controllers/room.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roomRateLimiter } from '../middlewares/rateLimiter.middleware';
import { MediaController } from '../controllers/media.controller';
import multer from 'multer';
import path from 'path';

const mediaDir = path.join(process.cwd(), 'uploads');
const upload = multer({ dest: mediaDir, limits: { fileSize: 5 * 1024 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('video/')) });

const router = Router();

router.use(authMiddleware);
router.param('code', (req, res, next, value) => {
  try { req.params.code = validatedRoomCode(value); next(); }
  catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Invalid room code.' }); }
});

router.post('/', roomRateLimiter, RoomController.createRoom);
router.post('/join', RoomController.joinRoom);
router.post('/:code/movie', upload.single('movie'), MediaController.upload);
router.get('/:code/movie', MediaController.stream);
router.post('/:code/start', RoomController.startMovie);
router.post('/:code/direct', RoomController.prepareDirect);
router.post('/:code/guest/remove', RoomController.removeGuest);
router.get('/:code/messages', RoomController.messages);
router.get('/:code/embed', RoomController.embed);
router.post('/:code/leave', RoomController.leave);
router.get('/:code', RoomController.getRoom);
router.patch('/:code/control', RoomController.setControlMode);
router.post('/:code/close', RoomController.closeRoom);
router.post('/:code/movie/select', RoomController.selectMovie);

export default router;
