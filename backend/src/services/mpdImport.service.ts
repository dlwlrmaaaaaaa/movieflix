import { parsePublicStreamUrl, validateRemoteStream } from './streamValidation';

const MAX_MANIFEST_BYTES = 1024 * 1024;

export interface ImportedMpd {
  normalizedXml: string;
  videoRepresentations: number;
  audioRepresentations: number;
  manifestBaseUrl: string | null;
}

function textValues(xml: string, tag: string): string[] {
  const values: string[] = [];
  const expression = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = expression.exec(xml))) values.push(match[1].trim());
  return values;
}

function attributes(xml: string, name: string): string[] {
  const values: string[] = [];
  const expression = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = expression.exec(xml))) values.push(match[2].trim());
  return values;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isRelativeReference(value: string): boolean {
  return Boolean(value) && !isAbsoluteHttpUrl(value) && !value.startsWith('/') && !value.startsWith('urn:') && !value.startsWith('data:');
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function normalizedBaseUrl(rawUrl: string): string {
  const url = parsePublicStreamUrl(rawUrl);
  // A supplied original MPD URL resolves its segments from its directory. A
  // directory URL is kept as-is. Query credentials are never copied onto URLs.
  if (/\.mpd$/i.test(url.pathname)) return new URL('.', url).toString();
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
}

function countRepresentations(xml: string, kind: 'video' | 'audio'): number {
  const adaptationSets = xml.match(/<AdaptationSet\b[\s\S]*?<\/AdaptationSet>/gi) || [];
  return adaptationSets.reduce((count, set) => {
    const type = `${set.match(/\bcontentType\s*=\s*(["'])(.*?)\1/i)?.[2] || ''} ${set.match(/\bmimeType\s*=\s*(["'])(.*?)\1/i)?.[2] || ''}`.toLowerCase();
    return type.includes(kind) || set.toLowerCase().includes(`${kind}/`) ? count + (set.match(/<Representation\b/gi) || []).length : count;
  }, 0);
}

/**
 * Lightweight, non-expanding DASH validation. We deliberately do not use an
 * XML parser that could resolve external entities. The source is preserved
 * except for one optional root BaseURL used to make existing relative segment
 * references resolve to their authorized original host.
 */
export async function validateImportedMpd(xml: string, suppliedBaseUrl?: string | null): Promise<ImportedMpd> {
  const byteLength = Buffer.byteLength(xml || '', 'utf8');
  if (!xml || byteLength === 0 || byteLength > MAX_MANIFEST_BYTES) throw new Error('MPD manifest must be between 1 byte and 1 MB.');
  let normalizedXml = xml.replace(/^\uFEFF/, '').trim();
  if (/<!DOCTYPE|<!ENTITY|\bSYSTEM\b|\bPUBLIC\b/i.test(normalizedXml)) throw new Error('MPD manifest contains unsupported external XML declarations.');
  if (!/^<\?xml[\s\S]*?\?>\s*<MPD\b/i.test(normalizedXml) && !/^<MPD\b/i.test(normalizedXml)) throw new Error('Selected file is not an MPEG-DASH MPD manifest.');
  if (!/<\/MPD>\s*$/i.test(normalizedXml)) throw new Error('MPD manifest is incomplete.');
  if (!/<Period\b/i.test(normalizedXml) || !/<Representation\b/i.test(normalizedXml)) throw new Error('MPD manifest does not contain playable DASH representations.');

  const videoRepresentations = countRepresentations(normalizedXml, 'video');
  const audioRepresentations = countRepresentations(normalizedXml, 'audio');
  if (!videoRepresentations) throw new Error('MPD manifest does not include a video representation.');

  const baseUrls = textValues(normalizedXml, 'BaseURL');
  const references = [...baseUrls, ...attributes(normalizedXml, 'media'), ...attributes(normalizedXml, 'initialization'), ...attributes(normalizedXml, 'sourceURL')];
  const hasRelativeReferences = references.some(isRelativeReference);
  const suppliedBase = suppliedBaseUrl?.trim() ? normalizedBaseUrl(suppliedBaseUrl) : null;
  const absoluteBase = baseUrls.find(isAbsoluteHttpUrl) || null;
  const resolutionBase = suppliedBase || absoluteBase;
  if (hasRelativeReferences && !resolutionBase) {
    throw new Error('This MPD uses relative media URLs. Enter its original authorized manifest base URL before importing.');
  }

  // If the local MPD used relative paths, add a root BaseURL rather than
  // rewriting individual URLs or query signatures. Absolute signed URLs stay
  // exactly as supplied by the administrator.
  if (suppliedBase && hasRelativeReferences) {
    normalizedXml = normalizedXml.replace(/(<MPD\b[^>]*>)/i, `$1<BaseURL>${escapeXml(suppliedBase)}</BaseURL>`);
  }

  // Validate a concrete representative URL when one exists. Template paths
  // containing $RepresentationID$ cannot be guessed safely, so they remain a
  // device-side compatibility check instead of being fabricated by the server.
  const concreteReference = references.find((reference) => !reference.includes('$') && (isAbsoluteHttpUrl(reference) || (resolutionBase && isRelativeReference(reference))));
  if (concreteReference) {
    const resourceUrl = isAbsoluteHttpUrl(concreteReference) ? concreteReference : new URL(concreteReference, resolutionBase!).toString();
    try { await validateRemoteStream(resourceUrl, 'AUTO'); }
    catch (error: any) { throw new Error(`Movie source unavailable: ${error.message}`); }
  }

  return { normalizedXml, videoRepresentations, audioRepresentations, manifestBaseUrl: suppliedBase };
}
