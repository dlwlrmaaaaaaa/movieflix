import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from 'web-streams-polyfill/ponyfill';

// Expo SDK 51's Hermes runtime does not provide the Web Streams globals used
// by livekit-client's WebSocketStream. This WHATWG Streams ponyfill implements
// the reader/writer APIs LiveKit uses for signaling, and must load first.
if (typeof (globalThis as any).ReadableStream === 'undefined') {
  (globalThis as any).ReadableStream = ReadableStream;
}
if (typeof (globalThis as any).WritableStream === 'undefined') {
  (globalThis as any).WritableStream = WritableStream;
}
if (typeof (globalThis as any).TransformStream === 'undefined') {
  (globalThis as any).TransformStream = TransformStream;
}

// Hermes also does not expose DOMException, but LiveKit uses it for abort and
// track errors. Define the small standards-compatible surface it requires.
if (typeof (globalThis as any).DOMException === 'undefined') {
  class ReactNativeDOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  }
  (globalThis as any).DOMException = ReactNativeDOMException;
}
