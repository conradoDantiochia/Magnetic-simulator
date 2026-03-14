'use client'
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { createScene, handleResize, createArrow, createParticle, ParticleTrail, C, createFieldArrows, makeSprite, disposeGroup } from '@/app/lib/three-utils'
import { ParamControl, ResultsPanel, FormulaBox, PlaybackControls, OrbitHint } from '@/app/components/ParamControl'
import { circularMotion, ELECTRON_CHARGE, PROTON_MASS } from '@/app/lib/physics'

const PRESETS = [
  { name: 'Proton (P5)',  q: ELECTRON_CHARGE,    m: PROTON_MASS,   v: 6.2e6, B: 0.5e-4 },
  { name: 'Alfa (P3)',    q: 2*ELECTRON_CHARGE,  m: 4*PROTON_MASS, v: 3.8e5, B: 1.0 },
  { name: 'Electron',     q: -ELECTRON_CHARGE,   m: 9.11e-31,      v: 5e7,   B: 0.01 },
  { name: 'Ion (P7)',     q: ELECTRON_CHARGE,    m: 2.18e-26,      v: 1e3,   B: 0.93 },
]

const ORBIT_R = 2.6
const F_REF = ELECTRON_CHARGE * 6.2e6 * 0.5e-4

export default function CircularMotionSim() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)

  const [q, setQ] = useState(ELECTRON_CHARGE) // signed charge, C
  const [m, setM] = useState(PROTON_MASS)
  const [v, setV] = useState(6.2e6)
  const [B, setB] = useState(0.5e-4)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showHelp, setShowHelp] = useState(false)

  const result = circularMotion(q, m, v, B)

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    mount.appendChild(canvas)
    const { renderer, scene, camera, controls } = createScene(canvas)
    controls._spherical.set(12, 1.0, 0.45); controls.update()

    const particle = createParticle(C.cyan, 0.15); scene.add(particle)
    const trail = new ParticleTrail(scene, 500, C.cyan)
    const ptLight = new THREE.PointLight(C.cyan, 1.5, 7); scene.add(ptLight)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ORBIT_R, 0.013, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0x1a3a5a, transparent: true, opacity: 0.5 })
    )
    ring.rotation.x = Math.PI / 2; scene.add(ring)

    scene.add(createFieldArrows(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 4.5, 1.2, 0x1a4060, 0.55))

    const bArrow = createArrow(new THREE.Vector3(0,1,0), new THREE.Vector3(-ORBIT_R-1.3, -0.2, 0), 2.0, C.rose, 0.15, 0.032)
    const bLabel = makeSprite('B', '#ff3d6b', 0.5)
    bLabel.position.set(-ORBIT_R-1.3, 2.4, 0)
    scene.add(bArrow, bLabel)

    let arrowV: THREE.Group | null = null
    let arrowF: THREE.Group | null = null
    let lblV: THREE.Sprite | null = null
    let lblF: THREE.Sprite | null = null

    sceneRef.current = {
      paused: false, speed: 1, angle: 0,
      vLen: 1.6, fLen: 1.0,
      reset: () => { sceneRef.current.angle = 0; trail.clear() }
    }

    let lastTime = performance.now(), animId = 0
    const animate = () => {
      animId = requestAnimationFrame(animate)
      handleResize(canvas, renderer, camera)
      const s = sceneRef.current; if (!s) return
      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.05) * s.speed
      lastTime = now
      if (!s.paused) s.angle += 2 * Math.PI * 0.28 * dt * (s.sign || 1)

      const a = s.angle
      particle.position.set(ORBIT_R * Math.cos(a), 0, ORBIT_R * Math.sin(a))
      ptLight.position.copy(particle.position)
      trail.push(particle.position)

      const velDir = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(s.sign || 1)
      const frcDir = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a))

      disposeGroup(scene, arrowV); disposeGroup(scene, arrowF)
      if (lblV) scene.remove(lblV); if (lblF) scene.remove(lblF)

      arrowV = createArrow(velDir, particle.position.clone(), s.vLen, C.cyan, 0.18, 0.030)
      arrowF = createArrow(frcDir, particle.position.clone(), s.fLen, C.gold, 0.20, 0.030)
      lblV = makeSprite('v', '#00f0ff', 0.48)
      lblF = makeSprite('F', '#ffc832', 0.48)
      lblV.position.copy(particle.position.clone().addScaledVector(velDir, s.vLen + 0.4))
      lblF.position.copy(particle.position.clone().addScaledVector(frcDir, s.fLen + 0.4))
      scene.add(arrowV, arrowF, lblV, lblF)

      controls.update(); renderer.render(scene, camera)
    }
    requestAnimationFrame(() => handleResize(canvas, renderer, camera))
    animate()

    const ro = new ResizeObserver(() => handleResize(canvas, renderer, camera))
    ro.observe(mount)
    return () => {
      cancelAnimationFrame(animId); controls.dispose(); trail.dispose(); renderer.dispose()
      ro.disconnect(); mount.removeChild(canvas); sceneRef.current = null
    }
  }, [])

  useEffect(() => { if (sceneRef.current) sceneRef.current.paused = paused }, [paused])
  useEffect(() => { if (sceneRef.current) sceneRef.current.speed = speed }, [speed])
  useEffect(() => {
    if (!sceneRef.current) return
    sceneRef.current.vLen = 1.6
    sceneRef.current.fLen = Math.max(0.35, Math.min(2.4, 1.0 * (result.F / F_REF)))
    sceneRef.current.sign = Math.sign(q) || 1
  }, [q, m, v, B, result.F])

  const panel = (
    <div style={{ padding: '10px 12px' }}>
      <ParamControl label="q" value={q} min={-3.2e-19} max={3.2e-19} step={1e-20} onChange={setQ} color="cyan"  unit="C"   formatDisplay={x => x.toExponential(2)} showSlider={false} />
      <ParamControl label="m"   value={m} min={9.11e-31} max={3e-26} step={5e-29} onChange={setM} color="gold" unit="kg"  formatDisplay={x => x.toExponential(2)} showSlider={false} />
      <ParamControl label="v"   value={v} min={1e4} max={5e7} step={1e5}          onChange={setV} color="rose" unit="m/s" formatDisplay={x => x.toExponential(2)} showSlider={false} />
      <ParamControl label="B"   value={B} min={1e-5} max={5} step={1e-4}          onChange={setB} color="cyan" unit="T"   formatDisplay={x => x.toExponential(2)} showSlider={false} />
      <div style={{ marginTop: 8 }}>
        <PlaybackControls paused={paused} onToggle={() => setPaused(p => !p)} onReset={() => sceneRef.current?.reset()} speed={speed} onSpeed={setSpeed} />
      </div>
      <div style={{ marginTop: 8 }}>
        <ResultsPanel rows={[
          { label: 'q',         value: q.toExponential(2) + ' C', color: 'cyan' },
          { label: 'F = |q|vB', value: result.F.toExponential(3) + ' N',  color: 'gold' },
          { label: 'r = mv/qB', value: result.r.toExponential(3) + ' m',  color: 'cyan' },
          { label: 'T',         value: result.T.toExponential(3) + ' s',  color: 'rose' },
          { label: 'f',         value: result.f.toExponential(3) + ' Hz', color: 'green' },
        ]} />
      </div>
    </div>
  )

  return (
    <div>
      <FormulaBox title="Movimiento circular -- B uniforme"
        lines={["F = q(v x B)  (fuerza centripeta)  |  r = mv/(|q|B)  |  f = |q|B/(2pm)",
                "El signo de q determina el sentido de giro"]} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)' }}>Preset:</span>
        {PRESETS.map(p => (
          <button key={p.name} onClick={() => { setQ(p.q); setM(p.m); setV(p.v); setB(p.B) }}
            style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', background: 'rgba(0,0,0,0.4)', border: '1px solid #1e3a5f', color: '#4a7090', cursor: 'pointer' }}>
            {p.name}
          </button>
        ))}
        <button onClick={() => setShowHelp(h => !h)}
          style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', background: showHelp ? 'rgba(0,240,255,0.15)' : 'rgba(0,0,0,0.4)', border: `1px solid ${showHelp ? 'var(--cyan)' : '#1e3a5f'}`, color: showHelp ? 'var(--cyan)' : '#4a90b0', cursor: 'pointer' }}>
          ? Ayuda
        </button>
      </div>

      {showHelp && (
        <div style={{ marginBottom: 12, padding: '12px 14px', background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 10, fontSize: 11, fontFamily: 'monospace', lineHeight: 2.0, color: 'var(--text)' }}>
          <div style={{ color: 'var(--cyan)', fontWeight: 700, marginBottom: 6 }}>Ecuaciones utilizadas</div>
          <div><span style={{ color: 'var(--gold)' }}>1.</span> Fuerza magnetica (centripeta): F = |q|vB</div>
          <div><span style={{ color: 'var(--gold)' }}>2.</span> Radio de la orbita: r = mv / (|q|B)</div>
          <div><span style={{ color: 'var(--gold)' }}>3.</span> Periodo: T = 2*pi*m / (|q|B) -- independiente de v</div>
          <div><span style={{ color: 'var(--gold)' }}>4.</span> Frecuencia ciclotronica: f = |q|B / (2*pi*m)</div>
          <div><span style={{ color: 'var(--gold)' }}>5.</span> Velocidad angular: omega = 2*pi*f = |q|B/m</div>
          <div style={{ marginTop: 6, color: 'var(--muted)' }}>La trayectoria es circular porque F es siempre perpendicular a v. El periodo no depende de la velocidad.</div>
        </div>
      )}

      {/* Responsive layout: side-by-side on desktop, stacked on mobile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Canvas -- takes all available width, shrinks on desktop to leave room for panel */}
        <div style={{ position: 'relative', width: '100%', height: 'clamp(300px, 80vw, 500px)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border2)', background: '#020609' }}>
          <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
          <OrbitHint />
        </div>
        {/* Panel -- fixed width sidebar on desktop, full width below on mobile */}
        <div style={{ width: '100%', background: 'rgba(4,9,18,0.97)', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden' }}>
          {panel}
        </div>
      </div>
    </div>
  )
}
