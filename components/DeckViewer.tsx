"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Serve pdfjs worker from our own public folder so the version always matches
// the installed pdfjs-dist (no CDN version-skew issues).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function DeckViewer({ exportUrl }: { exportUrl: string }) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Route the PDF through our own origin so PDF.js can fetch without CORS issues
  const fileUrl = `/api/deck-proxy?url=${encodeURIComponent(exportUrl)}`;

  // Fallback: if PDF.js fails to load, use the native PDF embed so users still see the deck
  if (loadFailed) {
    return (
      <embed
        src={`${exportUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0`}
        type="application/pdf"
        className="w-full rounded-xl"
        style={{ height: "min(calc(100vh - 120px), 80vw)" }}
      />
    );
  }

  // Track container width to render PDF pages at the right size
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Detect the slide most visible in the viewport as user scrolls
  useEffect(() => {
    if (numPages === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null;
        for (const entry of entries) {
          const pageAttr = (entry.target as HTMLElement).dataset.page;
          if (!pageAttr) continue;
          const page = parseInt(pageAttr, 10);
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { page, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0) setCurrentPage(best.page);
      },
      { threshold: [0.25, 0.5, 0.75], root: containerRef.current }
    );
    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [numPages]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const jumpToPage = (n: number) => {
    const el = pageRefs.current.get(n);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex gap-3 h-full" style={{ height: "min(calc(100vh - 120px), 80vw)" }}>
      {/* Slide rail */}
      <div className="hidden md:flex flex-col gap-1.5 w-14 shrink-0 overflow-y-auto py-1">
        {numPages === 0
          ? Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <div key={n} className="aspect-video rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ))
          : Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => jumpToPage(n)}
                className={`shrink-0 aspect-video rounded-md border text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
                  currentPage === n
                    ? "bg-violet-600 border-violet-600 text-white"
                    : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-violet-400 dark:hover:border-violet-600"
                }`}
                title={`Slide ${n}`}
              >
                {n}
              </button>
            ))}
      </div>

      {/* Deck */}
      <div
        ref={containerRef}
        className="flex-1 min-w-0 overflow-y-auto rounded-xl bg-zinc-100 dark:bg-zinc-900 p-2"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => {
            console.error("PDF.js failed to load deck, falling back to embed:", err);
            setLoadFailed(true);
          }}
          loading={<DeckLoading />}
          error={<DeckError />}
        >
          <div className="flex flex-col gap-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                data-page={n}
                ref={(el) => {
                  if (el) pageRefs.current.set(n, el);
                  else pageRefs.current.delete(n);
                }}
                className="flex justify-center"
              >
                <div className="shadow-lg rounded-lg overflow-hidden bg-white">
                  <Page
                    pageNumber={n}
                    width={containerWidth ? containerWidth - 16 : undefined}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}

function DeckLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function DeckError() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-zinc-500">Couldn't load deck preview.</p>
    </div>
  );
}
