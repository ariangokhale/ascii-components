import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GlobeRenderer, getLandMask } from "./engine";
import {
  paletteVars,
  resolvePalette,
  type AsciiGlobePalette,
  type PaletteName,
} from "./palettes";

export interface AsciiGlobeFrame {
  /** Longitude at the center of the view, in degrees, -180 to 180 (east is positive). */
  longitude: number;
  /** Tilt of the north pole toward the viewer, in degrees. */
  latitude: number;
}

export interface AsciiGlobeProps {
  /** A built-in palette name or your own palette object. Default "atlas". */
  palette?: PaletteName | AsciiGlobePalette;
  /** Rotation speed. 1 is one turn every 30 seconds, 0 holds still, negative turns backward. */
  speed?: number;
  /** Tilt of the north pole toward the viewer, in degrees. Default 18. */
  tilt?: number;
  /** Freeze the animation. Dragging still works when interactive. */
  paused?: boolean;
  /** Longitude to face on first render, in degrees east. Default 20. */
  initialLongitude?: number;
  /** Let people drag to turn the globe, or use the arrow keys when it has focus. */
  interactive?: boolean;
  /** Start paused when the visitor prefers reduced motion. Default true. */
  respectReducedMotion?: boolean;
  /**
   * Target font size in px. Rows are chosen to get as close as the container allows.
   * Default 11, or 8 when the container is narrower than 520px.
   */
  fontSize?: number;
  /** Bounds for the number of text rows. Defaults 24 and 56. */
  minRows?: number;
  maxRows?: number;
  /** Frames per second. Default 30. */
  fps?: number;
  /** CSS font-family for the glyphs. Must be monospace. */
  fontFamily?: string;
  fontWeight?: number | string;
  /** Hide from assistive tech. Use when the globe is only decoration. */
  decorative?: boolean;
  /** Accessible name. Ignored when decorative. */
  "aria-label"?: string;
  /**
   * Called after every drawn frame with the current view. Do not set React state from here at
   * 30 fps; write to a ref or a DOM node instead.
   */
  onFrame?: (frame: AsciiGlobeFrame) => void;
  className?: string;
  /** Applied to the outer box. The globe fits inside it. Default is a full-width square. */
  style?: CSSProperties;
}

const SECONDS_PER_TURN = 30;
const TURN_RATE = (2 * Math.PI) / SECONDS_PER_TURN;
const DEG = Math.PI / 180;
const DEFAULT_FONT =
  'ui-monospace, "SF Mono", "IBM Plex Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Width of one glyph divided by font size, measured for the font actually in use. */
function measureGlyphRatio(font: string): number {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = font;
      const w = ctx.measureText("M".repeat(50)).width / 50 / 100;
      if (w > 0.3 && w < 1) return w;
    }
  } catch {
    /* fall through */
  }
  return 0.6;
}

/**
 * A rotating Earth drawn in text. It has no background of its own and fits inside whatever box
 * you give it, so size and place it with CSS on the component or on a wrapper.
 */
export function AsciiGlobe({
  palette = "atlas",
  speed = 1,
  tilt = 18,
  paused = false,
  initialLongitude = 20,
  interactive = false,
  respectReducedMotion = true,
  fontSize,
  minRows = 24,
  maxRows = 56,
  fps = 30,
  fontFamily = DEFAULT_FONT,
  fontWeight = 500,
  decorative = false,
  "aria-label": ariaLabel = "A rotating Earth drawn in text characters",
  onFrame,
  className,
  style,
}: AsciiGlobeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Everything the animation loop reads lives in one ref, so props never restart the loop.
  const live = useRef({
    spin: -initialLongitude * DEG,
    time: 0,
    tilt: tilt * DEG,
    speed,
    paused,
    reduced: false,
    visible: true,
    dragging: false,
    dirty: true,
    fps,
    charWidth: 7,
    rows: 0,
    onFrame,
  });

  const resolved = useMemo(() => resolvePalette(palette), [palette]);
  const vars = useMemo(() => paletteVars(resolved), [resolved]);

  // Keep the loop's view of the props current.
  useEffect(() => {
    const s = live.current;
    s.tilt = tilt * DEG;
    s.speed = speed;
    s.paused = paused;
    s.fps = fps;
    s.onFrame = onFrame;
    s.dirty = true;
  }, [tilt, speed, paused, fps, onFrame]);

  // Reduced motion.
  useEffect(() => {
    if (!respectReducedMotion || typeof window.matchMedia !== "function") {
      live.current.reduced = false;
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { live.current.reduced = mq.matches; };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [respectReducedMotion]);

  // Layout, resize and the animation loop.
  useEffect(() => {
    const root = rootRef.current;
    const pre = preRef.current;
    if (!root || !pre) return;

    const s = live.current;
    const mask = getLandMask();
    let renderer: GlobeRenderer | null = null;
    let raf = 0;
    let last = performance.now();
    let lastLon = NaN;

    const layout = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      const side = Math.min(w, h || w);
      if (side < 40) return;
      const target = fontSize ?? (w < 520 ? 8 : 11);
      const ratio = measureGlyphRatio(`${fontWeight} 100px ${getComputedStyle(pre).fontFamily}`);
      let rows = Math.floor(side / (2 * ratio * target));
      rows = Math.max(minRows, Math.min(maxRows, rows));
      rows -= rows % 2;
      const px = Math.min(24, side / (2 * rows * ratio));
      const charWidth = px * ratio;
      pre.style.fontSize = `${px}px`;
      pre.style.lineHeight = `${2 * charWidth}px`;
      pre.style.width = `${2 * rows * charWidth}px`;
      pre.style.height = `${2 * rows * charWidth}px`;
      s.charWidth = charWidth;
      if (!renderer || renderer.rows !== rows) {
        renderer = new GlobeRenderer(mask, rows);
        s.rows = rows;
      }
      s.dirty = true;
    };

    const draw = () => {
      if (!renderer) return;
      renderer.frame(s.spin, s.tilt, s.time);
      pre.innerHTML = renderer.toHTML();
      s.dirty = false;
      if (s.onFrame) {
        const lon = Math.round((((-s.spin / DEG + 180) % 360) + 360) % 360 - 180);
        if (lon !== lastLon) {
          lastLon = lon;
          s.onFrame({ longitude: lon, latitude: s.tilt / DEG });
        }
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < 1000 / s.fps) return;
      last = now;
      if (!s.visible) return;
      const dt = Math.min(0.1, elapsed / 1000);
      if (!s.paused && !s.reduced && !s.dragging) {
        s.spin += dt * TURN_RATE * s.speed;
        s.time += dt;
        s.dirty = true;
      }
      if (s.dirty) draw();
    };

    layout();
    draw();
    raf = requestAnimationFrame(tick);

    const resize =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => { layout(); draw(); })
        : null;
    resize?.observe(root);

    const visibility =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            for (const e of entries) s.visible = e.isIntersecting;
            if (s.visible) { last = performance.now(); s.dirty = true; }
          })
        : null;
    visibility?.observe(root);

    // Web fonts change glyph width, so measure again once they load.
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) { layout(); draw(); } });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      resize?.disconnect();
      visibility?.disconnect();
    };
  }, [fontSize, minRows, maxRows, fontWeight, fontFamily]);

  // Drag and keyboard.
  const lastX = useRef(0);
  const turn = (radians: number) => {
    live.current.spin += radians;
    live.current.dirty = true;
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLPreElement>) => {
    if (!interactive) return;
    live.current.dragging = true;
    lastX.current = e.clientX;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLPreElement>) => {
    const s = live.current;
    if (!interactive || !s.dragging) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    turn(dx / (Math.max(1, s.rows - 3) * s.charWidth));
  };
  const endDrag = () => { live.current.dragging = false; };
  const onKeyDown = (e: KeyboardEvent<HTMLPreElement>) => {
    if (!interactive) return;
    if (e.key === "ArrowLeft") { turn(-0.12); e.preventDefault(); }
    else if (e.key === "ArrowRight") { turn(0.12); e.preventDefault(); }
  };

  const rootStyle: CSSProperties = {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    ...(vars as CSSProperties),
    ...style,
  };

  const preStyle: CSSProperties = {
    margin: 0,
    padding: 0,
    overflow: "hidden",
    whiteSpace: "pre",
    fontFamily,
    fontWeight,
    fontVariantLigatures: "none",
    color: "var(--ag-fg)",
    cursor: interactive ? "grab" : "default",
    touchAction: interactive ? "pan-y" : "auto",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <div ref={rootRef} className={className} style={rootStyle}>
      <pre
        ref={preRef}
        style={preStyle}
        role={decorative ? "presentation" : "img"}
        aria-label={decorative ? undefined : ariaLabel}
        aria-hidden={decorative || undefined}
        tabIndex={interactive && !decorative ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
