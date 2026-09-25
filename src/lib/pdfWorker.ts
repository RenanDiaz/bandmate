import { pdfjs } from "react-pdf";

/**
 * Serve the pdf.js worker from our own origin so the service worker precaches
 * it and the PDF viewer can start offline. `pdfjs-dist` is pinned in
 * package.json to the exact version react-pdf depends on — the worker and the
 * runtime API must match, so bump both together.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
