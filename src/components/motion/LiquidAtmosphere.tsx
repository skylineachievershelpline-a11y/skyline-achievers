import { useEffect, useRef } from "react";

export function LiquidAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let running = true;

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawRibbon = (
      time: number,
      center: number,
      amplitude: number,
      speed: number,
      phase: number,
      opacity: number,
    ) => {
      const strands = width < 640 ? 7 : 12;
      for (let strand = 0; strand < strands; strand += 1) {
        context.beginPath();
        for (let x = -30; x <= width + 30; x += 18) {
          const wave = Math.sin(x * 0.008 + time * speed + phase) * amplitude;
          const secondary = Math.sin(x * 0.017 - time * speed * 0.55 + phase) * amplitude * 0.28;
          const y = center + wave + secondary + (strand - strands / 2) * 5.5;
          if (x === -30) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        const mix = strand / Math.max(strands - 1, 1);
        context.strokeStyle = `rgba(${Math.round(48 + mix * 40)}, ${Math.round(105 + mix * 90)}, 255, ${opacity * (0.35 + mix * 0.65)})`;
        context.lineWidth = strand === strands - 1 ? 1.25 : 0.7;
        context.stroke();
      }
    };

    const drawSilk = (time: number, center: number, amplitude: number, phase: number, alpha: number) => {
      const top: Array<{ x: number; y: number }> = [];
      const bottom: Array<{ x: number; y: number }> = [];
      for (let x = -40; x <= width + 40; x += 20) {
        const base = center + Math.sin(x * 0.007 + time * 0.22 + phase) * amplitude;
        const fold = Math.sin(x * 0.015 - time * 0.16 + phase * 1.7) * amplitude * 0.34;
        const thickness = 26 + Math.sin(x * 0.01 + time * 0.18) * 12;
        top.push({ x, y: base + fold - thickness });
        bottom.push({ x, y: base - fold + thickness });
      }
      context.beginPath();
      top.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
      [...bottom].reverse().forEach((point) => context.lineTo(point.x, point.y));
      context.closePath();
      const gradient = context.createLinearGradient(0, center - amplitude, width, center + amplitude);
      gradient.addColorStop(0, `rgba(20, 54, 138, ${alpha * 0.2})`);
      gradient.addColorStop(0.42, `rgba(40, 92, 224, ${alpha * 0.52})`);
      gradient.addColorStop(0.7, `rgba(73, 198, 255, ${alpha * 0.7})`);
      gradient.addColorStop(1, `rgba(12, 39, 116, ${alpha * 0.16})`);
      context.fillStyle = gradient;
      context.fill();
    };

    const draw = (stamp: number) => {
      if (!running) return;
      const time = reduceMotion ? 0 : stamp / 1000;
      context.clearRect(0, 0, width, height);
      const glow = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.72);
      glow.addColorStop(0, "rgba(28, 91, 196, 0.2)");
      glow.addColorStop(0.58, "rgba(4, 24, 64, 0.09)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      drawSilk(time, height * 0.28, Math.min(82, height * 0.1), 0.2, 0.56);
      drawRibbon(time, height * 0.28, Math.min(82, height * 0.1), 0.45, 0.2, 0.48);
      drawSilk(time, height * 0.74, Math.min(108, height * 0.13), 2.4, 0.44);
      drawRibbon(time, height * 0.74, Math.min(108, height * 0.13), -0.32, 2.4, 0.36);

      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      const isVisible = !document.hidden;
      if (isVisible) {
        running = true;
        resize(); // Re-sync dimensions on resume
        if (!reduceMotion) {
          window.cancelAnimationFrame(frame);
          frame = window.requestAnimationFrame(draw);
        }
      } else {
        running = false;
        window.cancelAnimationFrame(frame);
      }
    };

    resize();
    draw(0);
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("focus", onVisibility); // Also check on focus
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="liquid-atmosphere" aria-hidden />;
}