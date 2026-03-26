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

const EX7_MASS_FAC = 2.18e-26 / PROTON_MASS

const DEFAULTS = {
  E: 950,
  Bsel: 0.93,
  B0: 0.93,
  mFac: EX7_MASS_FAC,
  qFac: 1,
}

const EXERCISE_PRESETS = [
  {
    name: 'Ej 7',
    note: 'Ion simplemente cargado con m = 2.18e-26 kg, E = 950 V/m y B = B0 = 0.93 T. El radio esperado es 1.497e-4 m.',
    values: {
      E: 950,
      Bsel: 0.93,
      B0: 0.93,
      mFac: EX7_MASS_FAC,
      qFac: 1,
    },
  },
]

const SX1 = -11.7
const SX2 = -2.0
const HEIGHT_SCALE = 1.04
const CHAMBER_LENGTH_SCALE = 1.04
const SHH = 2.0 * HEIGHT_SCALE
const CX2 = SX2 + (6.5 - SX2) * CHAMBER_LENGTH_SCALE
const CHH = 6.2 * HEIGHT_SCALE
const STEP = 1.25
const PLATE_IMPACT_LIMIT = CHH / 2

const REF_R = massSpectrometer(
  DEFAULTS.E,
  DEFAULTS.Bsel,
  DEFAULTS.B0,
  DEFAULTS.mFac * PROTON_MASS,
  DEFAULTS.qFac * ELECTRON_CHARGE
).r

function finiteValue(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function positiveValue(value: number, min: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, value)
}

function trimFixed(value: number, digits = 4) {
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

function signedDirection(value: number, positiveDir: THREE.Vector3) {
  if (value === 0) return null
  return value > 0 ? positiveDir.clone() : positiveDir.clone().multiplyScalar(-1)
}

function formatSignedScientific(value: number, digits = 3) {
  if (!Number.isFinite(value)) return 'sin definir'
  return value.toExponential(digits)
}

function orbitPos(t: number, dY: number, rVisual: number): [number, number] {
  return [SX2 + rVisual * Math.sin(t), dY * rVisual * (1 - Math.cos(t))]
}

function toVisualRadius(radius: number) {
  if (!Number.isFinite(radius) || radius <= 0) return 2.8
  const ratio = radius / REF_R
  return Math.max(1.25, 3.05 * Math.pow(ratio, 0.35))
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

function getDisplayRadius(rVisual: number) {
  if (!Number.isFinite(rVisual) || rVisual <= 0) return rVisual
  return Math.min(rVisual, PLATE_IMPACT_LIMIT)
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
  const [paused, setPaused] = useState(false)
  const [simSpeed, setSimSpeed] = useState(1)
  const [showHelp, setShowHelp] = useState(false)
  const [showReadout, setShowReadout] = useState(false)
  const [activePreset, setActivePreset] = useState(EXERCISE_PRESETS[0].name)
  const [presetNote, setPresetNote] = useState(EXERCISE_PRESETS[0].note)

  const m = mFac * PROTON_MASS
  const q = qFac * ELECTRON_CHARGE
  const absQ = Math.abs(q)
  const res = massSpectrometer(E, Bsel, B0, m, q)
  const qOverM = q / m
  const rVisual = toVisualRadius(res.r)
  const displayRadius = getDisplayRadius(rVisual)
  const curveSign = res.curvatureSign || 0
  const selectorPasses = res.selectorPasses
  const hasChamberBend = selectorPasses && Number.isFinite(res.r) && res.r > 0 && q !== 0 && B0 !== 0
  const hitsPlateExtremes = hasChamberBend && rVisual > displayRadius + 1e-6
  const chargeColor = q > 0 ? 'var(--cyan)' : q < 0 ? 'var(--rose)' : 'var(--muted)'
  const chargeLabel = q > 0 ? 'q (+)' : q < 0 ? 'q (-)' : 'q (0)'
  const beamStatus = !Number.isFinite(res.v)
    ? 'B selector = 0: no se puede seleccionar velocidad'
    : selectorPasses
      ? 'haz seleccionado: pasa recto en el selector'
      : 'v = E/B < 0: un haz que entra desde la izquierda no pasa recto'
  const bendText = selectorPasses
    ? hasChamberBend
      ? hitsPlateExtremes
        ? 'impacta en el extremo de la placa'
        : curveSign > 0
          ? 'curva hacia arriba'
          : 'curva hacia abajo'
      : 'sin curvatura en la camara'
    : 'no entra a la camara'
  const fmt = (value: number) => {
    if (!Number.isFinite(value)) return 'sin definir'
    if (Math.abs(value) < 0.001 || Math.abs(value) >= 1e6) return value.toExponential(3)
    return value.toPrecision(5).replace(/\.?0+$/, '')
  }
  const screenRows = [
    { label: 'E', value: `${fmt(E)} V/m`, color: 'var(--rose)' },
    { label: 'B selector', value: `${fmt(Bsel)} T`, color: 'var(--gold)' },
    { label: 'B0 camara', value: `${fmt(B0)} T`, color: 'var(--gold)' },
    { label: 'q', value: `${trimFixed(qFac, 3)} e = ${formatSignedScientific(q)} C`, color: chargeColor },
    { label: 'masa', value: `${trimFixed(mFac, 4)} mp = ${m.toExponential(3)} kg`, color: 'var(--cyan)' },
    { label: 'v = E/B', value: `${fmt(res.v)} m/s`, color: 'var(--green)' },
    { label: 'r firmado', value: `${fmt(res.rSigned)} m`, color: 'var(--gold)' },
    { label: '|r|', value: `${fmt(res.r)} m`, color: 'var(--cyan)' },
    { label: 'q/m', value: `${fmt(qOverM)} C/kg`, color: chargeColor },
    { label: '|q|/m', value: `${fmt(res.qOverMAbs)} C/kg`, color: 'var(--rose)' },
  ]

  const applyPreset = (preset: typeof EXERCISE_PRESETS[number]) => {
    const { values } = preset
    setE(values.E)
    setBsel(values.Bsel)
    setB0(values.B0)
    setMFac(values.mFac)
    setQFac(values.qFac)
    setActivePreset(preset.name)
    setPresetNote(preset.note)
    ctxRef.current?.reset()
  }

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
    const selectorFieldDir = signedDirection(Bsel, new THREE.Vector3(0, 0, -1))
    const chamberFieldDir = signedDirection(B0, new THREE.Vector3(0, 0, -1))
    const electricDir = signedDirection(E, new THREE.Vector3(0, -1, 0))
    const mode = !selectorPasses ? 'blocked' : hasChamberBend ? 'curved' : 'straight'
    const particleColor = q > 0 ? C.cyan : q < 0 ? C.rose : C.gray
    const chargeSpriteColor = q > 0 ? '#00e8ff' : q < 0 ? '#ff3d6b' : '#9aa8b5'
    const topPlateCharge = E === 0 ? '0' : E > 0 ? '+' : '-'
    const bottomPlateCharge = E === 0 ? '0' : E > 0 ? '-' : '+'
    const topPlateColor = E === 0 ? 0x4a5568 : E > 0 ? 0xcc2222 : 0x1155dd
    const bottomPlateColor = E === 0 ? 0x4a5568 : E > 0 ? 0x1155dd : 0xcc2222

    scene.add(makeBox(selectorCenterX, 0, selectorWidth, SHH * 2, 0x040f1e, 0.55, 0x1a4080))

    const topPlate = new THREE.Mesh(
      new THREE.BoxGeometry(selectorWidth - 0.15, 0.18, 0.45),
      new THREE.MeshPhongMaterial({
        color: topPlateColor,
        emissive: topPlateColor,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.92,
      })
    )
    topPlate.position.set(selectorCenterX, SHH - 0.09, 0)
    scene.add(topPlate)

    const bottomPlate = new THREE.Mesh(
      new THREE.BoxGeometry(selectorWidth - 0.15, 0.18, 0.45),
      new THREE.MeshPhongMaterial({
        color: bottomPlateColor,
        emissive: bottomPlateColor,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.92,
      })
    )
    bottomPlate.position.set(selectorCenterX, -(SHH - 0.09), 0)
    scene.add(bottomPlate)

    const topPlateLabel = makeSprite(topPlateCharge, topPlateCharge === '+' ? '#ff6b6b' : topPlateCharge === '-' ? '#5eb3ff' : '#9aa8b5', 0.42)
    topPlateLabel.position.set(selectorCenterX - selectorWidth / 2 + 0.6, SHH - 0.34, 0.45)
    scene.add(topPlateLabel)
    const bottomPlateLabel = makeSprite(bottomPlateCharge, bottomPlateCharge === '+' ? '#ff6b6b' : bottomPlateCharge === '-' ? '#5eb3ff' : '#9aa8b5', 0.42)
    bottomPlateLabel.position.set(selectorCenterX - selectorWidth / 2 + 0.6, -(SHH - 0.34), 0.45)
    scene.add(bottomPlateLabel)

    const eHeight = (SHH - 0.27) * 2 - 0.1
    const eStep = STEP * 0.5
    if (electricDir) {
      const eStartY = E > 0 ? SHH - 0.27 : -(SHH - 0.27)
      for (let x = SX1 + eStep * 0.5; x < SX2 - 0.1; x += eStep) {
        scene.add(createArrow(electricDir, new THREE.Vector3(x, eStartY, 0.06), eHeight, 0x2244bb, 0.18, 0.024))
      }
    }
    const eLabel = makeSprite(E === 0 ? 'E = 0' : 'E', E === 0 ? '#9aa8b5' : '#2244bb', 0.52)
    eLabel.position.set(SX1 + 0.8, 0.75, 0.5)
    scene.add(eLabel)

    const selectorLabel = makeSprite('Selector de velocidades', '#3366aa', 0.34)
    selectorLabel.position.set(selectorCenterX, -(SHH + 0.8), 0.5)
    scene.add(selectorLabel)

    if (selectorFieldDir) {
      scene.add(makeFieldGrid(SX1 + 0.15, SX2 - 0.1, -SHH + 0.3, SHH - 0.3, 0x00aa55, 0.55, selectorFieldDir))
      scene.add(createArrow(selectorFieldDir, new THREE.Vector3(selectorCenterX, 0, 0.8), 2.0, 0x00aa55, 0.35, 0.05))
    }
    const bSelLabel = makeSprite(Bsel === 0 ? 'Bsel = 0' : 'Bsel', Bsel === 0 ? '#9aa8b5' : '#00aa55', 0.42)
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

    const qLabel = makeSprite(chargeLabel, chargeSpriteColor, 0.48)
    qLabel.position.set(beamX + 0.9, 0.72, 0.5)
    scene.add(qLabel)

    scene.add(makeBox(chamberCenterX, 0, CX2 - SX2, CHH * 2, 0x020a14, 0.52, 0x1a3350))
    if (chamberFieldDir) {
      scene.add(makeFieldGrid(SX2 + 0.15, CX2 - 0.15, -CHH + 0.3, CHH - 0.3, 0x00ffaa, 0.52, chamberFieldDir))
      scene.add(createArrow(chamberFieldDir, new THREE.Vector3(chamberCenterX, 0, 0.8), 2.6, 0x00ffaa, 0.4, 0.06))
    }

    const chamberLabel = makeSprite('Camara de deflexion', '#224466', 0.38)
    chamberLabel.position.set(chamberCenterX + 1.1, -(CHH - 0.1), 0.6)
    scene.add(chamberLabel)

    const b0Label = makeSprite(B0 === 0 ? 'B0 = 0' : 'B0', B0 === 0 ? '#9aa8b5' : '#00ffaa', 0.42)
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

    if (selectorPasses && hasChamberBend) {
      scene.add(makeSemiGuide(curveSign, displayRadius))
      const [impactX, impactY] = orbitPos(Math.PI, curveSign, displayRadius)
      const landingDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshPhongMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 2.0 })
      )
      landingDot.position.set(impactX, impactY, 0.18)
      scene.add(landingDot)
      const pointLabel = makeSprite(hitsPlateExtremes ? 'X' : 'P', hitsPlateExtremes ? '#ff8b5e' : '#2dff6e', 0.52)
      pointLabel.position.set(impactX - 0.25, impactY + (curveSign > 0 ? 0.4 : -0.4), 0.5)
      scene.add(pointLabel)
    } else if (selectorPasses) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(SX2, 0, 0.05),
          new THREE.Vector3(CX2 - 0.2, 0, 0.05),
        ]),
        new THREE.LineBasicMaterial({ color: 0x1a5070, transparent: true, opacity: 0.6 })
      ))
    }

    const orbitCenterX = SX2
    const orbitCenterY = curveSign * displayRadius
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

    const particle = createParticle(particleColor, 0.13)
    scene.add(particle)
    const trail = new ParticleTrail(scene, 500, particleColor)
    const pointLight = new THREE.PointLight(particleColor, 1.8, 5)
    scene.add(pointLight)

    const chargeSprite = makeSprite(chargeLabel, chargeSpriteColor, 0.5)
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
        const loopLimit = mode === 'blocked' ? 1.25 : 2.02
        if (phase >= loopLimit) {
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
      let forceVisible = false
      const rejectDir = Math.sign(-q * E) || Math.sign(q) || 1
      const inCurvedChamber = mode === 'curved' && phase > 1

      if (mode === 'blocked') {
        const progress = Math.min(phase / 1.25, 1)
        const xProgress = SX1 + (SX2 - SX1) * progress * 0.72
        px = xProgress
        py = rejectDir * 1.25 * progress * progress
        const tangent = new THREE.Vector3(1, rejectDir * 1.7 * progress, 0).normalize()
        vxDir = tangent.x
        vyDir = tangent.y
        fxDir = 0
        fyDir = rejectDir
        forceVisible = q !== 0 && E !== 0
      } else if (phase <= 1) {
        px = SX1 + (SX2 - SX1) * phase
      } else if (mode === 'straight') {
        px = SX2 + (CX2 - SX2 - 0.3) * Math.min(phase - 1, 1)
      } else {
        const t = Math.min((phase - 1) * Math.PI, Math.PI)
        ;[px, py] = orbitPos(t, curveSign, displayRadius)

        const tangentX = Math.cos(t)
        const tangentY = curveSign * Math.sin(t)
        const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1
        vxDir = tangentX / tangentLen
        vyDir = tangentY / tangentLen

        const centerX = orbitCenterX - px
        const centerY = orbitCenterY - py
        const centerLen = Math.sqrt(centerX * centerX + centerY * centerY) || 1
        fxDir = centerX / centerLen
        fyDir = centerY / centerLen
        forceVisible = true
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

      forceArrow.visible = forceVisible
      forceLabel.visible = forceVisible
      radiusLine.visible = inCurvedChamber
      radiusLabel.visible = inCurvedChamber

      if (forceVisible) {
        forceArrow.position.set(px, py, 0.2)
        forceArrow.setRotationFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(fxDir, fyDir, 0).normalize())
        )
        forceLabel.position.set(px + fxDir * 1.4, py + fyDir * 1.4, 0.5)
      }

      if (inCurvedChamber) {
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
  }, [E, Bsel, B0, q, selectorPasses, hasChamberBend, curveSign, displayRadius, hitsPlateExtremes])

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
          'Selector: v = E / B   |   Camara: r firmado = m v / (q B0)',
          'Lee signo y modulo en q/m, en r y en el sentido de curvatura. Los signos de E, B selector y B0 invierten las flechas dibujadas.',
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
            Comparar como cambian q/m, |q|/m y el sentido de la curvatura. Con ciertos signos, el haz que entra desde la izquierda puede dejar de pasar recto por el selector.
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.16)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Nota visual
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text)' }}>
            El signo de cada campo invierte sus flechas en la escena. Si el radio visual se vuelve demasiado grande, la trayectoria sigue referida a la placa y el impacto se muestra en su extremo.
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
          <div><span style={{ color: 'var(--gold)' }}>Selector:</span> para un haz que entra en +x, solo pasa recto si v = E / B es positiva.</div>
          <div><span style={{ color: 'var(--gold)' }}>Camara:</span> el radio firmado es r = m v / (q B0) y su signo fija si la curva va hacia arriba o hacia abajo.</div>
          <div><span style={{ color: 'var(--gold)' }}>Modulos:</span> |r| = m |v| / (|q| |B0|) y |q|/m = |v| / (|r| |B0|).</div>
          <div><span style={{ color: 'var(--gold)' }}>Lectura:</span> E, B selector, B0 y q aceptan signo negativo; la masa queda positiva. No hay tope artificial en los valores de entrada.</div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
          Ejercicio de la guia
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
                background: activePreset === preset.name ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0.35)',
                border: `1px solid ${activePreset === preset.name ? 'var(--cyan)' : '#1e3a5f'}`,
                color: activePreset === preset.name ? 'var(--cyan)' : '#84b9d8',
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
            lineHeight: 1.7,
          }}
        >
          {presetNote}
        </div>
      </div>

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
                <span style={{ color: 'var(--muted)' }}>trayectoria</span>
                <span style={{ color: chargeColor, fontWeight: 700, textAlign: 'right' }}>
                  {bendText}
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  paddingTop: 6,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text)',
                }}
              >
                {beamStatus}
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
              border: `1px solid ${selectorPasses ? 'var(--cyan)' : 'var(--rose)'}`,
              color: selectorPasses ? 'var(--cyan)' : 'var(--rose)',
              pointerEvents: 'none',
            }}
          >
            {selectorPasses ? bendText : 'selector no compatible con haz en +x'}
          </div>
        </div>

        <div style={{ width: '100%', background: 'rgba(4,9,18,0.97)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Carga de la particula
            </div>
            <ParamControl
              label="q"
              value={qFac}
              min={-20}
              max={20}
              step={1}
              onChange={(value) => {
                setQFac(finiteValue(value, 0))
                ctxRef.current?.reset()
              }}
              color="rose"
              unit="e"
              formatDisplay={(value) => trimFixed(value, 3)}
              showSlider={false}
              tooltip="Carga en multiplos de e. Si q cambia de signo, cambia el sentido de la curvatura."
            />
          </div>

          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Selector de velocidades
          </div>
          <ParamControl
            label="E"
            value={E}
            min={-10000}
            max={10000}
            step={50}
              onChange={(value) => {
              setE(finiteValue(value, 0))
              ctxRef.current?.reset()
            }}
            color="rose"
            unit="V/m"
            showSlider={false}
            tooltip="Campo electrico del selector. Su signo invierte la direccion del vector E y cambia el signo de v = E/B."
          />
          <ParamControl
            label="B selector"
            value={Bsel}
            min={-5}
            max={5}
            step={0.05}
              onChange={(value) => {
              setBsel(finiteValue(value, 0))
              ctxRef.current?.reset()
            }}
            color="gold"
            unit="T"
            showSlider={false}
            tooltip="Campo magnetico del selector. Su signo invierte B y cambia el signo de la velocidad seleccionada."
          />

          <div style={{ margin: '6px 0 10px', padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.35)', border: '1px solid #1a3050', fontSize: 11, fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)' }}>v seleccionada = E / B</span>
            <span style={{ color: selectorPasses ? 'var(--green)' : 'var(--rose)', fontWeight: 700 }}>{fmt(res.v)} m/s</span>
          </div>
          <div style={{ margin: '0 0 10px', padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
            {beamStatus}
          </div>

          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Camara de deflexion
          </div>
          <ParamControl
            label="B0 camara"
            value={B0}
            min={-5}
            max={5}
            step={0.05}
              onChange={(value) => {
              setB0(finiteValue(value, 0))
              ctxRef.current?.reset()
            }}
            color="gold"
            unit="T"
            showSlider={false}
            tooltip="Campo magnetico de la camara. Su signo invierte B0 y cambia el sentido de la curvatura."
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
            formatDisplay={(value) => trimFixed(value, 4)}
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
                { label: 'q', value: `${formatSignedScientific(q)} C`, color: 'rose' },
                { label: 'm', value: `${m.toExponential(3)} kg`, color: 'cyan' },
                { label: 'v = E / B', value: `${fmt(res.v)} m/s`, color: 'green' },
                { label: 'r firmado = m v / (q B0)', value: `${fmt(res.rSigned)} m`, color: 'gold' },
                { label: '|r|', value: `${fmt(res.r)} m`, color: 'cyan' },
                { label: 'q / m', value: `${fmt(qOverM)} C/kg`, color: 'rose' },
                { label: '|q| / m', value: `${fmt(res.qOverMAbs)} C/kg`, color: 'cyan' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
