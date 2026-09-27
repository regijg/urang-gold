import { describe, expect, it } from "vitest";
import { detectImageType, productPhotoUrl } from "./image";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

describe("detectImageType", () => {
  it("detects JPEG, PNG and WEBP by magic bytes", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(detectImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))?.ext).toBe("webp");
  });

  it("rejects other content even if named like an image", () => {
    expect(detectImageType(bytes(...ascii("<svg onload=alert(1)>")))).toBeNull();
    expect(detectImageType(bytes(...ascii("GIF89a")))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });
});

describe("productPhotoUrl", () => {
  it("builds a public storage URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    expect(productPhotoUrl("t1/p1/x.jpg")).toBe("https://abc.supabase.co/storage/v1/object/public/gold-products/t1/p1/x.jpg");
    expect(productPhotoUrl(null)).toBeNull();
  });
});
