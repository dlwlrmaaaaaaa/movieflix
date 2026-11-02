import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { prisma } from '../prisma';

export const authSessionEvents = new EventEmitter();

/** Existing tokens survive migration only until the account next signs in. */
export function isCurrentSession(sessionId: string | undefined, activeSessionId: string | null | undefined): boolean {
  return activeSessionId ? sessionId === activeSessionId : !sessionId;
}

export async function startAuthSession(userId: string): Promise<string> {
  const sessionId = randomUUID();
  await prisma.user.update({ where: { id: userId }, data: { activeSessionId: sessionId } });
  authSessionEvents.emit('replaced', { userId, sessionId });
  return sessionId;
}

export async function endAuthSession(userId: string, sessionId?: string): Promise<void> {
  const revokedId = randomUUID();
  const result = await prisma.user.updateMany({ where: { id: userId, activeSessionId: sessionId ?? null }, data: { activeSessionId: revokedId } });
  if (result.count) authSessionEvents.emit('replaced', { userId, sessionId: revokedId });
}
