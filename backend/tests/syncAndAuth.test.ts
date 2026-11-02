import { SyncEngine } from '../src/sockets/utils/syncEngine';
import { generateRoomCode } from '../src/utils/roomCode';
import { generateToken, verifyToken } from '../src/utils/token';
import { canHostControl, lateJoinPlayback, canStartSynchronizedPlayback, expectedPlaybackPosition } from '../src/sockets/utils/roomPolicy';
import { detectStreamFormat, parsePublicStreamUrl } from '../src/services/streamValidation';
import { validateImportedMpd } from '../src/services/mpdImport.service';
import { isRecognizedLicenseUrl, normalizeMovieTitle } from '../src/providers/InternetArchiveProvider';

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

  describe('Host-owned room playback', () => {
    it('allows only the host to select media and control playback', () => {
      expect(canHostControl('host-1', 'host-1')).toBe(true);
      expect(canHostControl('host-1', 'guest-1')).toBe(false);
    });

    it('provides canonical state for a late-joining guest', () => {
      expect(lateJoinPlayback(128.5, true)).toMatchObject({ action: 'PLAY', position: 128.5, isPlaying: true });
      expect(lateJoinPlayback(-5, false)).toMatchObject({ action: 'PAUSE', position: 0, isPlaying: false });
    });

    it('requires both viewers to be ready for the selected cloud movie', () => {
      const states = [
        { userId: 'host-1', selectedMovieId: 'movie-1', state: 'READY' },
        { userId: 'guest-1', selectedMovieId: 'movie-1', state: 'READY' },
      ];
      expect(canStartSynchronizedPlayback(['host-1', 'guest-1'], states, 'movie-1')).toBe(true);
      expect(canStartSynchronizedPlayback(['host-1', 'guest-1'], [{ ...states[1], state: 'BUFFERING' }, states[0]], 'movie-1')).toBe(false);
      expect(canStartSynchronizedPlayback(['host-1', 'guest-1'], states, 'movie-2')).toBe(false);
    });

    it('advances the canonical late-join position only while playing', () => {
      expect(expectedPlaybackPosition(10, true, 1_000, 3_500)).toBe(12.5);
      expect(expectedPlaybackPosition(10, false, 1_000, 3_500)).toBe(10);
      // A future scheduled anchor has not started yet, so it must not advance.
      expect(expectedPlaybackPosition(10, true, 5_000, 3_500)).toBe(10);
    });
  });

  describe('Remote streaming source policy', () => {
    it('detects DASH, HLS, MP4, and WebM URLs without fetching media', () => {
      expect(detectStreamFormat(parsePublicStreamUrl('https://cdn.example.com/movie.mpd'))).toBe('DASH');
      expect(detectStreamFormat(parsePublicStreamUrl('https://cdn.example.com/movie.m3u8'))).toBe('HLS');
      expect(detectStreamFormat(parsePublicStreamUrl('https://cdn.example.com/movie.mp4'))).toBe('MP4');
      expect(detectStreamFormat(parsePublicStreamUrl('https://cdn.example.com/movie.webm'))).toBe('WEBM');
    });

    it('rejects insecure and private streaming URLs before any server fetch', () => {
      expect(() => parsePublicStreamUrl('http://example.com/movie.mpd')).toThrow('HTTPS');
      expect(() => parsePublicStreamUrl('https://127.0.0.1/movie.mpd')).toThrow('public host');
      expect(() => parsePublicStreamUrl('https://localhost/movie.mpd')).toThrow('public host');
    });
  });

  describe('Internet Archive licensing policy', () => {
    it('requires exact normalized title matching and a recognized license URL', () => {
      expect(normalizeMovieTitle('Night of the Living Dead!')).toBe(normalizeMovieTitle('Night-of-the-Living-Dead'));
      expect(isRecognizedLicenseUrl('https://creativecommons.org/publicdomain/mark/1.0/')).toBe(true);
      expect(isRecognizedLicenseUrl('https://example.com/public-domain')).toBe(false);
      expect(isRecognizedLicenseUrl('')).toBe(false);
    });
  });

  describe('Local MPD manifest import', () => {
    const minimalMpd = `<?xml version="1.0"?><MPD type="static"><Period><AdaptationSet contentType="video"><Representation id="v1" bandwidth="1000"><SegmentTemplate timescale="1" /></Representation></AdaptationSet><AdaptationSet contentType="audio"><Representation id="a1" bandwidth="128" /></AdaptationSet></Period></MPD>`;

    it('accepts a safe DASH manifest and identifies audio/video representations', async () => {
      const imported = await validateImportedMpd(minimalMpd);
      expect(imported.videoRepresentations).toBe(1);
      expect(imported.audioRepresentations).toBe(1);
    });

    it('rejects XML external entities and relative media without an authorized base', async () => {
      await expect(validateImportedMpd(minimalMpd.replace('<MPD', '<!DOCTYPE MPD [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><MPD'))).rejects.toThrow('external XML');
      await expect(validateImportedMpd(minimalMpd.replace('timescale="1"', 'timescale="1" media="segment-$Number$.m4s"'))).rejects.toThrow('original authorized manifest base URL');
    });
  });
});
