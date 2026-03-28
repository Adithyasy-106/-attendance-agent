/**
 * pdf.js 5.x ships `pdf.worker.min.mjs` (not `.js`). A wrong URL triggers
 * "Setting up fake worker" and slow/unreliable parsing.
 * Serve from `/public/pdf.worker.min.mjs` — copy from `pdfjs-dist/build/` when upgrading.
 */
export function configurePdfWorker(pdfjs: { GlobalWorkerOptions: { workerSrc: string } }) {
  if (typeof window === "undefined") return;
  const origin = window.location.origin || "";
  pdfjs.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.mjs`;
}
