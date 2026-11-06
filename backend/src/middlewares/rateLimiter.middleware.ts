import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per window
  message: { success: false, message: 'Too many login/registration attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const roomRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // limit room creation
  message: { success: false, message: 'Too many room requests. Please wait a few moments.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const movieDiscoveryRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  message: { success: false, message: 'Too many movie discovery requests. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Separate budget: player diagnostics must not consume movie discovery quota.
export const playerDiagnosticsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Player diagnostics rate limit reached.' },
});
