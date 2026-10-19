import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AsciiGlobe, PALETTES, PALETTE_NAMES } from "../components/ascii-globe";
import type { AsciiGlobeFrame, PaletteName } from "../components/ascii-globe";
import "./playground.css";

export function GlobePlayground() {
  const [palette, setPalette] = useState<PaletteName>("atlas");
  const [speed, setSpeed] = useState(1);
  const [tilt, setTilt] = useState(18);
  const [fontSize, setFontSize] = useState(11);
  const [interactive, setInteractive] = useState(true);
  const [paused, setPaused] = useState(false);
  const lonRef = useRef<HTMLSpanElement>(null);

  const p = PALETTES[palette];

  const snippet = useMemo(() => {
    const props = [`palette="${palette}"`];
    if (speed !== 1) props.push(`speed={${speed}}`);
    if (tilt !== 18) props.push(`tilt={${tilt}}`);
    if (fontSize !== 11) props.push(`fontSize={${fontSize}}`);
    if (interactive) props.push(`interactive`);
    if (paused) props.push(`paused`);
    return `<AsciiGlobe\n  ${props.join("\n  ")}\n/>`;
  }, [palette, speed, tilt, fontSize, interactive, paused]);

  // Written straight to the DOM so the page doesn't re-render every frame.
  const onFrame = (f: AsciiGlobeFrame) => {
    if (lonRef.current) {
      lonRef.current.textContent = `${Math.abs(f.longitude)}°${f.longitude < 0 ? "W" : "E"}`;
    }
  };

  return (
    <div className="pg">
      <aside className="pg-panel">
        <header className="pg-head">
          <h1>AsciiGlobe</h1>
          <p>A rotating Earth drawn in text. Pick a palette and tune the motion.</p>
        </header>

        <fieldset className="pg-group">
          <legend>Palette</legend>
          <div className="pg-themes">
            {PALETTE_NAMES.map((name) => (
              <label key={name} className="pg-theme" data-active={name === palette || undefined}>
                <input
                  type="radio"
                  name="palette"
                  value={name}
                  checked={name === palette}
                  onChange={() => setPalette(name)}
                />
                <span
                  className="pg-swatch"
                  style={{ background: PALETTES[name].bg, color: PALETTES[name].land[3] }}
                  aria-hidden
                >
                  @
                </span>
                {PALETTES[name].name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="pg-group">
          <legend>Motion</legend>
          <Range label="Speed" unit="×" min={-3} max={3} step={0.1} value={speed} onChange={setSpeed} />
          <Range label="Tilt" unit="°" min={-45} max={45} value={tilt} onChange={setTilt} />
          <Toggle label="Pause" checked={paused} onChange={setPaused} />
          <Toggle label="Drag to turn" checked={interactive} onChange={setInteractive} />
        </fieldset>

        <fieldset className="pg-group">
          <legend>Detail</legend>
          <Range label="Glyph size" unit="px" min={6} max={16} value={fontSize} onChange={setFontSize} />
        </fieldset>

        <pre className="pg-code">
          <code>{snippet}</code>
        </pre>

        <Link to="/login" className="pg-link">
          Open the Atlas sign-in page
        </Link>
      </aside>

      <main className="pg-stage" style={{ background: p.bg, color: p.muted }}>
        <div className="pg-globe">
          <AsciiGlobe
            palette={palette}
            speed={speed}
            tilt={tilt}
            fontSize={fontSize}
            interactive={interactive}
            paused={paused}
            onFrame={onFrame}
          />
        </div>
        <span ref={lonRef} className="pg-readout" aria-hidden />
      </main>
    </div>
  );
}

function Range(props: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="pg-range">
      <span className="pg-range-row">
        <span>{props.label}</span>
        <output>
          {props.value}
          {props.unit}
        </output>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="pg-toggle">
      <span>{props.label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  );
}
