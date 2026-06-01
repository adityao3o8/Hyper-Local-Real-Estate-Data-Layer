"use client";

export function ExportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed bottom-6 right-6 z-40 border border-[#1A1A1A] bg-[#0F0F0F] px-5 py-2.5 text-[12px] tracking-wide text-[#F5F5F5] transition-colors hover:border-[#333333] hover:bg-[#1A1A1A]"
    >
      Download Report
    </button>
  );
}
