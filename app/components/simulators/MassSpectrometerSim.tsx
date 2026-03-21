'use client'
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import {
  createScene, handleResize, createArrow, createParticle,
  ParticleTrail, C, makeSprite,
} from '@/app/lib/three-utils'
import { ParamControl, ResultsPanel, FormulaBox, PlaybackControls, OrbitHint } from '@/app/components/ParamControl'
import { massSpectrometer, ELECTRON_CHARGE, PROTON_MASS } from '@/app/lib/physics'

// ─── World layout (Three.js units) ──────────────────────────────────────────
//  Selector:  x in [SX1, SX2],  y in [-SHH, +SHH]
//  Entry slit: x=SX2, y=0
//  Chamber:   x in [SX2, CX2],  y in [-CHH, +CHH]
//  Photo plate: left wall of chamber x=SX2, full height CHH*2
//
//  Both B fields point -Z (into screen): drawn as arrow grids
//  E field points -Y (downward) between the selector plates
//
//  Ion trajectory:
//    phase 0-1: straight left-to-right at y=0 through selector to slit
//    phase 1-2: semicircle in chamber
//      q>0 => v=+X, B=-Z => v x B = +Y => curves UP   (dirY=+1)
//      q<0 => curves DOWN  (dirY=-1)
//
//  CRITICAL: field arrow grid is anchored on y=0 in both zones, so
//            the particle path (y=0 in selector, orbit in chamber)
//            always passes THROUGH the arrow rows visually.

const SX1  = -11.7,  SX2 = -2.0   // selector x bounds
const SHH  = 2.0                   // selector half-height (slightly lower plates)
const CX2  = 6.5                   // chamber right edge
const CHH  = 6.2                   // chamber half-height (tall plate)
const RVIZ = 2.8                   // visual orbit radius
const STEP = 1.25                  // field arrow grid spacing

function orbitPos(t: number, dY: number): [number, number] {
  // entry=(SX2,0), center=(SX2, dY*RVIZ)
  // x=SX2+RVIZ*sin(t),  y=dY*RVIZ*(1-cos(t))   t in [0,pi]
  return [SX2 + RVIZ * Math.sin(t), dY * RVIZ * (1 - Math.cos(t))]
}

function makeBox(
  cx: number, cy: number, w: number, h: number,
  fc: number, fo: number, ec: number
): THREE.Group {
  const g = new THREE.Group()
  const geo = new THREE.BoxGeometry(w, h, 0.08)
  const fill = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: fc, transparent: true, opacity: fo, depthWrite: false }))
  fill.position.set(cx, cy, -0.15)
  g.add(fill)
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: ec, transparent: true, opacity: 0.70 }))
  edge.position.set(cx, cy, -0.15)
  g.add(edge)
  return g
}

// Build a -Z arrow grid anchored on y=0 so the beam always passes through a row
function makeFieldGrid(
  x1: number, x2: number, y1: number, y2: number,
  color: number, arrowLen = 0.55,
  dir?: THREE.Vector3
): THREE.Group {
  const g = new THREE.Group()
  const fieldDir = (dir ?? new THREE.Vector3(0, 0, -1)).clone().normalize()
  // x positions
  const xs: number[] = []
  for (let x = x1 + STEP * 0.5; x < x2 - 0.05; x += STEP) xs.push(x)
  // y positions anchored on 0
  const ys: number[] = [0]
  for (let y = STEP; y <= y2 + 0.05; y += STEP) ys.push(y)
  for (let y = -STEP; y >= y1 - 0.05; y -= STEP) ys.push(y)
  for (const x of xs) {
    for (const y of ys) {
      if (y < y1 - 0.01 || y > y2 + 0.01) continue
      g.add(createArrow(fieldDir, new THREE.Vector3(x, y, 0.05), arrowLen, color, 0.30, 0.030))
    }
  }
  return g
}

function makeSemiGuide(dY: number, segs = 90): THREE.Line {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI
    const [x, y] = orbitPos(t, dY)
    pts.push(new THREE.Vector3(x, y, 0.05))
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x1a5070, transparent: true, opacity: 0.6 })
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MassSpectrometerSim() {
  const mountRef   = useRef<HTMLDivElement>(null)
  const ctxRef     = useRef<any>(null)

  const [E,       setE]       = useState(950)
  const [Bsel,    setBsel]    = useState(0.93)
  const [B0,      setB0]      = useState(0.93)
  const [mFac,    setMFac]    = useState(13)
  const [qFac,    setQFac]    = useState(1)
  const [qSign,   setQSign]   = useState<1|-1>(1)
  const [vInitial, setVInitial] = useState(1021.5)
  const [paused,  setPaused]  = useState(false)
  const [simSpeed,setSimSpeed]= useState(1)
  const [showHelp,setShowHelp]= useState(false)

  const m    = mFac * PROTON_MASS
  const absQ = qFac * ELECTRON_CHARGE
  // Para los cálculos analíticos usamos |B|; el signo se refleja solo en la dirección visual
  const res  = massSpectrometer(E, Math.abs(Bsel), Math.abs(B0), m, absQ)
  const B0Sign = (Math.sign(B0) || 1) as 1 | -1
  // Sentido de la órbita en la cámara: depende de q y de B0
  const dY   = (qSign * B0Sign) as 1 | -1

  // Conversión de unidades: 1 unidad Three.js = 0.1 m (10 cm)
  const SCALE = 0.1
  
  const q = qSign * absQ
  // Aceleración física en Three.js units/s²: convertir m/s² a Three.js units/s²
  const a_y_3js = (q / m) * (-E + vInitial * Bsel) / SCALE
  
  // La partícula entra exactamente al inicio del selector (x = SX1)
  const x_entry = SX1
  const total_x = SX2 - x_entry
  const total_time = total_x / (vInitial / SCALE)  // velocidad en Three.js units/s
  
  let choc = false
  let t_choc = total_time
  let py_choc = 0
  let phase_max = 1.0
  
  if (a_y_3js > 0) {
    const py_max = 0.5 * a_y_3js * total_time * total_time
    if (py_max > SHH) {
      t_choc = Math.sqrt(2 * SHH / a_y_3js)
      if (t_choc < total_time) {
        choc = true
        py_choc = SHH
        phase_max = t_choc / total_time
      }
    }
  } else if (a_y_3js < 0) {
    const py_min = 0.5 * a_y_3js * total_time * total_time
    if (py_min < -SHH) {
      t_choc = Math.sqrt(-2 * SHH / a_y_3js)
      if (t_choc < total_time) {
        choc = true
        py_choc = -SHH
        phase_max = t_choc / total_time
      }
    }

  // Punto final efectivo dentro del selector (para trayectorias rectilíneas en 2D)
  const targetX = choc ? x_entry + (vInitial / SCALE) * t_choc : SX2
  const targetY = choc ? py_choc : 0.5 * a_y_3js * total_time * total_time
  }

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return
    while (mount.firstChild) mount.removeChild(mount.firstChild)

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    mount.appendChild(canvas)

    const { renderer, scene, camera, controls } = createScene(canvas)
    controls._spherical.set(20, Math.PI / 2.1, -0.05)
    controls.target.set(-0.5, 0, 0)
    controls.update()

    scene.add(new THREE.AmbientLight(0x334455, 2.5))
    const dL = new THREE.DirectionalLight(0xffffff, 1.2)
    dL.position.set(3, 8, 12); scene.add(dL)

    const selW  = SX2 - SX1
    const selCX = (SX1 + SX2) / 2
    const camCX = (SX2 + CX2) / 2

    // ── SELECTOR BOX ──────────────────────────────────────────────────────
    scene.add(makeBox(selCX, 0, selW, SHH * 2, 0x040f1e, 0.55, 0x1a4080))

    // top plate (+, blue)
    const tp = new THREE.Mesh(
      new THREE.BoxGeometry(selW - 0.15, 0.18, 0.45),
      new THREE.MeshPhongMaterial({ color: 0x1155dd, emissive: 0x0a2a88, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 })
    )
    tp.position.set(selCX, SHH - 0.09, 0); scene.add(tp)

    // bottom plate (-, red)
    const bp = new THREE.Mesh(
      new THREE.BoxGeometry(selW - 0.15, 0.18, 0.45),
      new THREE.MeshPhongMaterial({ color: 0xcc2222, emissive: 0x661111, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 })
    )
    bp.position.set(selCX, -(SHH - 0.09), 0); scene.add(bp)

    // E arrows: full columns from top-plate to bottom-plate, many in x (brush-like)
    const eH = (SHH - 0.27) * 2 - 0.1
    const eStep = STEP * 0.5
    const eDir = new THREE.Vector3(0, E >= 0 ? -1 : 1, 0)
    const eStartY = E >= 0 ? SHH - 0.27 : -(SHH - 0.27)
    for (let x = SX1 + eStep * 0.5; x < SX2 - 0.1; x += eStep) {
      scene.add(createArrow(
        eDir,
        new THREE.Vector3(x, eStartY, 0.06),
        eH, 0x2244bb, 0.18, 0.024
      ))
    }
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/bef4633f-2346-494c-956d-bae9d60a50e1',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c72de'},
      body:JSON.stringify({
        sessionId:'9c72de',
        runId:'pre-fix',
        hypothesisId:'fields-direction',
        location:'MassSpectrometerSim.tsx:selector-fields',
        message:'Selector field directions',
        data:{E,Bsel,eDirY:eDir.y,bSelSign:Bsel >= 0 ? -1 : 1},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion
    const eL = makeSprite(E >= 0 ? '𝐄 ↓' : '𝐄 ↑', '#2244bb', 0.52)
    eL.position.set(SX1 + 0.5, 0.75, 0.5); scene.add(eL)

    const slL = makeSprite('Selector de velocidades', '#3366aa', 0.34)
    slL.position.set(selCX, -(SHH + 0.80), 0.5); scene.add(slL)

    const bSelDir = new THREE.Vector3(0, 0, Bsel >= 0 ? -1 : 1)
    scene.add(makeFieldGrid(SX1 + 0.15, SX2 - 0.1, -SHH + 0.3, SHH - 0.3, 0x00aa55, 0.55, bSelDir))
    scene.add(createArrow(
      bSelDir, // sale o entra de la pantalla según el signo de B
      new THREE.Vector3(selCX, 0, 0.8), // centro del selector
      2.0,
      0x00aa55,
      0.35,
      0.05
    ))

    const bSelVec = makeSprite('𝐁', '#00aa55', 0.45)
    bSelVec.position.set(selCX, 1.3, 0.8)
    scene.add(bSelVec)

    // ── INCOMING BEAM ─────────────────────────────────────────────────────
    const bx = SX1 - 2.2
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bx, 0, 0.08), new THREE.Vector3(SX1 + 0.15, 0, 0.08)]),
      new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.4 })
    ))
    scene.add(createArrow(new THREE.Vector3(1,0,0), new THREE.Vector3(bx, 0, 0.08), 1.6, C.cyan, 0.24, 0.042))
    const vLbl = makeSprite('v', '#00e8ff', 0.50); vLbl.position.set(bx+0.9, -0.65, 0.5); scene.add(vLbl)
    const qC = qSign > 0 ? '#00e8ff' : '#ff3d6b'
    const qLbl = makeSprite(qSign > 0 ? 'q (+)' : 'q (\u2212)', qC, 0.48)
    qLbl.position.set(bx+0.9, 0.72, 0.5); scene.add(qLbl)

    // ── CHAMBER BOX ───────────────────────────────────────────────────────
    scene.add(makeBox(camCX, 0, CX2 - SX2, CHH * 2, 0x020a14, 0.52, 0x1a3350))

    // chamber 
    const b0Dir = new THREE.Vector3(0, 0, B0 >= 0 ? -1 : 1)
    scene.add(makeFieldGrid(SX2 + 0.15, CX2 - 0.15, -CHH + 0.3, CHH - 0.3, 0x00ffaa, 0.52, b0Dir))
    const chamber = makeSprite('Camara de deflexion', '#224466', 0.38)
    chamber.position.set(camCX + 1.2, -(CHH - 0.10), 0.6); scene.add(chamber)
    
    scene.add(createArrow(
      b0Dir,
      new THREE.Vector3(camCX, 0, 0.8),
      2.6,
      0x00ffaa,
      0.40,
      0.06
    ))

    scene.add(makeFieldGrid(
      SX2 + 0.15,
      CX2 - 0.15,
      -CHH + 0.3,
      CHH - 0.3,
      0x00ffaa,
      0.52,
      b0Dir
    ))

    const b0Vec = makeSprite('𝐁₀', '#00ffaa', 0.48)
    b0Vec.position.set(camCX + 0.4, 1.8, 0.8)
    scene.add(b0Vec)

    // ── PHOTO PLATE — full height of chamber, with slit gap at y=0 ──────────
    // Two halves: top segment (y from +slitH to +CHH) and bottom (y from -CHH to -slitH)
    const slitH = 0.28   // half-height of the slit opening
    const plateH_top = CHH - slitH
    const plateH_bot = CHH - slitH
    const plateMat = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xaaaa00, emissiveIntensity: 0.35, transparent: true, opacity: 0.40 })
    const edgeMat  = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.55 })

    // top half
    const pmTop = new THREE.Mesh(new THREE.BoxGeometry(0.13, plateH_top, 0.55), plateMat)
    pmTop.position.set(SX2 + 0.065, slitH + plateH_top / 2, 0.06); scene.add(pmTop)
    const peTop = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.13, plateH_top, 0.55)), edgeMat)
    peTop.position.set(SX2 + 0.065, slitH + plateH_top / 2, 0.06); scene.add(peTop)

    // bottom half
    const pmBot = new THREE.Mesh(new THREE.BoxGeometry(0.13, plateH_bot, 0.55), plateMat)
    pmBot.position.set(SX2 + 0.065, -(slitH + plateH_bot / 2), 0.06); scene.add(pmBot)
    const peBot = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.13, plateH_bot, 0.55)), edgeMat)
    peBot.position.set(SX2 + 0.065, -(slitH + plateH_bot / 2), 0.06); scene.add(peBot)

    // slit highlight — a thin glowing line at y=0 showing the gap
    const slitGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, slitH * 2, 0.55),
      new THREE.MeshPhongMaterial({ color: C.green, emissive: C.green, emissiveIntensity: 0.8, transparent: true, opacity: 0.35 })
    )
    slitGlow.position.set(SX2 + 0.065, 0, 0.06); scene.add(slitGlow)

    const plateLbl = makeSprite('Placa fotografica', '#ffff00', 0.40)
    plateLbl.position.set(SX2 - 0.5, CHH - 0.5, 0.5); scene.add(plateLbl)

    const slitLbl = makeSprite('ranura', '#ffff00', 0.34)
    slitLbl.position.set(SX2 - 0.5, 0.6, 0.5); scene.add(slitLbl)

    // ── SEMICIRCLE GUIDE + LANDING ─────────────────────────────────────────
    scene.add(makeSemiGuide(dY))
    const landY = dY * RVIZ * 2
    const ld = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshPhongMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 2.0 })
    )
    ld.position.set(SX2, landY, 0.18); scene.add(ld)
    const pLbl = makeSprite('P', '#2dff6e', 0.52)
    pLbl.position.set(SX2 - 0.25, landY + (dY > 0 ? 0.40 : -0.40), 0.5); scene.add(pLbl)

    // ── RADIO R DINÁMICO: línea desde centro de órbita hasta partícula ─────
    // Centro de la órbita está fijo en (SX2, dY*RVIZ) durante la fase de arco
    const orbitCX = SX2, orbitCY = dY * RVIZ
    const radiusLinePts = [new THREE.Vector3(orbitCX, orbitCY, 0.12), new THREE.Vector3(orbitCX, orbitCY, 0.12)]
    const radiusLineGeo = new THREE.BufferGeometry().setFromPoints(radiusLinePts)
    const radiusLine = new THREE.Line(radiusLineGeo,
      new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.7 }))
    scene.add(radiusLine)
    // r label sprite that moves to midpoint of radius
    const rLbl = makeSprite('r', '#aaaaaa', 0.42)
    scene.add(rLbl)

    // ── PARTICLE + sign + velocity + force vectors ────────────────────────
    const pC = qSign > 0 ? C.cyan : C.rose
    const particle = createParticle(pC, 0.13); scene.add(particle)
    const trail = new ParticleTrail(scene, 500, pC)
    const ptL = new THREE.PointLight(pC, 1.8, 5); scene.add(ptL)

    // sign sprite
    const signSprite = makeSprite(qSign > 0 ? 'q (+)' : 'q (\u2212)', qSign > 0 ? '#00e8ff' : '#ff3d6b', 0.5)
    scene.add(signSprite)

    // velocity vector arrow (cyan, +X direction in selector; tangent in chamber)
    const vArrow = createArrow(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 1.2, C.cyan, 0.28, 0.038)
    scene.add(vArrow)
    const vVecLbl = makeSprite('v', '#00e8ff', 0.36)
    scene.add(vVecLbl)

    // force vector arrow (gold, centripetal = toward orbit center in chamber; zero in selector)
    const fArrow = createArrow(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 1.0, C.gold, 0.28, 0.036)
    scene.add(fArrow)
    const fVecLbl = makeSprite('F', '#ffc832', 0.36)
    scene.add(fVecLbl)

    // ── ANIMATION LOOP ────────────────────────────────────────────────────
    let phase = 0
    ctxRef.current = { paused: false, speed: 1, reset: () => { phase = 0; trail.clear() } }
    let lastT = performance.now(), animId = 0

    const animate = () => {
      animId = requestAnimationFrame(animate)
      handleResize(canvas, renderer, camera)
      const ctx = ctxRef.current; if (!ctx) return
      const now = performance.now()
      const dt = Math.min((now - lastT) / 1000, 0.05) * ctx.speed
      lastT = now
      if (!ctx.paused) {
        phase += dt * 0.50
        if (phase >= (choc ? phase_max + 0.1 : 2.06)) { phase = 0; trail.clear() }
      }

      let px: number, py: number
      let vx = 0, vy = 0   // velocity direction (normalized, in XY plane)
      let fx = 0, fy = 0   // force direction (toward orbit center, normalized)
      const inChamber = !choc && phase > phase_max && phase < 2.06

      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/bef4633f-2346-494c-956d-bae9d60a50e1',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c72de'},
        body:JSON.stringify({
          sessionId:'9c72de',
          runId:'pre-fix',
          hypothesisId:'selector-kinematics',
          location:'MassSpectrometerSim.tsx:animate-selector',
          message:'Selector kinematics step',
          data:{E,Bsel,qSign,a_y_3js,x_entry,SX2,total_time,choc,t_choc,py_choc,phase,phase_max},
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion

      // Movimiento en el selector: cinematica 2D con E y B constantes
      if (phase <= phase_max) {
        const t = phase * total_time
        const vx_phys = (vInitial / SCALE)
        const vy_phys = a_y_3js * t
        px = x_entry + vx_phys * t
        py = 0.5 * a_y_3js * t * t
        const vlen = Math.sqrt(vx_phys*vx_phys + vy_phys*vy_phys) || 1
        vx = vx_phys / vlen
        vy = vy_phys / vlen
        fx = 0; fy = 0   // en el selector mostramos solo la trayectoria (fuerzas balanceadas o no)
      } else if (!choc) {
        const t = Math.min((phase - phase_max) * Math.PI / (2.06 - phase_max), Math.PI)
        ;[px, py] = orbitPos(t, dY)
        // tangent to orbit: dx/dt = RVIZ*cos(t),  dy/dt = dY*RVIZ*sin(t)
        const tvx = Math.cos(t), tvy = dY * Math.sin(t)
        const tlen = Math.sqrt(tvx*tvx + tvy*tvy)
        vx = tvx / tlen; vy = tvy / tlen
        // centripetal force: toward orbit center (orbitCX, orbitCY) from (px,py)
        const fcx = orbitCX - px, fcy = orbitCY - py
        const flen = Math.sqrt(fcx*fcx + fcy*fcy)
        fx = fcx / flen; fy = fcy / flen
      } else {
        // choc: partícula se estrella contra una placa en el selector
        const t = t_choc
        const vx_phys = (vInitial / SCALE)
        const vy_phys = a_y_3js * t
        px = x_entry + vx_phys * t
        py = py_choc
        const vlen = Math.sqrt(vx_phys*vx_phys + vy_phys*vy_phys) || 1
        vx = vx_phys / vlen
        vy = vy_phys / vlen
        fx = 0; fy = 0
      }

      particle.position.set(px, py, 0.18)
      signSprite.position.set(px, py + 0.36, 0.5)
      ptL.position.set(px, py, 1.2)
      trail.push(particle.position)

      // velocity arrow: position at particle, pointing in (vx,vy) direction
      vArrow.position.set(px, py, 0.2)
      vArrow.setRotationFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(vx, vy, 0).normalize())
      )
      vVecLbl.position.set(px + vx * 1.5, py + vy * 1.5, 0.5)

      // force arrow: only visible in chamber, points centripetally
      fArrow.visible = inChamber
      fVecLbl.visible = inChamber
      if (inChamber) {
        fArrow.position.set(px, py, 0.2)
        fArrow.setRotationFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(fx, fy, 0).normalize())
        )
        fVecLbl.position.set(px + fx * 1.4, py + fy * 1.4, 0.5)
      }

      // radius line: from orbit center to particle (only in chamber)
      radiusLine.visible = inChamber
      rLbl.visible = inChamber
      if (inChamber) {
        const rPts = [new THREE.Vector3(orbitCX, orbitCY, 0.12), new THREE.Vector3(px, py, 0.12)]
        radiusLine.geometry.setFromPoints(rPts)
        radiusLine.geometry.attributes.position.needsUpdate = true
        // r label at midpoint of the radius segment
        rLbl.position.set((orbitCX + px) / 2 + 0.2, (orbitCY + py) / 2, 0.5)
      }

      controls.update()
      renderer.render(scene, camera)
    }
    requestAnimationFrame(() => handleResize(canvas, renderer, camera))
    animate()
    const ro = new ResizeObserver(() => handleResize(canvas, renderer, camera))
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(animId); controls.dispose(); trail.dispose()
      renderer.dispose(); ro.disconnect()
      if (mount.contains(canvas)) mount.removeChild(canvas)
      ctxRef.current = null
    }
  // including every piece of state used inside the effect ensures the scene/animation
  // is torn down and rebuilt whenever any parameter changes.  vInitial was previously
  // omitted, which meant slider updates did nothing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSign, E, Bsel, B0, mFac, qFac, vInitial])

  useEffect(() => { if (ctxRef.current) ctxRef.current.paused = paused  }, [paused])
  useEffect(() => { if (ctxRef.current) ctxRef.current.speed  = simSpeed }, [simSpeed])

  const fmt = (n: number) => {
    if (Math.abs(n) < 0.001 || Math.abs(n) >= 1e6) {
      return n.toExponential(3)
    }
    return n.toPrecision(5).replace(/\.?0+$/, '')
  }

  return (
    <div>
      <FormulaBox
        title="Espectrometro de masas"
        lines={['Selector: v=E/B  |  Camara: r=mv/(|q|B₀)  |  Placa: aterriza a 2r']}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => setShowHelp(h => !h)}
          style={{ padding: '3px 10px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace',
            background: showHelp ? 'rgba(0,240,255,0.15)' : 'rgba(0,0,0,0.4)',
            border: `1px solid ${showHelp ? 'var(--cyan)' : '#1e3a5f'}`,
            color: showHelp ? 'var(--cyan)' : '#4a90b0', cursor: 'pointer' }}>
          ? Ayuda
        </button>
      </div>

      {showHelp && (
        <div style={{ marginBottom: 12, padding: '12px 14px', background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 10, fontSize: 11, fontFamily: 'monospace', lineHeight: 2.0, color: 'var(--text)' }}>
          <div style={{ color: 'var(--cyan)', fontWeight: 700, marginBottom: 4 }}>Ecuaciones utilizadas</div>
          <div><span style={{ color: 'var(--gold)' }}>Selector:</span>  qE = qvB  -&gt;  v = E/B  (no depende de m ni q)</div>
          <div><span style={{ color: 'var(--gold)' }}>Camara:</span>    r = mv / (|q|B0)  -&gt;  semicirculo de radio r</div>
          <div><span style={{ color: 'var(--gold)' }}>Direccion:</span> F = q(v x B), v=+X, B0=-Z</div>
          <div style={{ marginLeft: 12 }}>q(+): F=+Y  curva arriba &uarr;</div>
          <div style={{ marginLeft: 12 }}>q(-): F=-Y  curva abajo &darr;</div>
          <div><span style={{ color: 'var(--gold)' }}>Placa:</span>     ion aterriza en punto P a distancia 2r</div>
          <div><span style={{ color: 'var(--gold)' }}>Masa:</span>      m = |q|*B0*(2r) / (2v)</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={{ position: 'relative', width: '100%', height: 'clamp(300px, 80vw, 500px)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border2)', background: '#020609' }}>
          <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
          <OrbitHint />
          <div style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, background: 'rgba(2,6,9,0.88)', border: `1px solid ${qSign > 0 ? 'var(--cyan)' : 'var(--rose)'}`, color: qSign > 0 ? 'var(--cyan)' : 'var(--rose)', pointerEvents: 'none' }}>
            q {qSign > 0 ? '(+) \u2191 arriba' : '(\u2212) \u2193 abajo'}
          </div>
        </div>

        <div style={{ width: '100%', background: 'rgba(4,9,18,0.97)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px' }}>

          {/* Charge sign toggle */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Signo de carga</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, -1] as const).map(s => (
                <button key={s} onClick={() => { setQSign(s); ctxRef.current?.reset() }}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12,
                    fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer',
                    background: qSign === s ? (s > 0 ? 'rgba(0,232,255,0.15)' : 'rgba(255,61,107,0.15)') : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${qSign === s ? (s > 0 ? 'var(--cyan)' : 'var(--rose)') : '#1e3a5f'}`,
                    color: qSign === s ? (s > 0 ? 'var(--cyan)' : 'var(--rose)') : '#4a7090',
                  }}>
                  {s > 0 ? '+ Positivo' : '\u2212 Negativo'}
                </button>
              ))}
            </div>
          </div>

          {/* Selector */}
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Selector de velocidades</div>
          <ParamControl label="E"  value={E}    min={-10000000}  max={10000000} step={100}   onChange={v => { setE(v);    ctxRef.current?.reset() }} color="rose" unit="V/m" showSlider={false} tooltip="Campo eléctrico selector (↓ negativo arriba). v = E / B para pasar recto." />
          <ParamControl label="B"  value={Bsel} min={-100} max={100}    step={0.1} onChange={v => { setBsel(v); ctxRef.current?.reset() }} color="gold" unit="T"   showSlider={false} tooltip="Campo magnético selector (verde). v = E / |B| para balance con E (rectilíneo)." />
          <ParamControl label="v inicial" value={vInitial} min={0} max={10000000} step={100} onChange={v => { 
            setVInitial(v);
            ctxRef.current?.reset();
          }} color="cyan" unit="m/s" showSlider={false} formatDisplay={(v) => Math.floor(v).toString()} tooltip="Velocidad de entrada al selector. Solo v = E/B pasa recto sin desviarse." />

          {/* v readout */}
          <div style={{ margin: '6px 0 10px', padding: '5px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.35)', border: '1px solid #1a3050', fontSize: 11, fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)' }}>v = E / B</span>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(res.v)} m/s</span>
          </div>

          {/* Chamber */}
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Camara de deflexion</div>
          <ParamControl label="B₀ camara"      value={B0}   min={-100} max={100}   step={0.1} onChange={v => { setB0(v);   ctxRef.current?.reset() }} color="gold" unit="T"   showSlider={false} tooltip="Campo magnético cámara (verde claro). Radio r = mv / |q B₀|. Separa por m/q." />
          <ParamControl label="masa" value={mFac} min={0}    max={1000} step={1}    onChange={v => { setMFac(v); ctxRef.current?.reset() }} color="cyan" unit="mp" showSlider={false} tooltip="Masa en múltiplos de masa protón. r proporcional a m (iones más pesados aterrizan más lejos)." />
          <ParamControl label="|q|" value={qFac} min={0}   max={100}  step={1}    onChange={v => { setQFac(v); ctxRef.current?.reset() }} color="rose" unit="e"  showSlider={false} tooltip="Carga absoluta en múltiplos de e. r inversa a |q| (iones más cargados curvan más)." />

          <div style={{ marginTop: 10 }}>
            <PlaybackControls
              paused={paused}
              onToggle={() => setPaused(p => !p)}
              onReset={() => { ctxRef.current?.reset(); if (paused) setPaused(false) }}
              speed={simSpeed}
              onSpeed={setSimSpeed}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <ResultsPanel rows={[
              { label: 'v = E/B',             value: fmt(res.v) + ' m/s',      color: 'green' },
              { label: 'r = mv/(|q|B₀)', value: fmt(res.r) + ' m',        color: 'gold'  },
              { label: '2r  (punto P)',        value: fmt(2 * res.r) + ' m',    color: 'cyan'  },
              { label: 'm / |q|',             value: fmt(m / absQ) + ' kg/C',  color: 'rose'  },
            ]} />
          </div>

        </div>
      </div>
    </div>
  )
}
