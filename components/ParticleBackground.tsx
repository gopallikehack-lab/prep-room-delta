"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
  hue: number;
};

/**
 * Falling light particles background.
 * Canvas-based, respects prefers-reduced-motion, no deps.
 */
export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    const particles: Particle[] = [];

    function resize() {
      if (!canvas) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(count: number) {
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.6 + 0.4,
          vy: Math.random() * 0.35 + 0.15,
          vx: (Math.random() - 0.5) * 0.08,
          alpha: Math.random() * 0.5 + 0.15,
          hue: 190 + Math.random() * 40, // cyan to light blue
        });
      }
    }

    function tick() {
      if (!canvas) return;
      ctx!.clearRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "lighter";

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > height + 5) {
          p.y = -5;
          p.x = Math.random() * width;
        }
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;

        const grad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        grad.addColorStop(0, `hsla(${p.hue}, 90%, 70%, ${p.alpha})`);
        grad.addColorStop(1, `hsla(${p.hue}, 90%, 70%, 0)`);
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx!.fill();
      }

      raf = requestAnimationFrame(tick);
    }

    function start() {
      resize();
      const count = Math.min(
        90,
        Math.max(30, Math.floor((width * height) / 22000))
      );
      spawn(count);
      cancelAnimationFrame(raf);
      tick();
    }

    start();

    const onResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      start();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
