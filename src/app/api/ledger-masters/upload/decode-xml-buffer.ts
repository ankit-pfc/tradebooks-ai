/**
 * BOM-aware decoder for uploaded Tally XML buffers. Tally exports are
 * commonly UTF-16 LE; browsers/`File.text()` would otherwise mis-decode them.
 */
export function decodeXmlBuffer(buf: ArrayBuffer): string {
  if (buf.byteLength === 0) return '';
  const view = new Uint8Array(buf);
  const b0 = view[0];
  const b1 = view[1];
  const b2 = view[2];

  let label = 'utf-8';
  if (b0 === 0xff && b1 === 0xfe) label = 'utf-16le';
  else if (b0 === 0xfe && b1 === 0xff) label = 'utf-16be';
  else if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) label = 'utf-8';

  return new TextDecoder(label, { ignoreBOM: false }).decode(buf);
}
