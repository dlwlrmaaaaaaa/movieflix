import { SyncEngine } from '../src/sockets/utils/syncEngine';
import { generateRoomCode } from '../src/utils/roomCode';
import { generateToken, verifyToken } from '../src/utils/token';

describe('TogetherFlix Synchronization & Utilities Suite', () => {
  describe('Room Code Generator', () => {
    it('should generate 6-character clean room codes starting with TF-', () => {
      const code = generateRoomCode();
      expect(code).toMatch(/^TF-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    });

    it('should not contain confusing characters (0, O, 1, I)', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateRoomCode();
        expect(code).not.toMatch(/[0O1I]/);
      }
    });
  });

  describe('SyncEngine: Title Normalization', () => {
    it('should clean release tags, codecs, resolutions, and brackets', () => {
      const raw = 'Inception.2010.1080p.BluRay.x264-[YTS.MX].mp4';
      const clean = SyncEngine.cleanMovieTitle(raw);
      expect(clean).toBe('inception 2010');
    });

    it('should normalize webrips and dashes', () => {
      const raw = 'La.La.Land.2016.720p.WEBRip.x265-RARBG.mkv';
      const clean = SyncEngine.cleanMovieTitle(raw);
      expect(clean).toBe('la la land 2016');
    });
  });

  describe('SyncEngine: Compatibility Evaluation', () => {
    it('should identify PERFECT_MATCH when duration delta <= 1s', () => {
      const host = {
        userId: 'u1',
        displayName: 'Partner 1',
        fileName: 'Interstellar.2014.1080p.mp4',
        durationSeconds: 10140.2,
        isReady: false,
        pickedAt: new Date().toISOString(),
      };
      const guest = {
        userId: 'u2',
        displayName: 'Partner 2',
        fileName: 'Interstellar (2014) [YTS].mp4',
        durationSeconds: 10140.8,
        isReady: false,
        pickedAt: new Date().toISOString(),
      };

      const result = SyncEngine.evaluateCompatibility(host, guest);
      expect(result.grade).toBe('PERFECT_MATCH');
      expect(result.durationDiffSeconds).toBeLessThanOrEqual(1.0);
    });

    it('should trigger COMPATIBLE_WARNING when duration delta is between 1s and 6s', () => {
      const host = {
        userId: 'u1',
        displayName: 'Partner 1',
        fileName: 'Movie.mp4',
        durationSeconds: 7200,
        isReady: false,
        pickedAt: new Date().toISOString(),
      };
      const guest = {
        userId: 'u2',
        displayName: 'Partner 2',
        fileName: 'Movie.mp4',
        durationSeconds: 7204.5,
        isReady: false,
        pickedAt: new Date().toISOString(),
      };

      const result = SyncEngine.evaluateCompatibility(host, guest);
      expect(result.grade).toBe('COMPATIBLE_WARNING');
    });

    it('should trigger MISMATCH_ALERT when duration delta > 6s', () => {
      const host = {
        userId: 'u1',
        displayName: 'Partner 1',
        fileName: 'Movie.Theatrical.mp4',
        durationSeconds: 7200,
        isReady: false,
        pickedAt: new Date().toISOString(),
      };
      const guest = {
        userId: 'u2',
        displayName: 'Partner 2',
        fileName: 'Movie.Extended.Cut.mp4',
        durationSeconds: 7800,
        isReady: false,
        pickedAt: new Date().toISOString(),
      };

      const result = SyncEngine.evaluateCompatibility(host, guest);
      expect(result.grade).toBe('MISMATCH_ALERT');
    });
  });

  describe('Authentication Tokens', () => {
    it('should sign and verify valid JWT tokens', () => {
      const token = generateToken({ userId: 'test-user-123', email: 'test@togetherflix.com' });
      expect(typeof token).toBe('string');

      const payload = verifyToken(token);
      expect(payload.userId).toBe('test-user-123');
      expect(payload.email).toBe('test@togetherflix.com');
    });
  });
});
