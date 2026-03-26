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
  makeSprite,
} from '@/app/lib/three-utils'
import { ParamControl, ResultsPanel, FormulaBox, PlaybackControls, OrbitHint } from '@/app/components/ParamControl'
import { massSpectrometer, ELECTRON_CHARGE, PROTON_MASS } from '@/app/lib/physics'

const DEFAULTS = {
  E: 950,
  Bsel: 0.93,
  B0: 0.93,
  mFac: 13,
  qFac: 1,
}

const SX1 = -11.7
const SX2 = -2.0
const SHH = 2.0
const CX2 = 6.5
const CHH = 6.2
const STEP = 1.25

const REF_R = massSpectrometer(
  DEFAULTS.E,
  DEFAULTS.Bsel,
  DEFAULTS.B0,
  DEFAULTS.mFac * PROTON_MASS,
  DEFAULTS.qFac * ELECTRON_CHARGE
).r

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function positiveValue(value: number, min: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, value)
}

function orbitPos(t: number, dY: number, rVisual: number): [number, number] {
  return [SX2 + rVisual * Math.sin(t), dY * rVisual * (1 - Math.cos(t))]
}

function toVisualRadius(radius: number) {
  const ratio = radius / REF_R
  return clamp(2.4 * Math.pow(ratio, 0.35), 0.95, 2.9)
}

function makeBox(
  cx: number,
  cy: number,
  w: number,
  h: number,
  fillColor: number,
  fillOpacity: number,
  edgeColor: number
) {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(w, h, 0.08)
  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshPhongMaterial({
      color: fillColor,
      transparent: true,
      opacity: fillOpacity,
      depthWrite: false,
    })
  )
  fill.position.set(cx, cy, -0.15)
  group.add(fill)

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.7 })
  )
  edge.position.set(cx, cy, -0.15)
  group.add(edge)
  return group
}

function makeFieldGrid(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  color: number,
  arrowLen = 0.55,
  dir = new THREE.Vector3(0, 0, -1)
) {
  const group = new THREE.Group()
  const fieldDir = dir.clone().normalize()
  const xs: number[] = []
  for (let x = x1 + STEP * 0.5; x < x2 - 0.05; x += STEP) xs.push(x)
  const ys: number[] = [0]
  for (let y = STEP; y <= y2 + 0.05; y += STEP) ys.push(y)
  for (let y = -STEP; y >= y1 - 0.05; y -= STEP) ys.push(y)

  for (const x of xs) {
    for (const y of ys) {
      if (y < y1 - 0.01 || y > y2 + 0.01) continue
      group.add(createArrow(fieldDir, new THREE.Vector3(x, y, 0.05), arrowLen, color, 0.3, 0.03))
    }
  }

  return group
}

function makeSemiGuide(dY: number, rVisual: number, segments = 90) {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI
    const [x, y] = orbitPos(t, dY, rVisual)
    points.push(new THREE.Vector3(x, y, 0.05))
  }

  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x1a5070, transparent: true, opacity: 0.6 })
  )
}

export default function MassSpectrometerSim() {
  const mountRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<any>(null)

  const [E, setE] = useState(DEFAULTS.E)
  const [Bsel, setBsel] = useState(DEFAULTS.Bsel)
  const [B0, setB0] = useState(DEFAULTS.B0)
  const [mFac, setMFac] = useState(DEFAULTS.mFac)
  const [qFac, setQFac] = useState(DEFAULTS.qFac)
  const [qSign, setQSign] = useState<1 | -1>(1)
  const [paused, setPaused] = useState(false)
  const [simSpeed, setSimSpeed] = useState(1)
  const [showHelp, setShowHelp] = useState(false)
  const [showReadout, setShowReadout] = useState(false)

  const m = mFac * PROTON_MASS
  const absQ = qFac * ELECTRON_CHARGE
  const res = massSpectrometer(E, Bsel, B0, m, absQ)
  const qOverM = absQ / m
  const rVisual = toVisualRadius(res.r)
  const dY = qSign as 1 | -1
  const fmt = (value: number) => {
    if (Math.abs(value) < 0.001 || Math.abs(value) >= 1e6) return value.toExponential(3)
    return value.toPrecision(5).replace(/\.?0+$/, '')
  }
  const screenRows = [
    { label: 'E', value: `${fmt(E)} V/m`, color: 'var(--rose)' },
    { label: 'B selector', value: `${fmt(Bsel)} T`, color: 'var(--gold)' },
    { label: 'B0 camara', value: `${fmt(B0)} T`, color: 'var(--gold)' },
    { label: '|q|', value: `${fmt(qFac)} e`, color: 'var(--rose)' },
    { label: 'masa', value: `${fmt(mFac)} mp`, color: 'var(--cyan)' },
    { label: 'v = E/B', value: `${fmt(res.v)} m/s`, color: 'var(--green)' },
    { label: 'r', value: `${fmt(res.r)} m`, color: 'var(--gold)' },
    { label: '2r', value: `${fmt(2 * res.r)} m`, color: 'var(--cyan)' },
    { label: '|q|/m', value: `${fmt(qOverM)} C/kg`, color: 'var(--rose)' },
  ]

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    while (mount.firstChild) mount.removeChild(mount.firstChild)

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    mount.appendChild(canvas)

    const { renderer, scene, camera, controls } = createScene(canvas, {
      axes: { size: 3.2, color: 0xffffff, labelColor: '#ffffff' },
      grid: false,
    })
    controls._spherical.set(20, Math.PI / 2.1, -0.05)
    controls.target.set(-0.5, 0, 0)
    controls.update()

    scene.add(new THREE.AmbientLight(0x334455, 2.5))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(3, 8, 12)
    scene.add(dirLight)

    const selectorWidth = SX2 - SX1
    const selectorCenterX = (SX1 + SX2) / 2
    const chamberCenterX = (SX2 + CX2) / 2
    const fieldDir = new THREE.Vector3(0, 0, -1)

    scene.add(makeBox(selectorCenterX, 0, selectorWidth, SHH * 2, 0x040f1e, 0.55, 0x1a4080))

    const topPlate = new THREE.Mesh(
      new THREE.BoxGeometry(selectorWidth - 0.15, 0.18, 0.45),
      new THREE.MeshPhongMaterial({ color: 0x1155dd, emissive: 0x0a2a88, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 })
    )
    topPlate.position.set(selectorCenterX, SHH - 0.09, 0)
    scene.add(topPlate)

    const bottomPlate = new THREE.Mesh(
      new THREE.BoxGeometry(selectorWidth - 0.15, 0.18, 0.45),
      new THREE.MeshPhongMaterial({ color: 0xcc2222, emissive: 0x661111, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 })
    )
    bottomPlate.position.set(selectorCenterX, -(SHH - 0.09), 0)
    scene.add(bottomPlate)

    const eHeight = (SHH - 0.27) * 2 - 0.1
    const eStep = STEP * 0.5
    for (let x = SX1 + eStep * 0.5; x < SX2 - 0.1; x += eStep) {
      scene.add(createArrow(new THREE.Vector3(0, -1, 0), new THREE.Vector3(x, SHH - 0.27, 0.06), eHeight, 0x2244bb, 0.18, 0.024))
    }
    const eLabel = makeSprite('E', '#2244bb', 0.52)
    eLabel.position.set(SX1 + 0.6, 0.75, 0.5)
    scene.add(eLabel)

    const selectorLabel = makeSprite('Selector de velocidades', '#3366aa', 0.34)
    selectorLabel.position.set(selectorCenterX, -(SHH + 0.8), 0.5)
    scene.add(selectorLabel)

    scene.add(makeFieldGrid(SX1 + 0.15, SX2 - 0.1, -SHH + 0.3, SHH - 0.3, 0x00aa55, 0.55, fieldDir))
    scene.add(createArrow(fieldDir, new THREE.Vector3(selectorCenterX, 0, 0.8), 2.0, 0x00aa55, 0.35, 0.05))
    const bSelLabel = makeSprite('Bsel', '#00aa55', 0.42)
    bSelLabel.position.set(selectorCenterX, 1.3, 0.8)
    scene.add(bSelLabel)

    const beamX = SX1 - 2.2
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(beamX, 0, 0.08),
        new THREE.Vector3(SX1 + 0.15, 0, 0.08),
      ]),
      new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.4 })
    ))
    scene.add(createArrow(new THREE.Vector3(1, 0, 0), new THREE.Vector3(beamX, 0, 0.08), 1.6, C.cyan, 0.24, 0.042))
    const vLabel = makeSprite('v', '#00e8ff', 0.5)
    vLabel.position.set(beamX + 0.9, -0.65, 0.5)
    scene.add(vLabel)

    const qLabel = makeSprite(qSign > 0 ? 'q (+)' : 'q (-)', qSign > 0 ? '#00e8ff' : '#ff3d6b', 0.48)
    qLabel.position.set(beamX + 0.9, 0.72, 0.5)
    scene.add(qLabel)

    scene.add(makeBox(chamberCenterX, 0, CX2 - SX2, CHH * 2, 0x020a14, 0.52, 0x1a3350))
    scene.add(makeFieldGrid(SX2 + 0.15, CX2 - 0.15, -CHH + 0.3, CHH - 0.3, 0x00ffaa, 0.52, fieldDir))
    scene.add(createArrow(fieldDir, new THREE.Vector3(chamberCenterX, 0, 0.8), 2.6, 0x00ffaa, 0.4, 0.06))

    const chamberLabel = makeSprite('Camara de deflexion', '#224466', 0.38)
    chamberLabel.position.set(chamberCenterX + 1.1, -(CHH - 0.1), 0.6)
    scene.add(chamberLabel)

    const b0Label = makeSprite('B0', '#00ffaa', 0.42)
    b0Label.position.set(chamberCenterX + 0.3, 1.8, 0.8)
    scene.add(b0Label)

    const slitHalf = 0.28
    const plateHeight = CHH - slitHalf
    const plateMat = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xaaaa00, emissiveIntensity: 0.35, transparent: true, opacity: 0.4 })
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.55 })

    const topDetector = new THREE.Mesh(new THREE.BoxGeometry(0.13, plateHeight, 0.55), plateMat)
    topDetector.position.set(SX2 + 0.065, slitHalf + plateHeight / 2, 0.06)
    scene.add(topDetector)
    const topDetectorEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.13, plateHeight, 0.55)), edgeMat)
    topDetectorEdge.position.set(SX2 + 0.065, slitHalf + plateHeight / 2, 0.06)
    scene.add(topDetectorEdge)

    const bottomDetector = new THREE.Mesh(new THREE.BoxGeometry(0.13, plateHeight, 0.55), plateMat)
    bottomDetector.position.set(SX2 + 0.065, -(slitHalf + plateHeight / 2), 0.06)
    scene.add(bottomDetector)
    const bottomDetectorEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.13, plateHeight, 0.55)), edgeMat)
    bottomDetectorEdge.position.set(SX2 + 0.065, -(slitHalf + plateHeight / 2), 0.06)
    scene.add(bottomDetectorEdge)

    const slitGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, slitHalf * 2, 0.55),
      new THREE.MeshPhongMaterial({ color: C.green, emissive: C.green, emissiveIntensity: 0.8, transparent: true, opacity: 0.35 })
    )
    slitGlow.position.set(SX2 + 0.065, 0, 0.06)
    scene.add(slitGlow)

    const plateLabel = makeSprite('Placa fotografica', '#ffff00', 0.4)
    plateLabel.position.set(SX2 - 0.5, CHH - 0.5, 0.5)
    scene.add(plateLabel)

    scene.add(makeSemiGuide(dY, rVisual))
    const landY = dY * rVisual * 2
    const landingDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshPhongMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 2.0 })
    )
    landingDot.position.set(SX2, landY, 0.18)
    scene.add(landingDot)
    const pointLabel = makeSprite('P', '#2dff6e', 0.52)
    pointLabel.position.set(SX2 - 0.25, landY + (dY > 0 ? 0.4 : -0.4), 0.5)
    scene.add(pointLabel)

    const orbitCenterX = SX2
    const orbitCenterY = dY * rVisual
    const radiusLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(orbitCenterX, orbitCenterY, 0.12),
        new THREE.Vector3(orbitCenterX, orbitCenterY, 0.12),
      ]),
      new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.7 })
    )
    scene.add(radiusLine)
    const radiusLabel = makeSprite('r', '#aaaaaa', 0.42)
    scene.add(radiusLabel)

    const particleColor = qSign > 0 ? C.cyan : C.rose
    const particle = createParticle(particleColor, 0.13)
    scene.add(particle)
    const trail = new ParticleTrail(scene, 500, particleColor)
    const pointLight = new THREE.PointLight(particleColor, 1.8, 5)
    scene.add(pointLight)

    const chargeSprite = makeSprite(qSign > 0 ? 'q (+)' : 'q (-)', qSign > 0 ? '#00e8ff' : '#ff3d6b', 0.5)
    scene.add(chargeSprite)

    const velocityArrow = createArrow(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.2, C.cyan, 0.28, 0.038)
    scene.add(velocityArrow)
    const velocityLabel = makeSprite('v', '#00e8ff', 0.36)
    scene.add(velocityLabel)

    const forceArrow = createArrow(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.0, C.gold, 0.28, 0.036)
    scene.add(forceArrow)
    const forceLabel = makeSprite('F', '#ffc832', 0.36)
    scene.add(forceLabel)

    let phase = 0
    ctxRef.current = {
      paused: false,
      speed: 1,
      reset: () => {
        phase = 0
        trail.clear()
      },
    }

    let lastT = performance.now()
    let animId = 0

    const animate = () => {
      animId = requestAnimationFrame(animate)
      handleResize(canvas, renderer, camera)

      const ctx = ctxRef.current
      if (!ctx) return

      const now = performance.now()
      const dt = Math.min((now - lastT) / 1000, 0.05) * ctx.speed
      lastT = now
      if (!ctx.paused) {
        phase += dt * 0.55
        if (phase >= 2.02) {
          phase = 0
          trail.clear()
        }
      }

      let px = SX1
      let py = 0
      let vxDir = 1
      let vyDir = 0
      let fxDir = 0
      let fyDir = 0
      const inChamber = phase > 1

      if (phase <= 1) {
        px = SX1 + (SX2 - SX1) * phase
      } else {
        const t = Math.min((phase - 1) * Math.PI, Math.PI)
        ;[px, py] = orbitPos(t, dY, rVisual)

        const tangentX = Math.cos(t)
        const tangentY = dY * Math.sin(t)
        const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1
        vxDir = tangentX / tangentLen
        vyDir = tangentY / tangentLen

        const centerX = orbitCenterX - px
        const centerY = orbitCenterY - py
        const centerLen = Math.sqrt(centerX * centerX + centerY * centerY) || 1
        fxDir = centerX / centerLen
        fyDir = centerY / centerLen
      }

      particle.position.set(px, py, 0.18)
      chargeSprite.position.set(px, py + 0.36, 0.5)
      pointLight.position.set(px, py, 1.2)
      trail.push(particle.position)

      velocityArrow.position.set(px, py, 0.2)
      velocityArrow.setRotationFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(vxDir, vyDir, 0).normalize())
      )
      velocityLabel.position.set(px + vxDir * 1.5, py + vyDir * 1.5, 0.5)

      forceArrow.visible = inChamber
      forceLabel.visible = inChamber
      radiusLine.visible = inChamber
      radiusLabel.visible = inChamber

      if (inChamber) {
        forceArrow.position.set(px, py, 0.2)
        forceArrow.setRotationFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(fxDir, fyDir, 0).normalize())
        )
        forceLabel.position.set(px + fxDir * 1.4, py + fyDir * 1.4, 0.5)

        radiusLine.geometry.setFromPoints([
          new THREE.Vector3(orbitCenterX, orbitCenterY, 0.12),
          new THREE.Vector3(px, py, 0.12),
        ])
        radiusLine.geometry.attributes.position.needsUpdate = true
        radiusLabel.position.set((orbitCenterX + px) / 2 + 0.2, (orbitCenterY + py) / 2, 0.5)
      }

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
      if (mount.contains(canvas)) mount.removeChild(canvas)
      ctxRef.current = null
    }
  }, [qSign, E, Bsel, B0, mFac, qFac, rVisual])

  useEffect(() => {
    if (ctxRef.current) ctxRef.current.paused = paused
  }, [paused])

  useEffect(() => {
    if (ctxRef.current) ctxRef.current.speed = simSpeed
  }, [simSpeed])

  return (
    <div>
      <FormulaBox
        title="Espectrometro de masas"
        lines={[
          'Selector: v = E / B   |   Camara: r = m v / (|q| B0)',
          'Objetivo: obtener la relacion |q|/m a partir de la velocidad seleccionada y del radio de curvatura.',
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Variables de entrada
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text)' }}>
            Campo electrico E y campo magnetico B del selector, campo magnetico B0 de la camara, carga y masa de la particula.
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Que se persigue
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text)' }}>
            Comparar como cambia |q|/m. Si la masa crece, la curvatura disminuye; si la carga crece, la curvatura aumenta.
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.16)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Nota visual
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text)' }}>
            La trayectoria se reescala en pantalla para que el radio pueda verse bien. Los valores fisicos correctos se leen en r y en |q|/m.
          </div>
        </div>
      </div>

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
          <div style={{ color: 'var(--cyan)', fontWeight: 700, marginBottom: 4 }}>Idea fisica</div>
          <div><span style={{ color: 'var(--gold)' }}>Selector:</span> solo pasan recto las particulas con v = E / B.</div>
          <div><span style={{ color: 'var(--gold)' }}>Camara:</span> una vez elegida esa velocidad, el radio es r = m v / (|q| B0).</div>
          <div><span style={{ color: 'var(--gold)' }}>Relacion buscada:</span> |q|/m = v / (r B0) = E / (r B B0).</div>
          <div><span style={{ color: 'var(--gold)' }}>Signo de q:</span> no cambia el modulo de |q|/m, pero si el sentido de la curvatura.</div>
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
                minWidth: 240,
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
                <span style={{ color: 'var(--muted)' }}>sentido</span>
                <span style={{ color: qSign > 0 ? 'var(--cyan)' : 'var(--rose)', fontWeight: 700, textAlign: 'right' }}>
                  {qSign > 0 ? 'arriba' : 'abajo'}
                </span>
              </div>
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontFamily: 'monospace',
              fontWeight: 700,
              background: 'rgba(2,6,9,0.88)',
              border: `1px solid ${qSign > 0 ? 'var(--cyan)' : 'var(--rose)'}`,
              color: qSign > 0 ? 'var(--cyan)' : 'var(--rose)',
              pointerEvents: 'none',
            }}
          >
            q {qSign > 0 ? '(+) curva hacia arriba' : '(-) curva hacia abajo'}
          </div>
        </div>

        <div style={{ width: '100%', background: 'rgba(4,9,18,0.97)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Carga de la particula
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, -1] as const).map((sign) => (
                <button
                  key={sign}
                  onClick={() => {
                    setQSign(sign)
                    ctxRef.current?.reset()
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: qSign === sign ? (sign > 0 ? 'rgba(0,232,255,0.15)' : 'rgba(255,61,107,0.15)') : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${qSign === sign ? (sign > 0 ? 'var(--cyan)' : 'var(--rose)') : '#1e3a5f'}`,
                    color: qSign === sign ? (sign > 0 ? 'var(--cyan)' : 'var(--rose)') : '#4a7090',
                  }}
                >
                  {sign > 0 ? '+ Positiva' : '- Negativa'}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <ParamControl
                label="|q|"
                value={qFac}
                min={1}
                max={20}
                step={1}
                onChange={(value) => {
                  setQFac(positiveValue(value, 1))
                  ctxRef.current?.reset()
                }}
                color="rose"
                unit="e"
                showSlider={false}
                tooltip="Modulo de la carga en multiplos de e. Si |q| aumenta, el radio disminuye."
              />
            </div>
          </div>

          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Selector de velocidades
          </div>
          <ParamControl
            label="E"
            value={E}
            min={100}
            max={10000}
            step={50}
            onChange={(value) => {
              setE(positiveValue(value, 100))
              ctxRef.current?.reset()
            }}
            color="rose"
            unit="V/m"
            showSlider={false}
            tooltip="Campo electrico del selector. Fija la velocidad elegida junto con B."
          />
          <ParamControl
            label="B selector"
            value={Bsel}
            min={0.1}
            max={5}
            step={0.05}
            onChange={(value) => {
              setBsel(positiveValue(value, 0.1))
              ctxRef.current?.reset()
            }}
            color="gold"
            unit="T"
            showSlider={false}
            tooltip="Campo magnetico del selector. La velocidad seleccionada es v = E / B."
          />

          <div style={{ margin: '6px 0 10px', padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.35)', border: '1px solid #1a3050', fontSize: 11, fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)' }}>v seleccionada = E / B</span>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(res.v)} m/s</span>
          </div>

          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Camara de deflexion
          </div>
          <ParamControl
            label="B0 camara"
            value={B0}
            min={0.1}
            max={5}
            step={0.05}
            onChange={(value) => {
              setB0(positiveValue(value, 0.1))
              ctxRef.current?.reset()
            }}
            color="gold"
            unit="T"
            showSlider={false}
            tooltip="Campo magnetico de la camara. Si B0 aumenta, la curvatura tambien aumenta."
          />
          <ParamControl
            label="masa"
            value={mFac}
            min={1}
            max={200}
            step={1}
            onChange={(value) => {
              setMFac(positiveValue(value, 1))
              ctxRef.current?.reset()
            }}
            color="cyan"
            unit="mp"
            showSlider={false}
            tooltip="Masa en multiplos de la masa del proton. Si m aumenta, el radio tambien aumenta."
          />

          <div style={{ marginTop: 10 }}>
            <PlaybackControls
              paused={paused}
              onToggle={() => setPaused((prev) => !prev)}
              onReset={() => {
                ctxRef.current?.reset()
                if (paused) setPaused(false)
              }}
              speed={simSpeed}
              onSpeed={setSimSpeed}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <ResultsPanel
              rows={[
                { label: 'v = E / B', value: `${fmt(res.v)} m/s`, color: 'green' },
                { label: 'r = m v / (|q| B0)', value: `${fmt(res.r)} m`, color: 'gold' },
                { label: '2r (impacto en P)', value: `${fmt(2 * res.r)} m`, color: 'cyan' },
                { label: '|q| / m', value: `${fmt(qOverM)} C/kg`, color: 'rose' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
