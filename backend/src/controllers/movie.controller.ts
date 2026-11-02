import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { MovieService } from '../services/movie.service';

export class MovieController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, movies: await MovieService.list(req.user!.role, req.user!.id) }); } catch (error) { next(error); }
  }

  static async initiate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { title, originalFilename, mimeType, fileSize } = req.body;
      if (typeof originalFilename !== 'string' || typeof mimeType !== 'string') { res.status(400).json({ success: false, message: 'Movie filename and MIME type are required.' }); return; }
      const upload = await MovieService.initiate(req.user!.id, { title: typeof title === 'string' ? title : '', originalFilename, mimeType, fileSize: Number(fileSize) });
      res.status(201).json({ success: true, ...upload });
    } catch (error) { next(error); }
  }

  static async createStream(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { title, description, posterUrl, streamingUrl, streamingFormat } = req.body;
      if (typeof title !== 'string' || typeof streamingUrl !== 'string') { res.status(400).json({ success: false, message: 'Movie title and streaming URL are required.' }); return; }
      const movie = await MovieService.createStream(req.user!.id, {
        title,
        description: typeof description === 'string' ? description : null,
        posterUrl: typeof posterUrl === 'string' ? posterUrl : null,
        streamingUrl,
        streamingFormat,
      });
      res.status(201).json({ success: true, movie });
    } catch (error) { next(error); }
  }

  static async importMpd(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { title, description, posterUrl, originalFilename, manifestXml, manifestBaseUrl } = req.body;
      if (typeof title !== 'string' || typeof originalFilename !== 'string' || typeof manifestXml !== 'string') { res.status(400).json({ success: false, message: 'Movie title, MPD filename, and manifest contents are required.' }); return; }
      const movie = await MovieService.importMpd(req.user!.id, {
        title,
        description: typeof description === 'string' ? description : null,
        posterUrl: typeof posterUrl === 'string' ? posterUrl : null,
        originalFilename,
        manifestXml,
        manifestBaseUrl: typeof manifestBaseUrl === 'string' ? manifestBaseUrl : null,
      });
      res.status(201).json({ success: true, movie });
    } catch (error) { next(error); }
  }

  static async signPart(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, ...(await MovieService.uploadPart(req.user!.id, req.params.id, Number(req.body.partNumber))) }); } catch (error) { next(error); }
  }

  static async complete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, movie: await MovieService.complete(req.user!.id, req.params.id, req.body.parts) }); } catch (error) { next(error); }
  }

  static async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { await MovieService.abort(req.user!.id, req.params.id); res.json({ success: true }); } catch (error) { next(error); }
  }

  static async playback(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, ...(await MovieService.playback(req.user!.id, req.params.id)) }); } catch (error) { next(error); }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json({ success: true, movie: await MovieService.update(req.params.id, req.body) }); } catch (error) { next(error); }
  }
}
