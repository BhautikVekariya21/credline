import { useEffect, useRef } from 'react';

export default function CursorTrail() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');

    if (!layer || reducedMotion.matches || coarsePointer.matches) {
      return undefined;
    }

    let lastSpawn = 0;

    const spawnPixel = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;

      const now = performance.now();
      if (now - lastSpawn < 18) return;
      lastSpawn = now;

      const pixel = document.createElement('span');
      pixel.className = 'cursor-trail-pixel';
      pixel.style.left = `${event.clientX}px`;
      pixel.style.top = `${event.clientY}px`;
      layer.appendChild(pixel);

      window.setTimeout(() => {
        pixel.remove();
      }, 720);
    };

    window.addEventListener('pointermove', spawnPixel, { passive: true });

    return () => {
      window.removeEventListener('pointermove', spawnPixel);
      layer.replaceChildren();
    };
  }, []);

  return <div ref={layerRef} className="cursor-trail-layer" aria-hidden="true" />;
}
