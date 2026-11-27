import { describe, expect, it } from "vitest";
import { SPLASH_DEVICES, splashStartupImages, splashVariants } from "./splash";

describe("splashVariants", () => {
  const variants = splashVariants();

  it("genera 14 iPhone portrait + 9 iPad x2 = 32 variantes", () => {
    expect(variants.length).toBe(32);
  });

  it("los slugs son unicos", () => {
    expect(new Set(variants.map((v) => v.slug)).size).toBe(variants.length);
  });

  it("iPhone 390x844@3 -> slug 1170x2532 con su media exacta", () => {
    const v = variants.find((x) => x.media.includes("device-width: 390px"));
    expect(v).toMatchObject({ slug: "1170x2532", width: 1170, height: 2532 });
    expect(v?.media).toBe(
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    );
  });

  it("iPad 1024x1366 landscape -> 2732x2048 con dims CSS de portrait en la media", () => {
    const v = variants.find((x) => x.slug === "2732x2048");
    expect(v).toBeDefined();
    expect(v?.media).toBe(
      "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    );
    expect(v?.width).toBe(2732);
    expect(v?.height).toBe(2048);
  });

  it("ningun iPhone tiene landscape", () => {
    const iphones = SPLASH_DEVICES.filter((d) => !d.tablet);
    const iphoneLandscape = variants.filter(
      (v) => v.media.includes("landscape") && iphones.some((d) => v.media.includes(`device-width: ${d.w}px`)),
    );
    expect(iphoneLandscape).toEqual([]);
  });
});

describe("splashStartupImages", () => {
  it("mapea a url /splash/<slug> + media", () => {
    const imgs = splashStartupImages();
    expect(imgs.length).toBe(32);
    const first = imgs.find((i) => i.url === "/splash/1170x2532");
    expect(first?.media).toContain("device-width: 390px");
  });
});
