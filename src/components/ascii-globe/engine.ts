/**
 * ASCII globe engine. No React, no DOM: give it a rotation and it fills a character grid.
 *
 * How it works, from first principles:
 *  1. Every character cell is a point on a sphere seen head-on (x right, y up, z toward you).
 *  2. Tilt and spin rotate that point, and the rotated point converts to longitude and latitude.
 *  3. A 1-degree land/ocean grid is sampled at that longitude and latitude. Each cell takes five
 *     samples (its corners and center) and calls itself land if three or more hit land.
 *  4. Brightness is the angle to a fixed sun. Brightness picks the character from a ramp, so
 *     dense characters are the lit parts.
 */
import { LAND, WATER } from "./land-data";

const W = 360;
const H = 181;
const R2D = 180 / Math.PI;
const RAMP = " .:-=+*#%@";

/** Color slots a cell can use. The index is stored per cell; 0 means "no color". */
export const COLOR_SLOTS = [
  "", "o1", "o2", "o3", "o4", "l1", "l2", "l3", "l4", "i1", "i2", "rm", "s1", "s2",
] as const;

const SPAN_OPEN = COLOR_SLOTS.map((slot) =>
  slot ? `<span style="color:var(--ag-${slot})">` : ""
);

// Cell kinds.
const EMPTY = 0;
const SPHERE = 1;
const RIM = 2;
const STAR = 3;

/** Sun direction in view space, and its half vector with the viewer for the glint. */
const LIGHT = normalize(0.62, 0.3, 0.72);
const HALF = normalize(LIGHT[0], LIGHT[1], LIGHT[2] + 1);

function normalize(x: number, y: number, z: number): [number, number, number] {
  const n = Math.sqrt(x * x + y * y + z * z);
  return [x / n, y / n, z / n];
}

function pointInPolygon(x: number, y: number, ring: number[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillPolygon(mask: Uint8Array, ring: number[], value: number): void {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]);
    y0 = Math.min(y0, ring[i + 1]); y1 = Math.max(y1, ring[i + 1]);
  }
  const lonA = Math.max(-180, Math.floor(x0)), lonB = Math.min(179, Math.ceil(x1));
  const latA = Math.max(-90, Math.floor(y0)), latB = Math.min(90, Math.ceil(y1));
  for (let lat = latA; lat <= latB; lat++) {
    for (let lon = lonA; lon <= lonB; lon++) {
      if (pointInPolygon(lon, lat, ring)) mask[(lat + 90) * W + (lon + 180)] = value;
    }
  }
}

/** Antarctica is generated from a wobbly latitude line with the peninsula and two seas cut in. */
function fillAntarctica(mask: Uint8Array): void {
  for (let lat = -90; lat <= -60; lat++) {
    for (let lon = -180; lon < 180; lon++) {
      let dl = lon + 62;
      if (dl > 180) dl -= 360;
      if (dl < -180) dl += 360;
      let edge = -70.5 + 1.4 * Math.sin(lon * 0.13);
      if (Math.abs(dl) < 14) edge += 7 * Math.cos(((dl / 14) * Math.PI) / 2); // peninsula
      edge -= 7 * Math.exp(-Math.pow((lon + 165) / 14, 2)); // Ross Sea
      edge -= 6 * Math.exp(-Math.pow((lon + 45) / 11, 2)); // Weddell Sea
      if (lat < edge) mask[(lat + 90) * W + (lon + 180)] = 1;
    }
  }
}

let cachedMask: Uint8Array | null = null;

/** 360 x 181 land/ocean grid, one cell per degree. Built once, then cached. */
export function getLandMask(): Uint8Array {
  if (cachedMask) return cachedMask;
  const mask = new Uint8Array(W * H);
  for (const ring of LAND) fillPolygon(mask, ring, 1);
  fillAntarctica(mask);
  for (const ring of WATER) fillPolygon(mask, ring, 0);
  cachedMask = mask;
  return mask;
}

/** Cheap deterministic hash in [0, 1) so stars stay put between frames and resizes. */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class GlobeRenderer {
  readonly cols: number;
  readonly rows: number;
  /** Radius of the sphere in column widths. */
  readonly radius: number;

  private readonly mask: Uint8Array;
  private readonly count: number;
  private readonly kind: Uint8Array;
  private readonly rimGlyph: Uint8Array;
  private readonly diffuse: Float32Array;
  private readonly glint: Float32Array;
  private readonly sx: Float32Array;
  private readonly sy: Float32Array;
  private readonly sz: Float32Array;
  private readonly twinklePhase: Float32Array;
  private readonly twinkleRate: Float32Array;
  private readonly starGlyph: Uint8Array;
  private readonly chars: Uint8Array;
  private readonly colors: Uint8Array;

  /**
   * @param rows Number of text rows. Columns are twice that, because a character cell is
   *             about twice as tall as it is wide, which makes the grid square on screen.
   */
  constructor(mask: Uint8Array, rows: number) {
    const cols = rows * 2;
    const n = cols * rows;
    this.mask = mask;
    this.cols = cols;
    this.rows = rows;
    this.count = n;
    this.radius = rows - 3;
    this.kind = new Uint8Array(n);
    this.rimGlyph = new Uint8Array(n);
    this.diffuse = new Float32Array(n);
    this.glint = new Float32Array(n);
    this.sx = new Float32Array(n * 5);
    this.sy = new Float32Array(n * 5);
    this.sz = new Float32Array(n * 5);
    this.twinklePhase = new Float32Array(n);
    this.twinkleRate = new Float32Array(n);
    this.starGlyph = new Uint8Array(n);
    this.chars = new Uint8Array(n);
    this.colors = new Uint8Array(n);

    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const R = this.radius;
    // Five samples per cell: four corners and the center, in column widths.
    const offX = [-0.25, 0.25, -0.25, 0.25, 0];
    const offY = [-0.5, -0.5, 0.5, 0.5, 0];
    const lightFlat = Math.hypot(LIGHT[0], LIGHT[1]);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        const x = (c - cx) / R;
        const y = (-(r - cy) * 2) / R;
        const r2 = x * x + y * y;
        if (r2 < 1) {
          const z = Math.sqrt(1 - r2);
          this.kind[k] = SPHERE;
          this.diffuse[k] = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
          this.glint[k] = Math.pow(Math.max(0, x * HALF[0] + y * HALF[1] + z * HALF[2]), 48);
          for (let s = 0; s < 5; s++) {
            let xs = x + offX[s] / R;
            let ys = y + offY[s] / R;
            let q2 = xs * xs + ys * ys;
            if (q2 >= 0.999) {
              const f = Math.sqrt(0.999 / q2);
              xs *= f; ys *= f; q2 = 0.999;
            }
            this.sx[k * 5 + s] = xs;
            this.sy[k * 5 + s] = ys;
            this.sz[k * 5 + s] = Math.sqrt(1 - q2);
          }
        } else {
          const rho = Math.sqrt(r2);
          const sunSide = (x * LIGHT[0] + y * LIGHT[1]) / lightFlat / rho;
          if (rho < 1.07 && sunSide > -0.2) {
            this.kind[k] = RIM;
            this.rimGlyph[k] = rho < 1.035 ? 58 : 46; // ':' near the limb, '.' farther out
          } else if (rho > 1.12) {
            const h = hash(c, r);
            if (h < 0.02) {
              this.kind[k] = STAR;
              this.twinklePhase[k] = hash(r, c) * 6.283;
              this.twinkleRate[k] = 0.6 + hash(c + 7, r + 3) * 1.6;
              this.starGlyph[k] = h < 0.005 ? 42 : 43; // '*' or '+'
            }
          }
        }
      }
    }
  }

  /**
   * Render one frame.
   * @param spin Earth rotation in radians. Positive turns the Earth eastward.
   * @param tilt Radians the north pole leans toward the viewer.
   * @param time Animation clock in seconds. Drives star twinkle and ocean shimmer.
   */
  frame(spin: number, tilt: number, time: number): void {
    const { count, mask, kind, chars, colors, sx, sy, sz } = this;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const spinDeg = spin * R2D;

    for (let k = 0; k < count; k++) {
      const kd = kind[k];
      if (kd === EMPTY) { chars[k] = 32; colors[k] = 0; continue; }
      if (kd === RIM) { chars[k] = this.rimGlyph[k]; colors[k] = 11; continue; }
      if (kd === STAR) {
        const v = Math.sin(this.twinklePhase[k] + time * this.twinkleRate[k]);
        if (v > 0.6) { chars[k] = this.starGlyph[k]; colors[k] = 13; }
        else if (v > -0.15) { chars[k] = 46; colors[k] = 12; }
        else { chars[k] = 32; colors[k] = 0; }
        continue;
      }

      let landVotes = 0;
      let lat = 0;
      let lon = 0;
      for (let s = 0; s < 5; s++) {
        const q = k * 5 + s;
        const x = sx[q], y = sy[q], z = sz[q];
        const by = y * cosT + z * sinT;
        const bz = -y * sinT + z * cosT;
        const lat_ = Math.asin(Math.max(-1, Math.min(1, by))) * R2D;
        const lon_ = Math.atan2(x, bz) * R2D - spinDeg;
        let col = Math.round(lon_ + 180) % 360;
        if (col < 0) col += 360;
        landVotes += mask[Math.round(lat_ + 90) * W + col];
        if (s === 4) { lat = lat_; lon = lon_; }
      }

      const diffuse = this.diffuse[k];
      if (landVotes >= 3) {
        const lonWrapped = (((lon + 180) % 360) + 360) % 360 - 180;
        const relief = Math.sin(lon * 0.12 + lat * 0.07) * Math.sin(lat * 0.19 - lon * 0.05);
        let b = 0.13 + 0.87 * diffuse + 0.07 * relief;
        const ice = lat > 67 || lat < -64 || (lat > 59 && lonWrapped > -75 && lonWrapped < -12);
        let idx: number;
        if (ice) {
          b = Math.min(1, b + 0.18);
          idx = Math.floor(b * 10) + 2;
          colors[k] = b < 0.55 ? 9 : 10;
        } else {
          b = Math.min(1, Math.max(0.115, b));
          idx = Math.floor(b * 10);
          colors[k] = b < 0.3 ? 5 : b < 0.5 ? 6 : b < 0.75 ? 7 : 8;
        }
        chars[k] = RAMP.charCodeAt(Math.max(1, Math.min(9, idx)));
      } else {
        const shimmer = Math.sin(lon * 0.25 + time * 1.5) * Math.sin(lat * 0.2 - time * 0.9);
        const b = 0.1 + 0.8 * diffuse + 0.9 * this.glint[k] + 0.07 * diffuse * shimmer;
        if (b < 0.18) { chars[k] = 46; colors[k] = 1; }
        else if (b < 0.34) { chars[k] = 58; colors[k] = 2; }
        else if (b < 0.55) { chars[k] = 126; colors[k] = 3; }
        else { chars[k] = 126; colors[k] = 4; }
      }
    }
  }

  /** The current frame as plain text, one line per row. */
  toText(): string {
    const lines: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      let line = "";
      for (let c = 0; c < this.cols; c++) line += String.fromCharCode(this.chars[r * this.cols + c]);
      lines.push(line);
    }
    return lines.join("\n");
  }

  /**
   * The current frame as HTML for a <pre>. Runs of the same color share one span, and each
   * span reads its color from a --ag-* CSS variable. Only ASCII is emitted, so nothing needs escaping.
   */
  toHTML(): string {
    const { cols, rows, chars, colors } = this;
    const lines: string[] = [];
    for (let r = 0; r < rows; r++) {
      let line = "";
      let run = "";
      let current = 0;
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        const ch = chars[k];
        if (ch === 32) { run += " "; continue; }
        const color = colors[k];
        if (color !== current) {
          line += current ? SPAN_OPEN[current] + run + "</span>" : run;
          run = "";
          current = color;
        }
        run += String.fromCharCode(ch);
      }
      line += current ? SPAN_OPEN[current] + run + "</span>" : run;
      lines.push(line);
    }
    return lines.join("\n");
  }
}
