'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createScene, handleResize, createArrow, C, disposeGroup, makeSprite } from '@/app/lib/three-utils'
import { ParamControl, ResultsPanel, FormulaBox, OrbitHint, SimulationSection, SectionHint } from '@/app/components/ParamControl'
import { vec3, cross, scale, magnitude, add, ELECTRON_CHARGE, Vec3 } from '@/app/lib/physics'

interface LorentzPreset {
  name: string
  note: string
  values: {
    q: number
    vx: number
    vy: number
    vz: number
    Bx: number
    By: number
    Bz: number
    Ex: number
    Ey: number
    Ez: number
  }
}

const EXERCISE_PRESETS: LorentzPreset[] = [
  {
    name: 'Ej 2',
    note: 'Con el electron moviendose en +x y la desviacion en +y, el campo magnetico debe apuntar en +z.',
    values: { q: -1, vx: 8e5, vy: 0, vz: 0, Bx: 0, By: 0, Bz: 2e-5, Ex: 0, Ey: 0, Ez: 0 },
  },
  {
    name: 'Ej 3',
    note: 'Particula alfa: v al norte (+y), B al este (+x). Debe dar F = -1.216e-13 k N y |F| = 1.216e-13 N.',
    values: { q: 2, vx: 0, vy: 3.8e5, vz: 0, Bx: 1.0, By: 0, Bz: 0, Ex: 0, Ey: 0, Ez: 0 },
  },
  {
    name: 'Ej 4',
    note: 'Electron en B = (4i - 11j) T y v = (-2i + 3j - 7k) m/s. Debe dar F = (1.232e-17 i + 4.48e-18 j - 1.60e-18 k) N.',
    values: { q: -1, vx: -2, vy: 3, vz: -7, Bx: 4, By: -11, Bz: 0, Ex: 0, Ey: 0, Ez: 0 },
  },
  {
    name: 'Ej 5',
    note: 'Proton hacia el oeste (-x) en un campo terrestre hacia el sur (-y). La fuerza queda en +z y su modulo es 4.96e-17 N.',
    values: { q: 1, vx: -6.2e6, vy: 0, vz: 0, Bx: 0, By: -0.5e-4, Bz: 0, Ex: 0, Ey: 0, Ez: 0 },
  },
  {
    name: 'Ej 6',
    note: 'Con q = 3.2e-19 C = 2e, debe dar F = (3.52e-18 i - 1.60e-18 j + 0k) N y un angulo XY de -24.44 deg.',
    values: { q: 2, vx: 2, vy: 3, vz: -1, Bx: 2, By: 4, Bz: 1, Ex: 4, Ey: -1, Ez: -2 },
  },
]

const GUIDED_PRESETS: LorentzPreset[] = [
  {
    name: 'Solo B',
    note: 'La fuerza magnetica aparece perpendicular a v y a B.',
    values: { q: 1, vx: 8e5, vy: 0, vz: 0, Bx: 0, By: 0, Bz: 2e-5, Ex: 0, Ey: 0, Ez: 0 },
  },
  {
    name: 'Solo E',
    note: 'Si B = 0, la fuerza total coincide con qE.',
    values: { q: 1, vx: 0, vy: 0, vz: 0, Bx: 0, By: 0, Bz: 0, Ex: 8, Ey: 0, Ez: 0 },
  },
  {
    name: 'Balance E-B',
    note: 'Con q > 0, E puede compensar a q(v x B) y hacer F total = 0.',
    values: { q: 1, vx: 8e5, vy: 0, vz: 0, Bx: 0, By: 0, Bz: 2e-5, Ex: 0, Ey: 16, Ez: 0 },
  },
  {
    name: 'v paralela B',
    note: 'Si v es paralela a B, entonces v x B = 0.',
    values: { q: 1, vx: 0, vy: 0, vz: 8e5, Bx: 0, By: 0, Bz: 2e-5, Ex: 0, Ey: 0, Ez: 0 },
  },
]

const DEFAULT_NOTE = 'Usa los botones Ej 2 a Ej 6 para cargar directamente los problemas vectoriales de la guia.'

function toSexagesimal(angle: number) {
  const sign = angle < 0 ? '-' : ''
  const abs = Math.abs(angle)
  const deg = Math.floor(abs)
  const minFloat = (abs - deg) * 60
  const min = Math.floor(minFloat)
  const sec = Math.round((minFloat - min) * 60)
  return `${sign}${deg} deg ${min}' ${sec}"`
}

function safeNumber(value: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return 0
  return value
}

export default function LorentzVectorSim() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)

  const [q, setQ] = useState(1)
  const [vx, setVx] = useState(8e5)
  const [vy, setVy] = useState(0)
  const [vz, setVz] = useState(0)
  const [Bx, setBx] = useState(0)
  const [By, setBy] = useState(0)
  const [Bz, setBz] = useState(2e-5)
  const [Ex, setEx] = useState(0)
  const [Ey, setEy] = useState(0)
  const [Ez, setEz] = useState(0)
  const [presetNote, setPresetNote] = useState(DEFAULT_NOTE)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showReadout, setShowReadout] = useState(false)

  const vV: Vec3 = vec3(safeNumber(vx), safeNumber(vy), safeNumber(vz))
  const BV: Vec3 = vec3(safeNumber(Bx), safeNumber(By), safeNumber(Bz))
  const EV: Vec3 = vec3(safeNumber(Ex), safeNumber(Ey), safeNumber(Ez))

  const charge = q * ELECTRON_CHARGE
  const vxB = cross(vV, BV)
  const Fm = scale(vxB, charge)
  const Fe = scale(EV, charge)
  const FV = add(Fm, Fe)
  const Fmag = magnitude(FV)
  const angleXYdeg = Math.atan2(FV.y, FV.x) * 180 / Math.PI
  const angleXYsex = toSexagesimal(angleXYdeg)
  const fmt = (value: Vec3) => `(${value.x.toExponential(2)}, ${value.y.toExponential(2)}, ${value.z.toExponential(2)})`
  const resultRows = [
    { label: 'v', value: fmt(vV), color: 'cyan' as const },
    { label: 'B', value: fmt(BV), color: 'rose' as const },
    { label: 'E', value: fmt(EV), color: 'cyan' as const },
    { label: 'v x B', value: fmt(vxB), color: 'gold' as const },
    { label: 'Fm = q(v x B)', value: fmt(Fm), color: 'rose' as const },
    { label: 'Fe = qE', value: fmt(Fe), color: 'cyan' as const },
    { label: 'F total', value: fmt(FV), color: 'gold' as const },
    { label: '|F|', value: `${Fmag.toExponential(3)} N`, color: 'green' as const },
    { label: 'angulo en XY', value: `${angleXYdeg.toFixed(2)} deg (${angleXYsex})`, color: 'cyan' as const },
  ]
  const screenRows = [
    { label: 'q/e', value: q.toFixed(0), color: 'var(--rose)' },
    { label: 'v', value: fmt(vV), color: 'var(--cyan)' },
    { label: 'B', value: fmt(BV), color: 'var(--rose)' },
    { label: 'E', value: fmt(EV), color: 'var(--cyan)' },
    { label: 'v x B', value: fmt(vxB), color: 'var(--gold)' },
    { label: 'Fm', value: fmt(Fm), color: 'var(--rose)' },
    { label: 'Fe', value: fmt(Fe), color: 'var(--cyan)' },
    { label: 'F', value: fmt(FV), color: 'var(--gold)' },
    { label: '|F|', value: `${Fmag.toExponential(3)} N`, color: 'var(--green)' },
  ]

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    mount.appendChild(canvas)

    const { renderer, scene, camera, controls } = createScene(canvas, {
      axes: { size: 3.2, color: 0xffffff, labelColor: '#ffffff' },
    })
    sceneRef.current = { scene, renderer, camera, controls }

    let animId = 0
    const loop = () => {
      animId = requestAnimationFrame(loop)
      handleResize(canvas, renderer, camera)
      controls.update()
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      controls.dispose()
      mount.removeChild(canvas)
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const sceneState = sceneRef.current
    if (!sceneState) return

    const { scene } = sceneState
    scene.children
      .filter((child: THREE.Object3D) => child.userData?.isVec)
      .forEach((child: THREE.Object3D) => disposeGroup(scene, child))

    const vecs = [
      { v: vV, color: C.cyan, lbl: 'v' },
      { v: BV, color: C.rose, lbl: 'B' },
      { v: EV, color: C.blue, lbl: 'E' },
      { v: Fm, color: 0xff4444, lbl: 'Fm' },
      { v: Fe, color: 0x4488ff, lbl: 'Fe' },
      { v: FV, color: C.gold, lbl: 'F' },
    ]

    const maxMag = Math.max(...vecs.map((entry) => magnitude(entry.v)), 0.001)

    vecs.forEach(({ v, color, lbl }) => {
      const mag = magnitude(v)
      if (mag < 0.0001) return

      const len = 3.5 * (mag / maxMag)
      const dir = new THREE.Vector3(v.x, v.y, v.z).normalize()
      const arrow = createArrow(dir, new THREE.Vector3(0, 0, 0), len, color, 0.18, 0.033)
      arrow.userData.isVec = true

      const sprite = makeSprite(lbl, `#${color.toString(16).padStart(6, '0')}`, 0.5)
      sprite.position.copy(dir.clone().multiplyScalar(len + 0.4))
      sprite.userData.isVec = true

      scene.add(arrow)
      scene.add(sprite)
    })
  }, [vV, BV, EV, Fm, Fe, FV])

  const applyPreset = (preset: LorentzPreset) => {
    const { values } = preset
    setQ(values.q)
    setVx(values.vx)
    setVy(values.vy)
    setVz(values.vz)
    setBx(values.Bx)
    setBy(values.By)
    setBz(values.Bz)
    setEx(values.Ex)
    setEy(values.Ey)
    setEz(values.Ez)
    setPresetNote(preset.note)
    setSelectedPreset(preset.name)
  }

  return (
    <div>
      <FormulaBox
        title="Fuerza de Lorentz"
        lines={[
          'F = q(E + v x B)',
          'Entradas del alumno: q, v, B y E. Observa como cambian Fm, Fe y F total.',
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Que cambia el alumno
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text)' }}>
            q/e, las tres componentes de v, las tres componentes de B y las tres componentes de E.
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Que debe mirar
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text)' }}>
            Como se construye v x B, cuando Fm desaparece, cuando E compensa al termino magnetico y hacia donde apunta F total.
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.16)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Convencion para la guia
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text)' }}>
            Usa +x = este, +y = norte y +z = arriba para interpretar los ejercicios de direccion y sentido.
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid #1e3a5f',
              background: 'rgba(0,0,0,0.35)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <input
              type="checkbox"
              checked={showReadout}
              onChange={(event) => setShowReadout(event.target.checked)}
              style={{ accentColor: 'var(--cyan)' }}
            />
            Mostrar valores en pantalla
          </label>

          <button
            onClick={() => setShowHelp((prev) => !prev)}
            style={{
              padding: '3px 10px',
              borderRadius: 5,
              fontSize: 10,
              fontFamily: 'monospace',
              background: showHelp ? 'rgba(0,240,255,0.15)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${showHelp ? 'var(--cyan)' : '#1e3a5f'}`,
              color: showHelp ? 'var(--cyan)' : '#4a90b0',
              cursor: 'pointer',
            }}
          >
            ? Ayuda
          </button>
        </div>

        {showHelp && (
          <div
            style={{
              marginBottom: 10,
              padding: '12px 14px',
              background: 'rgba(0,240,255,0.04)',
              border: '1px solid rgba(0,240,255,0.2)',
              borderRadius: 10,
              fontSize: 11,
              fontFamily: 'monospace',
              lineHeight: 2,
              color: 'var(--text)',
            }}
          >
            <div style={{ color: 'var(--cyan)', fontWeight: 700, marginBottom: 4 }}>Ecuaciones utilizadas</div>
            <div><span style={{ color: 'var(--gold)' }}>1.</span> Fuerza total: F = q(E + v x B)</div>
            <div><span style={{ color: 'var(--gold)' }}>2.</span> Parte magnetica: Fm = q(v x B)</div>
            <div><span style={{ color: 'var(--gold)' }}>3.</span> Parte electrica: Fe = qE</div>
            <div style={{ marginTop: 6, color: 'var(--muted)' }}>
              Proba primero con un solo campo activo y despues compara cuando Fe y Fm se suman o se compensan.
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
          Ejercicios de la guia
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EXERCISE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: selectedPreset === preset.name ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0.35)',
                border: `1px solid ${selectedPreset === preset.name ? 'var(--cyan)' : '#1e3a5f'}`,
                color: selectedPreset === preset.name ? 'var(--cyan)' : '#84b9d8',
                cursor: 'pointer',
              }}
              title={preset.note}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '10px 0 5px' }}>
          Casos guiados
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {GUIDED_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: selectedPreset === preset.name ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0.35)',
                border: `1px solid ${selectedPreset === preset.name ? 'var(--cyan)' : '#1e3a5f'}`,
                color: selectedPreset === preset.name ? 'var(--cyan)' : '#84b9d8',
                cursor: 'pointer',
              }}
              title={preset.note}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(0,240,255,0.04)',
            border: '1px solid rgba(0,240,255,0.14)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text)',
          }}
        >
          {presetNote}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '420px' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
        <OrbitHint />
        {showReadout && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              minWidth: 260,
              maxWidth: 'min(320px, calc(100% - 20px))',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(2,6,9,0.88)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(6px)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                marginBottom: 6,
                color: 'var(--cyan)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Valores en pantalla
            </div>
            {screenRows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  padding: '3px 0',
                }}
              >
                <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                <span style={{ color: row.color, fontWeight: 700, textAlign: 'right' }}>{row.value}</span>
              </div>
            ))}
            <div
              style={{
                marginTop: 4,
                paddingTop: 6,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>angulo XY</span>
              <span style={{ color: 'var(--cyan)', fontWeight: 700, textAlign: 'right' }}>
                {angleXYdeg.toFixed(2)} deg
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="sim-panel-grid" style={{ marginTop: 10 }}>
        <SimulationSection
          label="Entradas"
          title="Datos que cargas"
          description="Definis la carga y las componentes de v, B y E. Esta columna solo contiene valores de entrada."
          tone="inputs"
        >
          <SectionHint tone="inputs">Primero ajustas las variables del problema. El visor y la columna de resultados se recalculan con estas entradas.</SectionHint>

          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            1. Carga
          </div>
          <ParamControl
            label="q/e"
            value={safeNumber(q)}
            min={-10}
            max={10}
            step={1}
            onChange={(value) => setQ(safeNumber(value))}
            color="rose"
            tooltip="Carga en multiplos de la carga elemental. El signo cambia el sentido de la fuerza."
          />

          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '10px 0 4px' }}>
            2. Velocidad v
          </div>
          <ParamControl label="vx (m/s)" value={safeNumber(vx)} min={-1_000_000} max={1_000_000} step={1000} onChange={(value) => setVx(safeNumber(value))} color="cyan" tooltip="Componente x de la velocidad." />
          <ParamControl label="vy (m/s)" value={safeNumber(vy)} min={-1_000_000} max={1_000_000} step={1000} onChange={(value) => setVy(safeNumber(value))} color="cyan" tooltip="Componente y de la velocidad." />
          <ParamControl label="vz (m/s)" value={safeNumber(vz)} min={-1_000_000} max={1_000_000} step={1000} onChange={(value) => setVz(safeNumber(value))} color="cyan" tooltip="Componente z de la velocidad." />

          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '10px 0 4px' }}>
            3. Campo magnetico B
          </div>
          <ParamControl label="Bx (T)" value={safeNumber(Bx)} min={-20} max={20} step={0.5} onChange={(value) => setBx(safeNumber(value))} color="rose" tooltip="Componente x del campo magnetico." />
          <ParamControl label="By (T)" value={safeNumber(By)} min={-20} max={20} step={0.5} onChange={(value) => setBy(safeNumber(value))} color="rose" tooltip="Componente y del campo magnetico." />
          <ParamControl label="Bz (T)" value={safeNumber(Bz)} min={-20} max={20} step={0.5} onChange={(value) => setBz(safeNumber(value))} color="rose" tooltip="Componente z del campo magnetico." />

          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '10px 0 4px' }}>
            4. Campo electrico E
          </div>
          <ParamControl label="Ex (N/C)" value={safeNumber(Ex)} min={-20} max={20} step={0.5} onChange={(value) => setEx(safeNumber(value))} color="gold" tooltip="Componente x del campo electrico." />
          <ParamControl label="Ey (N/C)" value={safeNumber(Ey)} min={-20} max={20} step={0.5} onChange={(value) => setEy(safeNumber(value))} color="gold" tooltip="Componente y del campo electrico." />
          <ParamControl label="Ez (N/C)" value={safeNumber(Ez)} min={-20} max={20} step={0.5} onChange={(value) => setEz(safeNumber(value))} color="gold" tooltip="Componente z del campo electrico." />
        </SimulationSection>

        <SimulationSection
          label="Resultados"
          title="Fuerzas y lectura vectorial"
          description="Esta columna muestra solo salidas calculadas: productos vectoriales, fuerzas y angulos."
          tone="results"
        >
          <SectionHint tone="results">Usa esta zona para leer lo que produce la simulacion. Si cambias una entrada, estos valores cambian solos.</SectionHint>

          <ResultsPanel rows={resultRows} />

          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: 1.8,
              color: 'var(--text)',
            }}
          >
            <div style={{ color: 'var(--cyan)', marginBottom: 4 }}>Lectura rapida</div>
            <div>Si B = 0, solo queda la fuerza electrica.</div>
            <div>Si E = 0, solo queda la fuerza magnetica.</div>
            <div>Si v es paralela a B, entonces v x B = 0.</div>
            <div>Si Fe y Fm son opuestas e iguales, la fuerza total se anula.</div>
          </div>
        </SimulationSection>
      </div>
    </div>
  )
}
