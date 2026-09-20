import { useEffect, useRef } from "react";

type Ripple = { x: number; y: number; born: number; strength: number };

export function LiquidAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ripples: Ripple[] = [];
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

    const addRipple = (x: number, y: number, strength = 1) => {
      if (reduceMotion || document.hidden) return;
      ripples.push({ x, y, born: performance.now(), strength });
      if (ripples.length > 7) ripples.shift();
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
          let disturbance = 0;
          for (const ripple of ripples) {
            const age = time * 1000 - ripple.born;
            const dx = x - ripple.x;
            const radius = age * 0.16;
            const distance = Math.abs(dx) - radius;
            const proximity = Math.exp(-(distance * distance) / 4300);
            const verticalReach = Math.exp(-Math.abs(center - ripple.y) / Math.max(height * 0.42, 1));
            disturbance += Math.sin(distance * 0.055) * proximity * verticalReach * 30 * ripple.strength * Math.max(0, 1 - age / 1500);
          }
          const y = center + wave + secondary + disturbance + (strand - strands / 2) * 5.5;
          if (x === -30) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        const mix = strand / Math.max(strands - 1, 1);
        context.strokeStyle = `rgba(${Math.round(48 + mix * 40)}, ${Math.round(105 + mix * 90)}, 255, ${opacity * (0.35 + mix * 0.65)})`;
        context.lineWidth = strand === strands - 1 ? 1.25 : 0.7;
        context.stroke();
      }
    };

    const draw = (stamp: number) => {
      if (!running) return;
      const time = reduceMotion ? 0 : stamp / 1000;
      context.clearRect(0, 0, width, height);
      const glow = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.72);
      glow.addColorStop(0, "rgba(28, 91, 196, 0.12)");
      glow.addColorStop(0.58, "rgba(4, 24, 64, 0.05)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      drawRibbon(time, height * 0.3, Math.min(70, height * 0.08), 0.45, 0.2, 0.16);
      drawRibbon(time, height * 0.7, Math.min(92, height * 0.11), -0.32, 2.4, 0.1);

      const now = performance.now();
      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        const age = now - ripple.born;
        if (age > 1500) {
          ripples.splice(index, 1);
          continue;
        }
        context.beginPath();
        context.arc(ripple.x, ripple.y, age * 0.16, 0, Math.PI * 2);
        context.strokeStyle = `rgba(94, 218, 255, ${0.2 * (1 - age / 1500)})`;
        context.lineWidth = 1.2;
        context.stroke();
      }
      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    const onPointer = (event: PointerEvent) => addRipple(event.clientX, event.clientY, event.pointerType === "touch" ? 1.15 : 0.8);
    const onVisibility = () => {
      running = !document.hidden;
      if (running && !reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    resize();
    draw(0);
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="liquid-atmosphere" aria-hidden />;
}