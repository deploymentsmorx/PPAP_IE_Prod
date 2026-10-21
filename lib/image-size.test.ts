import { describe, expect, it } from "vitest";
import { imageSize } from "./image-size";

describe("imageSize", () => {
  it("reads a PNG's IHDR width/height", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 1115);
    new DataView(png.buffer).setUint32(20, 1567);
    expect(imageSize(png)).toEqual({ width: 1115, height: 1567 });
  });

  it("reads a JPEG's SOF0 frame size, skipping earlier segments", () => {
    // SOI, APP0 (length 4: 2 payload bytes), SOF0 (precision 8, height 300, width 400)
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, 0x03, 0, 0, 0, 0]);
    expect(imageSize(jpeg)).toEqual({ width: 400, height: 300 });
  });

  it("returns null for anything else", () => {
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
