import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/register', authRateLimiter, AuthController.register);
router.post('/login', authRateLimiter, AuthController.login);
router.get('/me', authMiddleware, AuthController.getMe);

// Partner invitations
router.post('/partner/invite', authMiddleware, AuthController.createPartnerInvite);
router.post('/partner/accept', authMiddleware, AuthController.acceptPartnerInvite);
router.post('/partner/unlink', authMiddleware, AuthController.unlinkPartner);

export default router;
