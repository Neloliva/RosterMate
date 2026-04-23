import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { mkdirSync } from "node:fs";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error("No Chrome/Edge found in standard locations");
  process.exit(1);
}

const OUT_DIR = "public/screenshots";
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  defaultViewport: { width: 1440, height: 1024, deviceScaleFactor: 2 },
});

try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/", {
    waitUntil: "networkidle0",
    timeout: 30000,
  });

  // Find and click the notification bell.
  const bell = await page.waitForSelector(
    'button[aria-label="Staff requests"]',
    { timeout: 10000 },
  );
  await bell.click();

  // Wait for the popover content to render (title text is "Staff requests").
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("h3")).some(
        (h) => h.textContent?.trim() === "Staff requests",
      ),
    { timeout: 5000 },
  );
  // Let any impact-panel data settle.
  await new Promise((r) => setTimeout(r, 400));

  // Screenshot just the popover region. The popover root is
  // "w-[min(90vw,420px)] rounded-xl border border-slate-200 bg-white shadow-xl".
  // Pick the wrapping div by finding the one that contains the "Staff requests" h3
  // and walking up to the popover container.
  const clip = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h3")).find(
      (h) => h.textContent?.trim() === "Staff requests",
    );
    if (!heading) return null;
    // Popover container has "rounded-xl ... shadow-xl" — walk up to that.
    let el = heading.parentElement;
    while (el && !el.className?.includes?.("shadow-xl")) {
      el = el.parentElement;
    }
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: r.left,
      y: r.top,
      width: r.width,
      height: r.height,
    };
  });

  if (!clip) {
    throw new Error("Could not locate the popover container");
  }

  // Add a small padding so the drop shadow isn't clipped.
  const pad = 12;
  const clipWithPad = {
    x: Math.max(0, clip.x - pad),
    y: Math.max(0, clip.y - pad),
    width: clip.width + pad * 2,
    height: clip.height + pad * 2,
  };

  await page.screenshot({
    path: `${OUT_DIR}/notifications.png`,
    clip: clipWithPad,
    omitBackground: false,
  });
  console.log("wrote", `${OUT_DIR}/notifications.png`);
} finally {
  await browser.close();
}
