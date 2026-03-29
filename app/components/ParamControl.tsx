'use client'

import { type CSSProperties, useRef, useState } from 'react'

type Color = 'cyan' | 'gold' | 'rose' | 'green'

const COLOR_MAP: Record<Color, string> = {
  cyan: '#00f0ff',
  gold: '#ffc832',
  rose: '#ff3d6b',
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
  tooltip?: string
  formatDisplay?: (v: number) => string
  showSlider?: boolean
}

export function ParamControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  color = 'cyan',
  unit = '',
  tooltip = '',
  formatDisplay,
  showSlider = false,
}: ParamControlProps) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const col = COLOR_MAP[color]

  const formatPlain = (current: number) => {
    const display = current.toLocaleString('fullwide', {
      useGrouping: false,
      maximumFractionDigits: 20,
    })
    if (!display.includes('.')) return display
    return display.replace(/0+$/, '').replace(/\.$/, '')
  }

  const display = formatDisplay ? formatDisplay(value) : formatPlain(value)

  const commitRaw = () => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      onChange(0)
      setRaw('0')
      setEditing(false)
      return
    }

    const parsed = parseFloat(trimmed)
    if (!Number.isNaN(parsed)) {
      onChange(parsed)
      setEditing(false)
      return
    }

    inputRef.current?.focus()
  }

  return (
    <div className="param-control">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          className="flex-1 truncate text-xs font-mono text-gray-400"
          title={tooltip || `Ajustar ${label.toLowerCase()}${unit ? ` (${unit})` : ''}`}
        >
          {label}
        </label>

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            defaultValue={formatPlain(value)}
            placeholder="0"
            className="manual-input"
            style={{ color: col, borderColor: col, width: 110 }}
            onChange={(event) => setRaw(event.target.value)}
            onBlur={commitRaw}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRaw()
              if (event.key === 'Escape') setEditing(false)
            }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setEditing(true)
              setRaw(String(value))
            }}
            className="value-badge"
            style={{ color: col, borderColor: `${col}55` }}
            title={tooltip ? `Valor actual: ${display} ${unit}. ${tooltip}. Clic para editar.` : 'Clic para editar manualmente'}
          >
            {display} <span className="text-gray-500">{unit}</span>
          </button>
        )}
      </div>

      {showSlider && (
        <div className="slider-track" style={{ '--track-color': col } as CSSProperties}>
          <div
            className="slider-fill"
            style={{
              width: `${((value - min) / (max - min)) * 100}%`,
              background: col,
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
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

interface ResultsProps {
  rows: { label: string; value: string; color?: Color }[]
}

export function ResultsPanel({ rows }: ResultsProps) {
  return (
    <div className="results-panel">
      {rows.map((row, index) => (
        <div key={index} className="result-row">
          <span className="result-label">{row.label}</span>
          <span className="result-val" style={{ color: row.color ? COLOR_MAP[row.color] : '#ffc832' }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function FormulaBox({ title, lines }: { title?: string; lines: string[] }) {
  return (
    <div className="formula-box-v2">
      {title && <div className="formula-title">{title}</div>}
      {lines.map((line, index) => (
        <div key={index} className="formula-line">{line}</div>
      ))}
    </div>
  )
}

export function PlaybackControls({
  paused,
  onToggle,
  onReset,
  speed,
  onSpeed,
}: {
  paused: boolean
  onToggle: () => void
  onReset: () => void
  speed: number
  onSpeed: (v: number) => void
}) {
  return (
    <div className="playback-bar">
      <button onClick={onToggle} className="play-btn" title={paused ? 'Iniciar o reanudar animacion' : 'Pausar animacion'}>
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

      <button onClick={onReset} className="reset-btn" title="Reiniciar simulacion">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1a5 5 0 1 0 4.33 2.5L9 4a3.5 3.5 0 1 1-3-1.5V4l3-3-3-3v2A5 5 0 0 0 6 1z" />
        </svg>
        Reset
      </button>

      <div className="speed-control">
        <span className="text-xs font-mono text-gray-500">vel</span>
        {[0.25, 0.5, 1, 2, 4].map((currentSpeed) => (
          <button
            key={currentSpeed}
            onClick={() => onSpeed(currentSpeed)}
            className="speed-btn"
            style={{
              color: speed === currentSpeed ? '#00f0ff' : '#4a6a8a',
              background: speed === currentSpeed ? 'rgba(0,240,255,0.12)' : 'transparent',
            }}
            title={`Velocidad de animacion x${currentSpeed}`}
          >
            {currentSpeed}x
          </button>
        ))}
      </div>
    </div>
  )
}

export function OrbitHint() {
  return (
    <div className="orbit-hint">
      <span>arrastrar = rotar | shift + arrastrar = mover</span>
      <span>scroll = zoom | dos dedos = mover</span>
    </div>
  )
}
