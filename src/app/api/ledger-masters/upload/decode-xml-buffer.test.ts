import { describe, it, expect } from 'vitest';
import { decodeXmlBuffer } from './decode-xml-buffer';

function bytes(...b: number[]): ArrayBuffer {
  return new Uint8Array(b).buffer;
}

function utf16leBytes(s: string): ArrayBuffer {
  const out = new Uint8Array(2 + s.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out[2 + i * 2] = code & 0xff;
    out[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return out.buffer;
}

function utf16beBytes(s: string): ArrayBuffer {
  const out = new Uint8Array(2 + s.length * 2);
  out[0] = 0xfe;
  out[1] = 0xff;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out[2 + i * 2] = (code >> 8) & 0xff;
    out[2 + i * 2 + 1] = code & 0xff;
  }
  return out.buffer;
}

describe('decodeXmlBuffer', () => {
  it('returns empty string for empty buffer', () => {
    expect(decodeXmlBuffer(new ArrayBuffer(0))).toBe('');
  });

  it('decodes plain UTF-8 unchanged', () => {
    const utf8 = new TextEncoder().encode('<ENVELOPE>hello</ENVELOPE>');
    expect(decodeXmlBuffer(utf8.buffer)).toBe('<ENVELOPE>hello</ENVELOPE>');
  });

  it('strips UTF-8 BOM', () => {
    const body = new TextEncoder().encode('<E/>');
    const buf = new Uint8Array(3 + body.length);
    buf.set([0xef, 0xbb, 0xbf], 0);
    buf.set(body, 3);
    expect(decodeXmlBuffer(buf.buffer)).toBe('<E/>');
  });

  it('decodes UTF-16 LE with BOM', () => {
    expect(decodeXmlBuffer(utf16leBytes('<E>x</E>'))).toBe('<E>x</E>');
  });

  it('decodes UTF-16 BE with BOM', () => {
    expect(decodeXmlBuffer(utf16beBytes('<E>x</E>'))).toBe('<E>x</E>');
  });

  it('does not crash on a single byte (no BOM detectable)', () => {
    expect(typeof decodeXmlBuffer(bytes(0x3c))).toBe('string');
  });
});
