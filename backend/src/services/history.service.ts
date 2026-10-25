import { prisma } from '../prisma';
import { MovieNightHistoryItem } from '@togetherflix/shared';

export class HistoryService {
  static async recordMovieNight(data: {
    roomId: string;
    userId: string;
    partnerName: string;
    movieTitle: string;
    durationMinutes: number;
    notes?: string;
  }): Promise<MovieNightHistoryItem> {
    const history = await prisma.movieHistory.upsert({
      where: { roomId: data.roomId },
      update: {
        movieTitle: data.movieTitle,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
        watchedAt: new Date(),
      },
      create: {
        roomId: data.roomId,
        userId: data.userId,
        partnerName: data.partnerName,
        movieTitle: data.movieTitle,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
      },
    });

    return {
      id: history.id,
      roomId: history.roomId,
      movieTitle: history.movieTitle,
      partnerName: history.partnerName,
      durationMinutes: history.durationMinutes,
      watchedAt: history.watchedAt.toISOString(),
      notes: history.notes,
    };
  }

  static async getHistory(userId: string): Promise<MovieNightHistoryItem[]> {
    const histories = await prisma.movieHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      take: 50,
    });

    return histories.map((h) => ({
      id: h.id,
      roomId: h.roomId,
      movieTitle: h.movieTitle,
      partnerName: h.partnerName,
      durationMinutes: h.durationMinutes,
      watchedAt: h.watchedAt.toISOString(),
      notes: h.notes,
    }));
  }
}
