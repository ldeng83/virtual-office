import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { stickVector, touchSteer, wantsTouchNav } from './touch';

// Show the walk stick on a coarse pointer, and after the first touch on anything else.
export function useTouchNav() {
  const [coarse, setCoarse] = useState(false);
  const [seenTouch, setSeenTouch] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(media.matches);
    sync();
    media.addEventListener('change', sync);
    const seen = () => setSeenTouch(true);
    window.addEventListener('touchstart', seen, { passive: true });
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('touchstart', seen);
    };
  }, []);
  return wantsTouchNav(coarse, seenTouch);
}

const reset = () => {
  touchSteer.active = false;
  touchSteer.x = 0;
  touchSteer.y = 0;
};

// A small stick at the corner of the view. Hold and drag to walk; a tap elsewhere still clicks.
export function TouchStick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const place = (x: number, y: number) => {
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const move = (e: PointerEvent) => {
    if (!touchSteer.active || !base.current) return;
    const rect = base.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const vector = stickVector(dx, dy, rect.width / 2);
    touchSteer.x = vector.x;
    touchSteer.y = vector.y;
    place(vector.x * rect.width * 0.28, vector.y * rect.height * 0.28);
  };
  const end = (e: PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    reset();
    place(0, 0);
  };
  useEffect(() => () => reset(), []);
  return (
    <div
      ref={base}
      className="touch-stick"
      role="group"
      aria-label="Walk control. Hold and drag to move."
      onPointerDown={e => {
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        touchSteer.active = true;
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={() => {
        reset();
        place(0, 0);
      }}
    >
      <span ref={knob} />
    </div>
  );
}
