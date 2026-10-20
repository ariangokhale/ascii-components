import { useEffect, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { AsciiGlobe, PALETTES, PALETTE_NAMES } from "../ascii-globe";
import type { PaletteName } from "../ascii-globe";
import "./atlas-login.css";

export type AtlasLoginProps = {
  /** Wordmark shown beside the globe. */
  title?: string;
  /** Called by the Login button. Return a promise to show a pending state; throw to show an error. */
  onLogin: () => void | Promise<void>;
  /** Palette used before the visitor picks one. */
  defaultPalette?: PaletteName;
  /** Palettes offered as theme swatches, in order. */
  palettes?: PaletteName[];
  /** localStorage key that remembers the chosen palette. Pass null to not remember it. */
  storageKey?: string | null;
};

const SPINNER = ["|", "/", "-", "\\"];

function readStored(key: string | null, allowed: PaletteName[]): PaletteName | null {
  if (!key) return null;
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as string[]).includes(v) ? (v as PaletteName) : null;
  } catch {
    return null;
  }
}

export function AtlasLogin({
  title = "ATLAS",
  onLogin,
  defaultPalette = "atlas",
  palettes = PALETTE_NAMES,
  storageKey = "atlas-login-palette",
}: AtlasLoginProps) {
  const [palette, setPalette] = useState<PaletteName>(
    () => readStored(storageKey, palettes) ?? defaultPalette,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const p = PALETTES[palette];

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, palette);
    } catch {
      /* storage unavailable */
    }
  }, [palette, storageKey]);

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setTick((n) => n + 1), 110);
    return () => clearInterval(t);
  }, [pending]);

  const login = async () => {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setPending(false);
    }
  };

  // Arrow keys move between swatches, like a native radio group.
  const onSwatchKey = (e: KeyboardEvent<HTMLButtonElement>, name: PaletteName) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = (palettes.indexOf(name) + step + palettes.length) % palettes.length;
    setPalette(palettes[i]);
    (e.currentTarget.parentElement?.children[i] as HTMLElement | undefined)?.focus();
  };

  const vars = {
    "--al-bg": p.bg,
    "--al-fg": p.fg,
    "--al-muted": p.muted,
    "--al-rule": p.rule,
    "--al-accent": p.accent,
    colorScheme: "light" in p && p.light ? "light" : "dark",
  } as CSSProperties;

  return (
    <main className="al" style={vars}>
      <div className="al-globe">
        <AsciiGlobe palette={palette} speed={0.6} tilt={20} initialLongitude={-40} interactive decorative />
      </div>

      <div className="al-panel">
        <h1 className="al-title">{title}</h1>

        <button type="button" className="al-login" onClick={login} disabled={pending}>
          {pending ? (
            <>
              <span className="al-spin" aria-hidden>
                {SPINNER[tick % SPINNER.length]}
              </span>
              Logging in
            </>
          ) : (
            "Login"
          )}
        </button>

        <div className="al-themes" role="radiogroup" aria-label="Theme">
          {palettes.map((name) => {
            const sw = PALETTES[name];
            const selected = name === palette;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={sw.name}
                title={sw.name}
                tabIndex={selected ? 0 : -1}
                className="al-swatch"
                style={
                  {
                    "--sw-bg": sw.bg,
                    "--sw-land": sw.land[2],
                    "--sw-ocean": sw.ocean[2],
                  } as CSSProperties
                }
                onClick={() => setPalette(name)}
                onKeyDown={(e) => onSwatchKey(e, name)}
              />
            );
          })}
        </div>

        <p className="al-error" role="alert">
          {error}
        </p>
      </div>
    </main>
  );
}
