import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const error = err as Error;
  console.error('[AnnahFlix Error]:', error.message || error);

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error occurred.' : (error.message || 'Unknown server error'),
  });
}
