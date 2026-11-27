export interface SplashDevice {
  w: number;
  h: number;
  dpr: number;
  tablet?: boolean;
}

export const SPLASH_DEVICES: readonly SplashDevice[] = [
  // iPhone
  { w: 440, h: 956, dpr: 3 },
  { w: 420, h: 912, dpr: 3 },
  { w: 402, h: 874, dpr: 3 },
  { w: 430, h: 932, dpr: 3 },
  { w: 393, h: 852, dpr: 3 },
  { w: 428, h: 926, dpr: 3 },
  { w: 390, h: 844, dpr: 3 },
  { w: 375, h: 812, dpr: 3 },
  { w: 360, h: 780, dpr: 3 },
  { w: 414, h: 896, dpr: 3 },
  { w: 414, h: 896, dpr: 2 },
  { w: 414, h: 736, dpr: 3 },
  { w: 375, h: 667, dpr: 2 },
  { w: 320, h: 568, dpr: 2 },
  // iPad
  { w: 1032, h: 1376, dpr: 2, tablet: true },
  { w: 834, h: 1210, dpr: 2, tablet: true },
  { w: 1024, h: 1366, dpr: 2, tablet: true },
  { w: 834, h: 1194, dpr: 2, tablet: true },
  { w: 820, h: 1180, dpr: 2, tablet: true },
  { w: 834, h: 1112, dpr: 2, tablet: true },
  { w: 810, h: 1080, dpr: 2, tablet: true },
  { w: 768, h: 1024, dpr: 2, tablet: true },
  { w: 744, h: 1133, dpr: 2, tablet: true },
];

export interface SplashVariant {
  slug: string;
  width: number;
  height: number;
  media: string;
}

/* iPhone solo portrait; iPad portrait y landscape. `device-width/height` van
   siempre en dimensiones CSS de portrait: asi los compara iOS. */
export function splashVariants(devices: readonly SplashDevice[] = SPLASH_DEVICES): SplashVariant[] {
  const out: SplashVariant[] = [];
  for (const d of devices) {
    const mediaFor = (orientation: "portrait" | "landscape") =>
      `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: ${orientation})`;
    const push = (width: number, height: number, orientation: "portrait" | "landscape") =>
      out.push({ slug: `${width}x${height}`, width, height, media: mediaFor(orientation) });
    push(d.w * d.dpr, d.h * d.dpr, "portrait");
    if (d.tablet) push(d.h * d.dpr, d.w * d.dpr, "landscape");
  }
  return out;
}

/** Entradas `startupImage` de la metadata de Next (emiten `<link rel="apple-touch-startup-image">`). */
export function splashStartupImages() {
  return splashVariants().map((v) => ({ url: `/splash/${v.slug}`, media: v.media }));
}
