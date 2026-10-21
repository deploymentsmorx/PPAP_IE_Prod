/**
 * Pixel size of a PNG or JPEG from its header bytes (no image library).
 * Returns null for other formats or truncated data.
 */
export function imageSize(buf: Uint8Array): { width: number; height: number } | null {
  // PNG: 8-byte signature, then the IHDR chunk with big-endian width/height.
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: walk the segments to the first start-of-frame (SOF0-SOF15, not DHT/JPG/DAC).
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const length = (buf[i + 2] << 8) | buf[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (buf[i + 5] << 8) | buf[i + 6], width: (buf[i + 7] << 8) | buf[i + 8] };
      }
      i += 2 + length;
    }
  }
  return null;
}
