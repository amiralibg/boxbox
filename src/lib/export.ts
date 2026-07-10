/**
 * ExportLayer: serialize a live SVG element and download as .svg or .png.
 *
 * The exported file leaves the page, so the webfont must travel with it —
 * we inline the woff2 as a data-URI @font-face. PNG export rasterizes the
 * same standalone SVG through an <img> + canvas at `scale`×.
 */

const FONTS = [
  { file: "/fonts/space-grotesk.woff2", family: "Space Grotesk", weight: "300 700", style: "normal" },
  { file: "/fonts/jetbrains-mono.woff2", family: "JetBrains Mono", weight: "400 700", style: "normal" },
];

let fontCss: string | null = null;

async function embeddedFontCss(): Promise<string> {
  if (fontCss) return fontCss;
  const faces = await Promise.all(
    FONTS.map(async (f) => {
      const buf = await (await fetch(f.file)).arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
    }),
  );
  fontCss = faces.join("");
  return fontCss;
}

async function standaloneSvg(el: SVGSVGElement): Promise<string> {
  const clone = el.cloneNode(true) as SVGSVGElement;
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = await embeddedFontCss();
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadSvg(el: SVGSVGElement, filename: string) {
  const svg = await standaloneSvg(el);
  download(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`);
}

export async function downloadPng(el: SVGSVGElement, filename: string, scale = 2) {
  const svg = await standaloneSvg(el);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG rasterization failed"));
      img.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG encoding failed");
    download(blob, `${filename}.png`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
