'use client'
import { useState, useRef } from 'react'

type Color = 'cyan' | 'gold' | 'rose' | 'green'

const COLOR_MAP: Record<Color, string> = {
  cyan:  '#00f0ff',
  gold:  '#ffc832',
  rose:  '#ff3d6b',
  green: '#2dff6e',
}

interface ParamControlProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  color?: Color
  unit?: string
  formatDisplay?: (v: number) => string
  showSlider?: boolean  // when false the numeric input only is shown, no range slider
}

export function ParamControl({
  label, value, min, max, step, onChange,
  color = 'cyan', unit = '', formatDisplay, showSlider = false,
}: ParamControlProps) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const col = COLOR_MAP[color]

  // format a number as plain decimal (no exponential notation)
  const formatPlain = (v: number) => {
    // toLocaleString with fullwide prevents scientific notation for most values
    const s = v.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 20 });
    // strip trailing zeros after decimal
    return s.replace(/\.?0+$/, '');
  };

  const display = formatDisplay
    ? formatDisplay(value)
    : formatPlain(value);

  const commitRaw = () => {
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) {
      onChange(parsed)
      setEditing(false)
    } else {
      // Si la entrada no es un número (por ejemplo solo "-"), no cerrar
      // para que el usuario pueda completar el valor sin perderlo.
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  return (
    <div className="param-control">
      <div className="flex items-center justify-between mb-1 gap-2">
        <label className="text-xs text-gray-400 font-mono truncate flex-1">{label}</label>

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            defaultValue={formatPlain(value)}
            className="manual-input"
            style={{ color: col, borderColor: col, width: 110 }}
            onChange={e => setRaw(e.target.value)}
            onBlur={commitRaw}
            onKeyDown={e => { if (e.key === 'Enter') commitRaw(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => { setEditing(true); setRaw(String(value)) }}
            className="value-badge"
            style={{ color: col, borderColor: col + '55' }}
            title="Clic para editar manualmente"
          >
            {display} <span className="text-gray-500">{unit}</span>
          </button>
        )}
      </div>

      {showSlider && (
        <div className="slider-track" style={{ '--track-color': col } as React.CSSProperties}>
          <div
            className="slider-fill"
            style={{
              width: `${((value - min) / (max - min)) * 100}%`,
              background: col,
            }}
          />
          <input
            type="range"
            min={min} max={max} step={step}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="slider-input"
          />
          <div
            className="slider-thumb-dot"
            style={{
              left: `${((value - min) / (max - min)) * 100}%`,
              background: col,
              boxShadow: `0 0 8px ${col}`,
            }}
          />
        </div>
      )}
    </div>
  )
}

// ── Results panel ─────────────────────────────────────────────────────────────
interface ResultsProps {
  rows: { label: string; value: string; color?: Color }[]
}
export function ResultsPanel({ rows }: ResultsProps) {
  return (
    <div className="results-panel">
      {rows.map((r, i) => (
        <div key={i} className="result-row">
          <span className="result-label">{r.label}</span>
          <span className="result-val" style={{ color: r.color ? COLOR_MAP[r.color] : '#ffc832' }}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Formula box ───────────────────────────────────────────────────────────────
export function FormulaBox({ title, lines }: { title?: string; lines: string[] }) {
  return (
    <div className="formula-box-v2">
      {title && <div className="formula-title">{title}</div>}
      {lines.map((l, i) => <div key={i} className="formula-line">{l}</div>)}
    </div>
  )
}

// ── Playback controls ─────────────────────────────────────────────────────────
export function PlaybackControls({
  paused, onToggle, onReset, speed, onSpeed
}: {
  paused: boolean
  onToggle: () => void
  onReset: () => void
  speed: number
  onSpeed: (v: number) => void
}) {
  return (
    <div className="playback-bar">
      <button onClick={onToggle} className="play-btn">
        {paused ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <polygon points="3,1 13,7 3,13" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="4" height="12" />
            <rect x="8" y="1" width="4" height="12" />
          </svg>
        )}
        <span>{paused ? 'Play' : 'Pausa'}</span>
      </button>

      <button onClick={onReset} className="reset-btn" title="Reiniciar">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1a5 5 0 1 0 4.33 2.5L9 4a3.5 3.5 0 1 1-3-1.5V4l3-3-3-3v2A5 5 0 0 0 6 1z"/>
        </svg>
        Reset
      </button>

      <div className="speed-control">
        <span className="text-xs text-gray-500 font-mono">vel</span>
        {[0.25, 0.5, 1, 2, 4].map(s => (
          <button key={s} onClick={() => onSpeed(s)}
            className="speed-btn"
            style={{ color: speed === s ? '#00f0ff' : '#4a6a8a',
                     background: speed === s ? 'rgba(0,240,255,0.12)' : 'transparent' }}>
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Hint overlay for 3D ───────────────────────────────────────────────────────
export function OrbitHint() {
  return (
    <div className="orbit-hint">
      <span>🖱️ arrastrar rotar | Shift+🖱️ mover</span>
      <span>⚲ scroll zoom | 📱 2 dedos mover</span>
    </div>
  )
}
