'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  createScene,
  handleResize,
  createArrow,
  createParticle,
  ParticleTrail,
  C,
  createFieldArrows,
  makeSprite,
  disposeGroup,
} from '@/app/lib/three-utils'
import {
  ParamControl,
  ResultsPanel,
  FormulaBox,
  PlaybackControls,
  OrbitHint,
  SimulationSection,
  SectionHint,
} from '@/app/components/ParamControl'
import { circularMotion, ELECTRON_CHARGE, PROTON_MASS } from '@/app/lib/physics'

const EXERCISE_PRESETS = [
  {
    name: 'Ej 1',
    q: ELECTRON_CHARGE,
    m: PROTON_MASS,
    v: 2.5e6,
    B: 0.8,
    note: 'Caso base: carga positiva con v perpendicular a B. La trayectoria es circular y se caracteriza con F, r, T y f.',
  },
  {
    name: 'Ej 3',
    q: 2 * ELECTRON_CHARGE,
    m: 4 * PROTON_MASS,
    v: 3.8e5,
    B: 1.0,
    note: 'Particula alfa. La magnitud esperada es |F| = 1.216e-13 N. La direccion se analiza con la regla de la mano derecha.',
  },
  {
    name: 'Ej 5',
    q: ELECTRON_CHARGE,
    m: PROTON_MASS,
    v: 6.2e6,
    B: 0.5e-4,
    note: 'Proton en el campo terrestre. Debe dar |F| = 4.96e-17 N y r = 1.294e3 m.',
  },
]

const DEFAULT_PRESET = EXERCISE_PRESETS[2]

const ORBIT_R = 2.6
const F_REF = ELECTRON_CHARGE * 6.2e6 * 0.5e-4

const formatExp = (value: number, digits = 2) => value.toExponential(digits)

export default function CircularMotionSim() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)

  const [q, setQ] = useState(DEFAULT_PRESET.q)
  const [m, setM] = useState(DEFAULT_PRESET.m)
  const [v, setV] = useState(DEFAULT_PRESET.v)
  const [B, setB] = useState(DEFAULT_PRESET.B)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showHelp, setShowHelp] = useState(false)
  const [showReadout, setShowReadout] = useState(false)
  const [activePreset, setActivePreset] = useState(DEFAULT_PRESET.name)
  const [presetNote, setPresetNote] = useState(DEFAULT_PRESET.note)

  const result = circularMotion(q, m, v, B)
  const trajectoryLabel = Math.abs(q) > 0 && Math.abs(v) > 0 && Math.abs(B) > 0 ? 'circular uniforme' : 'rectilinea'
  const resultRows = [
    { label: 'trayectoria', value: trajectoryLabel, color: 'green' as const },
    { label: 'q', value: `${q.toExponential(2)} C`, color: 'cyan' as const },
    { label: 'F = |q|vB', value: `${result.F.toExponential(3)} N`, color: 'gold' as const },
    { label: 'r = mv/(|q|B)', value: `${result.r.toExponential(3)} m`, color: 'cyan' as const },
    { label: 'T', value: `${result.T.toExponential(3)} s`, color: 'rose' as const },
    { label: 'f', value: `${result.f.toExponential(3)} Hz`, color: 'green' as const },
  ]

  const screenRows = [
    { label: 'q', value: `${formatExp(q)} C`, color: 'var(--cyan)' },
    { label: 'm', value: `${formatExp(m)} kg`, color: 'var(--gold)' },
    { label: 'v', value: `${formatExp(v)} m/s`, color: 'var(--rose)' },
    { label: 'B', value: `${formatExp(B)} T`, color: 'var(--cyan)' },
    { label: 'F', value: `${formatExp(result.F, 3)} N`, color: 'var(--gold)' },
    { label: 'r', value: `${formatExp(result.r, 3)} m`, color: 'var(--cyan)' },
    { label: 'T', value: `${formatExp(result.T, 3)} s`, color: 'var(--rose)' },
    { label: 'f', value: `${formatExp(result.f, 3)} Hz`, color: 'var(--green)' },
  ]

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    mount.appendChild(canvas)

    const { renderer, scene, camera, controls } = createScene(canvas, {
      axes: { size: 3.2, color: 0xffffff, labelColor: '#ffffff' },
    })

    controls._spherical.set(12, 1.0, 0.45)
    controls.update()

    const particle = createParticle(C.cyan, 0.15)
    scene.add(particle)
    const trail = new ParticleTrail(scene, 500, C.cyan)
    const ptLight = new THREE.PointLight(C.cyan, 1.5, 7)
    scene.add(ptLight)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ORBIT_R, 0.013, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0x1a3a5a, transparent: true, opacity: 0.5 })
    )
    ring.rotation.x = Math.PI / 2
    scene.add(ring)

    scene.add(createFieldArrows(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 4.5, 1.2, 0x1a4060, 0.55))

    const bArrow = createArrow(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 2.0, C.rose, 0.15, 0.032)
    const bLabel = makeSprite('B', '#ff3d6b', 0.5)
    scene.add(bArrow, bLabel)

    let arrowV: THREE.Group | null = null
    let arrowF: THREE.Group | null = null
    let lblV: THREE.Sprite | null = null
    let lblF: THREE.Sprite | null = null

    sceneRef.current = {
      paused: false,
      speed: 1,
      angle: 0,
      sign: Math.sign(q) || 1,
      vLen: 1.6,
      fLen: 1.0,
      reset: () => {
        sceneRef.current.angle = 0
        trail.clear()
      },
    }

    let lastTime = performance.now()
    let animId = 0

    const animate = () => {
      animId = requestAnimationFrame(animate)
      handleResize(canvas, renderer, camera)

      const sceneState = sceneRef.current
      if (!sceneState) return

      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.05) * sceneState.speed
      lastTime = now

      if (!sceneState.paused) {
        sceneState.angle += 2 * Math.PI * 0.28 * dt * sceneState.sign
      }

      const angle = sceneState.angle
      particle.position.set(ORBIT_R * Math.cos(angle), 0, ORBIT_R * Math.sin(angle))
      ptLight.position.copy(particle.position)
      trail.push(particle.position)

      const velDir = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(sceneState.sign)
      const frcDir = new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle))

      disposeGroup(scene, arrowV)
      disposeGroup(scene, arrowF)
      if (lblV) scene.remove(lblV)
      if (lblF) scene.remove(lblF)

      arrowV = createArrow(velDir, particle.position.clone(), sceneState.vLen, C.cyan, 0.18, 0.03)
      arrowF = createArrow(frcDir, particle.position.clone(), sceneState.fLen, C.gold, 0.2, 0.03)
      lblV = makeSprite('v', '#00f0ff', 0.48)
      lblF = makeSprite('F', '#ffc832', 0.48)
      lblV.position.copy(particle.position.clone().addScaledVector(velDir, sceneState.vLen + 0.4))
      lblF.position.copy(particle.position.clone().addScaledVector(frcDir, sceneState.fLen + 0.4))

      bArrow.position.copy(particle.position)
      bLabel.position.set(particle.position.x, particle.position.y + 2.4, particle.position.z)
      scene.add(arrowV, arrowF, lblV, lblF)

      controls.update()
      renderer.render(scene, camera)
    }

    requestAnimationFrame(() => handleResize(canvas, renderer, camera))
    animate()

    const ro = new ResizeObserver(() => handleResize(canvas, renderer, camera))
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(animId)
      controls.dispose()
      trail.dispose()
      renderer.dispose()
      ro.disconnect()
      mount.removeChild(canvas)
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.paused = paused
  }, [paused])

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.speed = speed
  }, [speed])

  useEffect(() => {
    if (!sceneRef.current) return
    sceneRef.current.vLen = 1.6
    sceneRef.current.fLen = Math.max(0.35, Math.min(2.4, result.F / F_REF))
    sceneRef.current.sign = Math.sign(q) || 1
  }, [q, result.F])

  return (
    <div>
      <FormulaBox
        title="Movimiento circular en B uniforme"
        lines={[
          'F = q(v x B)   |   r = mv / (|q|B)   |   f = |q|B / (2*pi*m)',
          'Presets de la guia: Ej 1, Ej 3 y Ej 5. Los ejes blancos solo son referencia espacial.',
        ]}
      />

      <div
        style={{
          marginBottom: 12,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text)',
          lineHeight: 1.7,
        }}
      >
        En esta simulacion, los ejes X, Y y Z se muestran en blanco para que funcionen como referencia y no compitan con los vectores fisicos principales.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)' }}>Ejercicios de la guia:</span>
        {EXERCISE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => {
              setQ(preset.q)
              setM(preset.m)
              setV(preset.v)
              setB(preset.B)
              setActivePreset(preset.name)
              setPresetNote(preset.note)
              sceneRef.current?.reset()
            }}
            title={preset.note}
            style={{
              padding: '2px 8px',
              borderRadius: 5,
              fontSize: 10,
              fontFamily: 'monospace',
              background: activePreset === preset.name ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${activePreset === preset.name ? 'var(--cyan)' : '#1e3a5f'}`,
              color: activePreset === preset.name ? 'var(--cyan)' : '#84b9d8',
              cursor: 'pointer',
            }}
          >
            {preset.name}
          </button>
        ))}

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginLeft: 'auto',
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

      <div
        style={{
          marginBottom: 12,
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgba(0,240,255,0.04)',
          border: '1px solid rgba(0,240,255,0.14)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text)',
          lineHeight: 1.7,
        }}
      >
        {presetNote}
      </div>

      {showHelp && (
        <div
          style={{
            marginBottom: 12,
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
          <div style={{ color: 'var(--cyan)', fontWeight: 700, marginBottom: 6 }}>Ecuaciones utilizadas</div>
          <div><span style={{ color: 'var(--gold)' }}>1.</span> Fuerza magnetica: F = |q|vB</div>
          <div><span style={{ color: 'var(--gold)' }}>2.</span> Radio de la orbita: r = mv / (|q|B)</div>
          <div><span style={{ color: 'var(--gold)' }}>3.</span> Periodo: T = 2*pi*m / (|q|B)</div>
          <div><span style={{ color: 'var(--gold)' }}>4.</span> Frecuencia ciclotronica: f = |q|B / (2*pi*m)</div>
          <div style={{ marginTop: 6, color: 'var(--muted)' }}>
            La trayectoria es circular porque la fuerza magnetica es perpendicular a la velocidad. El periodo no depende de v, pero el radio si.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 'clamp(300px, 80vw, 500px)',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--border2)',
            background: '#020609',
          }}
        >
          <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
          <OrbitHint />

          {showReadout && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                minWidth: 220,
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
                  <span style={{ color: row.color, fontWeight: 700 }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sim-panel-grid">
          <SimulationSection
            label="Entradas"
            title="Parametros que modificas"
            description="Estos valores alimentan la simulacion. Cada cambio actualiza la orbita y el sentido de giro."
            tone="inputs"
          >
            <SectionHint tone="inputs">Ajusta q, m, v y B. Los controles de animacion quedan en esta misma zona porque no son resultados fisicos.</SectionHint>

            <ParamControl
              label="q"
              value={q}
              min={-3.2e-19}
              max={3.2e-19}
              step={1e-20}
              onChange={setQ}
              color="cyan"
              unit="C"
              formatDisplay={(value) => value.toExponential(2)}
              showSlider={false}
              tooltip="Carga electrica q. Negativa = electron; positiva = proton o ion. Cambia el sentido de giro."
            />
            <ParamControl
              label="m"
              value={m}
              min={9.11e-31}
              max={3e-26}
              step={5e-29}
              onChange={setM}
              color="gold"
              unit="kg"
              formatDisplay={(value) => value.toExponential(2)}
              showSlider={false}
              tooltip="Masa de la particula. Si m aumenta, tambien aumentan el radio y el periodo."
            />
            <ParamControl
              label="v"
              value={v}
              min={1e4}
              max={5e7}
              step={1e5}
              onChange={setV}
              color="rose"
              unit="m/s"
              formatDisplay={(value) => value.toExponential(2)}
              showSlider={false}
              tooltip="Velocidad inicial. Aumenta la fuerza magnetica y el radio r, pero no cambia el periodo T."
            />
            <ParamControl
              label="B"
              value={B}
              min={1e-5}
              max={5}
              step={1e-4}
              onChange={setB}
              color="cyan"
              unit="T"
              formatDisplay={(value) => value.toExponential(2)}
              showSlider={false}
              tooltip="Campo magnetico uniforme. Si B aumenta, la orbita se cierra y la frecuencia crece."
            />

            <div style={{ marginTop: 10 }}>
              <div className="section-label" style={{ marginTop: 0 }}>
                Control de animacion
              </div>
              <PlaybackControls
                paused={paused}
                onToggle={() => setPaused((prev) => !prev)}
                onReset={() => sceneRef.current?.reset()}
                speed={speed}
                onSpeed={setSpeed}
              />
            </div>
          </SimulationSection>

          <SimulationSection
            label="Resultados"
            title="Magnitudes calculadas"
            description="Estas salidas se recalculan automaticamente a partir de las entradas actuales."
            tone="results"
          >
            <SectionHint tone="results">La trayectoria, la fuerza, el radio, el periodo y la frecuencia se muestran aparte para que no se confundan con los datos de entrada.</SectionHint>
            <ResultsPanel rows={resultRows} />
          </SimulationSection>
        </div>
      </div>
    </div>
  )
}
