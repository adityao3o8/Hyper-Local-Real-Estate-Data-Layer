"use client";

import { useEffect, useRef } from "react";

type VantaInstance = { destroy: () => void; resize?: () => void };

const P5_SRC = "/vendor/p5.min.js";
const VANTA_TRUNK_SRC = "/vendor/vanta.trunk.min.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-vanta-src="${src}"]`
    );
    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(src)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.vantaSrc = src;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

async function ensureVantaLibs(): Promise<void> {
  await loadScript(P5_SRC);
  await loadScript(VANTA_TRUNK_SRC);
  if (!window.VANTA?.TRUNK) {
    throw new Error("VANTA.TRUNK not available after script load");
  }
}

export function VantaHeroBackground({ layoutKey }: { layoutKey?: string | number | boolean }) {
  const vantaRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaInstance | null>(null);

  useEffect(() => {
    const el = vantaRef.current;
    if (!el) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    const init = () => {
      if (cancelled || !vantaRef.current || !window.VANTA?.TRUNK) return;
      if (vantaRef.current.offsetWidth < 2) return;

      try {
        effectRef.current?.destroy();
      } catch {
        /* ignore */
      }

      effectRef.current = window.VANTA.TRUNK({
        el: vantaRef.current,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        scaleMobile: 1,
        backgroundColor: 0x080808,
        color: 0x16c784,
        spacing: 0,
        chaos: 1,
      });
      effectRef.current.resize?.();
    };

    const boot = async () => {
      try {
        await ensureVantaLibs();
        if (cancelled) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(init);
        });
      } catch (err) {
        console.error("[Vanta]", err);
      }
    };

    boot();

    const onResize = () => {
      if (effectRef.current) effectRef.current.resize?.();
      else init();
    };

    window.addEventListener("resize", onResize);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(el);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      try {
        effectRef.current?.destroy();
      } catch {
        /* ignore */
      }
      effectRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => effectRef.current?.resize?.(), 120);
    return () => window.clearTimeout(id);
  }, [layoutKey]);

  return (
    <div className="hero-vanta-root pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div
        ref={vantaRef}
        className="hero-vanta-canvas hero-vanta-trunk absolute inset-0 h-full w-full"
        style={{ minHeight: "100vh", minWidth: "100vw" }}
      />
      <div className="hero-vanta-overlay absolute inset-0 pointer-events-none" />
    </div>
  );
}
