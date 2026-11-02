/**
 * Generates a clean, readable 6-character room code (e.g., "LOVE24", "COZY99", "TF-882")
 * Omits ambiguous characters (0, O, 1, I) to ensure ease of typing on phones.
 */
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let result = 'TF-';
  for (let i = 0; i < 4; i++) {
    result += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return result;
}

export function generateInviteCode(): string {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return result;
}

export function validatedRoomCode(value: unknown): string {
  if (typeof value !== 'string') throw new Error('A valid room code is required.');
  const code = value.trim().toUpperCase();
  if (!/^TF-[2-9A-HJ-NP-Z]{4}$/.test(code)) throw new Error('Invalid room code. Expected TF- followed by four letters or digits.');
  return code;
}
