import { CompatibilityReport, CompatibilityGrade, MovieMetadata } from '@togetherflix/shared';

export class SyncEngine {
  /**
   * Normalizes video filename by stripping tags, codecs, resolutions, and extensions.
   * e.g., "Inception.2010.1080p.BluRay.x264-YIFY.mp4" -> "inception 2010"
   */
  static cleanMovieTitle(filename: string): string {
    let name = filename.replace(/\.[^/.]+$/, ''); // remove extension
    name = name.toLowerCase();

    // Remove brackets and parenthetical tags
    name = name.replace(/\[.*?\]|\(.*?\)/g, ' ');

    // Remove common media tags
    const tagsToRemove = [
      '1080p', '720p', '2160p', '4k', 'uhd', 'hdrip', 'bluray', 'bdrip', 'brrip',
      'web-dl', 'webrip', 'web', 'hdtv', 'dvdrip', 'x264', 'x265', 'h264', 'h265',
      'hevc', 'aac', 'ac3', 'dts', 'yify', 'yts', 'rarbg', 'eztv', 'extended', 'remastered',
    ];

    for (const tag of tagsToRemove) {
      name = name.replace(new RegExp(`\\b${tag}\\b`, 'gi'), ' ');
    }

    // Replace dots, underscores, dashes with space
    name = name.replace(/[._\-+]/g, ' ');
    // Clean redundant spaces
    name = name.replace(/\s+/g, ' ').trim();

    return name || filename;
  }

  /**
   * Evaluates compatibility between two local movie files based on duration and title.
   */
  static evaluateCompatibility(hostMeta: MovieMetadata, guestMeta: MovieMetadata): CompatibilityReport {
    const durationDiff = Math.abs(hostMeta.durationSeconds - guestMeta.durationSeconds);
    const cleanHost = this.cleanMovieTitle(hostMeta.fileName);
    const cleanGuest = this.cleanMovieTitle(guestMeta.fileName);

    let grade: CompatibilityGrade;
    let message: string;

    if (durationDiff <= 1.0) {
      grade = 'PERFECT_MATCH';
      message = 'Exact match! Both files have identical duration. Sync will be seamless. 💕';
    } else if (durationDiff <= 6.0) {
      grade = 'COMPATIBLE_WARNING';
      message = `Movie lengths differ by ${durationDiff.toFixed(1)}s (likely studio intro/bumper variation). Playback will sync with slight offset.`;
    } else {
      grade = 'MISMATCH_ALERT';
      message = `Warning: Durations differ by ${Math.round(durationDiff)}s. You might have different cuts (Theatrical vs Extended) or different files.`;
    }

    return {
      grade,
      durationDiffSeconds: parseFloat(durationDiff.toFixed(2)),
      message,
      details: {
        hostDuration: hostMeta.durationSeconds,
        guestDuration: guestMeta.durationSeconds,
        cleanHostTitle: cleanHost,
        cleanGuestTitle: cleanGuest,
      },
    };
  }
}
