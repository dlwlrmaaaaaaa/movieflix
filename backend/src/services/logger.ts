import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function safeLogMessage(value: unknown): string {
  const text = value instanceof Error ? value.message : typeof value === 'string' ? value : 'Unknown error';
  return text.replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => { try { return new URL(raw).origin; } catch { return '[url]'; } })
    .replace(/\b(authorization|cookie|token|api[_-]?key|password|secret|signature)\s*[:=]\s*(?:Bearer\s+)?[^\s;,]+/gi, '$1=[redacted]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 400);
}
type LogFields = Record<string, string | number | boolean | null | undefined | string[]>;
function write(level: 'info' | 'warn' | 'error', event: string, fields: LogFields) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
}
export const logger = {
  info: (event: string, fields: LogFields = {}) => write('info', event, fields),
  warn: (event: string, fields: LogFields = {}) => write('warn', event, fields),
  error: (event: string, fields: LogFields = {}) => write('error', event, fields),
};
/** Log metadata only: never request bodies, query strings, headers, or credentials. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now(); const requestId = randomUUID();
  res.locals.requestId = requestId; res.setHeader('X-Request-ID', requestId);
  const path = req.path.replace(/[^a-zA-Z0-9_./:-]/g, '_').replace(/\/(rooms|party)\/TF-[A-Z2-9]{4}(?=\/|$)/g, '/$1/[room]').slice(0, 180);
  res.once('finish', () => {
    const fields = { requestId, method: req.method, path, status: res.statusCode, durationMs: Date.now() - started };
    if (res.statusCode >= 500) logger.error('http.request', fields); else if (res.statusCode >= 400) logger.warn('http.request', fields); else logger.info('http.request', fields);
  });
  next();
}
