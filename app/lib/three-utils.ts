import * as THREE from 'three'

// ── Orbit Controls ────────────────────────────────────────────────────────────
export class OrbitControls {
  camera: THREE.PerspectiveCamera
  domElement: HTMLElement
  target = new THREE.Vector3()
  rotateSpeed = 0.8
  panSpeed = 0.004
  minDistance = 1
  maxDistance = 100
  _spherical = new THREE.Spherical(10, Math.PI / 3, Math.PI / 4)
  private _drag = false
  private _panning = false
  private _lx = 0; private _ly = 0
  private _panStart = new THREE.Vector2()
  private _handlers: [string, EventTarget, EventListener, any?][] = []

  constructor(camera: THREE.PerspectiveCamera, el: HTMLElement) {
    this.camera = camera; this.domElement = el
    const on = (evt: string, tgt: EventTarget, fn: EventListener, opts?: any) => {
      tgt.addEventListener(evt, fn, opts); this._handlers.push([evt, tgt, fn])
    }
    on('contextmenu', el, (e) => { (e as MouseEvent).preventDefault() })
    on('mousedown', el, (e) => {
      const me = e as MouseEvent
      if (me.button === 1 || (me.button === 0 && me.shiftKey)) {
        // Pan
        this._panning = true
        this._panStart.set(me.clientX, me.clientY)
        me.preventDefault()
      } else {
        // Rotate
        this._drag = true
        this._lx = me.clientX
        this._ly = me.clientY
      }
    })
    on('mousemove', window, (e) => {
      const me = e as MouseEvent
      if (this._panning) {
        const deltaX = (me.clientX - this._panStart.x) * this.panSpeed * this._spherical.radius
        const deltaY = (me.clientY - this._panStart.y) * this.panSpeed * this._spherical.radius
        const cameraDir = new THREE.Vector3()
        this.camera.getWorldDirection(cameraDir)
        const right = new THREE.Vector3().crossVectors(this.camera.up, cameraDir).normalize()
        const up = this.camera.up.clone().normalize()
        this.target.addScaledVector(right, -deltaX)
        this.target.addScaledVector(up, deltaY)
        this._panStart.set(me.clientX, me.clientY)
        this.update()
      } else if (this._drag) {
        const dx = me.clientX - this._lx
        const dy = me.clientY - this._ly
        this._rot(dx, dy)
        this._lx = me.clientX
        this._ly = me.clientY
      }
    })
    on('mouseup', window, () => {
      this._panning = false
      this._drag = false
    })
    on('wheel', el, (e) => { (e as WheelEvent).preventDefault(); this._spherical.radius=Math.max(this.minDistance, Math.min(this.maxDistance, this._spherical.radius*(1+(e as WheelEvent).deltaY*0.001))) }, { passive:false })
    let tx=0,ty=0
    let touchPanStartX = 0, touchPanStartY = 0
    on('touchstart', el, (e:Event) => {
      const te = e as TouchEvent
      if (te.touches.length === 1) {
        // Single finger: rotate
        const t = te.touches[0]
        this._drag = true
        tx = t.clientX
        ty = t.clientY
      } else if (te.touches.length >= 2) {
        // Two+ fingers: pan (average position)
        this._panning = true
        const avgX = (te.touches[0].clientX + te.touches[1].clientX) / 2
        const avgY = (te.touches[0].clientY + te.touches[1].clientY) / 2
        this._panStart.set(avgX, avgY)
        touchPanStartX = avgX
        touchPanStartY = avgY
      }
    })
    on('touchmove', el, (e: Event) => {
      const te = e as TouchEvent
      te.preventDefault()
      if (te.touches.length === 1 && this._drag) {
        // Single finger rotate
        const t = te.touches[0]
        this._rot(t.clientX - tx, t.clientY - ty)
        tx = t.clientX
        ty = t.clientY
      } else if (te.touches.length >= 2 && this._panning) {
        // Two+ fingers pan
        const avgX = (te.touches[0].clientX + te.touches[1].clientX) / 2
        const avgY = (te.touches[0].clientY + te.touches[1].clientY) / 2
        const deltaX = (avgX - touchPanStartX) * this.panSpeed * this._spherical.radius
        const deltaY = (avgY - touchPanStartY) * this.panSpeed * this._spherical.radius
        const cameraDir = new THREE.Vector3()
        this.camera.getWorldDirection(cameraDir)
        const right = new THREE.Vector3().crossVectors(this.camera.up, cameraDir).normalize()
        const up = this.camera.up.clone().normalize()
        this.target.addScaledVector(right, -deltaX)
        this.target.addScaledVector(up, deltaY)
        this._panStart.set(avgX, avgY)
        touchPanStartX = avgX
        touchPanStartY = avgY
        this.update()
      }
    }, { passive: false })
    on('touchend', el, (e) => {
      const te = e as TouchEvent
      this._drag = false
      this._panning = false
    })
    this.update()
  }
  _rot(dx: number, dy: number) {
    this._spherical.theta -= dx*0.01*this.rotateSpeed
    this._spherical.phi = Math.max(0.05, Math.min(Math.PI-0.05, this._spherical.phi - dy*0.01*this.rotateSpeed))
  }
  update() {
    this.camera.position.copy(new THREE.Vector3().setFromSpherical(this._spherical).add(this.target))
    this.camera.lookAt(this.target)
  }
  dispose() { this._handlers.forEach(([evt,tgt,fn]) => tgt.removeEventListener(evt,fn)) }
}

// ── Arrow (shaft + cone, properly oriented) ───────────────────────────────────
export function createArrow(
  dir: THREE.Vector3, origin: THREE.Vector3, length: number, color: number,
  headRatio=0.22, r=0.028
): THREE.Group {
  const g = new THREE.Group()
  if (length < 0.001) return g
  const mat = new THREE.MeshPhongMaterial({ color, emissive:color, emissiveIntensity:0.4, shininess:60 })
  const hl = length*headRatio, sl = length-hl
  if (sl > 0.001) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, sl, 8), mat)
    s.position.y = sl/2; g.add(s)
  }
  const h = new THREE.Mesh(new THREE.ConeGeometry(r*3.2, hl, 10), mat)
  h.position.y = sl + hl/2; g.add(h)
  g.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,length,0)]),
    new THREE.LineBasicMaterial({color})
  ))
  const nd = dir.clone().normalize()
  if (nd.distanceTo(new THREE.Vector3(0,-1,0)) < 0.001) g.rotation.z = Math.PI
  else if (nd.distanceTo(new THREE.Vector3(0,1,0)) > 0.001)
    g.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), nd))
  g.position.copy(origin)
  return g
}

// ── Axes + labels ─────────────────────────────────────────────────────────────
interface AxesOptions {
  color?: number
  labelColor?: string
}

export function createAxes(size=3, options: AxesOptions = {}): THREE.Group {
  const g = new THREE.Group()
  const sharedColor = options.color
  const ax = [
    [new THREE.Vector3(1,0,0), sharedColor ?? 0xff3344, 'X'],
    [new THREE.Vector3(0,1,0), sharedColor ?? 0x33ff66, 'Y'],
    [new THREE.Vector3(0,0,1), sharedColor ?? 0x3366ff, 'Z'],
  ] as [THREE.Vector3,number,string][]
  ax.forEach(([d,c,t]) => {
    g.add(createArrow(d, new THREE.Vector3(), size, c, 0.1, 0.012))
    const labelColor = options.labelColor ?? `#${c.toString(16).padStart(6,'0')}`
    const sp = makeSprite(t, labelColor, 0.45)
    sp.position.copy(d.clone().multiplyScalar(size+0.4)); g.add(sp)
  })
  return g
}

// ── Grid ──────────────────────────────────────────────────────────────────────
export function createGrid(size=8,div=8) { return new THREE.GridHelper(size,div,0x1a3350,0x0d2035) }

// ── Scene setup ───────────────────────────────────────────────────────────────
// canvas must be in DOM with a sized parent before calling this.
// We walk up to find the nearest element with a real clientWidth.
interface SceneOptions {
  axes?: false | ({ size?: number } & AxesOptions)
  grid?: boolean
}

export function createScene(canvas: HTMLCanvasElement, options: SceneOptions = {}) {
  // getBoundingClientRect is reliable even at mount time
  const rect = canvas.getBoundingClientRect()
  const W = rect.width  > 10 ? rect.width  : (canvas.parentElement?.getBoundingClientRect().width  || 800)
  const H = rect.height > 10 ? rect.height : (canvas.parentElement?.getBoundingClientRect().height || 500)

  // Make the canvas fill its parent via CSS
  canvas.style.width  = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W, H)
  renderer.setClearColor(0x020609)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x020609, 0.018)

  const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 500)

  scene.add(new THREE.AmbientLight(0x334455, 3.5))
  const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(5, 10, 5); scene.add(dl)
  if (options.axes !== false) {
    const axesOptions = typeof options.axes === 'object' ? options.axes : {}
    scene.add(createAxes(axesOptions.size ?? 3.2, axesOptions))
  }
  if (options.grid !== false) {
    scene.add(createGrid(10, 10))
  }

  const controls = new OrbitControls(camera, canvas)
  return { renderer, scene, camera, controls }
}

// ── Resize ────────────────────────────────────────────────────────────────────
export function handleResize(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera
) {
  // Use getBoundingClientRect — gives the CSS pixel size reliably
  const rect = canvas.getBoundingClientRect()
  const W = Math.round(rect.width)
  const H = Math.round(rect.height)
  if (!W || !H) return
  if (renderer.domElement.width !== W || renderer.domElement.height !== H) {
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
  }
}

// ── Colors ────────────────────────────────────────────────────────────────────
export const C = { cyan:0x00f0ff, gold:0xffc832, rose:0xff3d6b, green:0x2dff6e, blue:0x4488ff, white:0xffffff, gray:0x445566 }

// ── Sprite label (always faces camera) ───────────────────────────────────────
export function makeSprite(text: string, color: string, scale = 0.6): THREE.Sprite {

  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')!

  const fontSize = 26
  ctx.font = `bold ${fontSize}px monospace`

  const metrics = ctx.measureText(text)

  const padding = 20
  const textWidth = metrics.width

  cv.width = textWidth + padding * 2
  cv.height = fontSize + padding * 2

  ctx.font = `bold ${fontSize}px monospace`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillText(text, cv.width / 2, cv.height / 2)

  const texture = new THREE.CanvasTexture(cv)

  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    })
  )

  const aspect = cv.width / cv.height
  sp.scale.set(scale * aspect, scale, scale)

  return sp
}
// alias
export const makeLabel = makeSprite

// ── Trail ─────────────────────────────────────────────────────────────────────
export class ParticleTrail {
  points: THREE.Vector3[] = []
  line: THREE.Line
  constructor(public scene: THREE.Scene, public maxLen=300, color=C.cyan) {
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),
      new THREE.LineBasicMaterial({color,transparent:true,opacity:0.7}))
    scene.add(this.line)
  }
  push(p: THREE.Vector3) {
    this.points.push(p.clone()); if(this.points.length>this.maxLen) this.points.shift()
    this.line.geometry.setFromPoints(this.points); this.line.geometry.attributes.position.needsUpdate=true
  }
  clear() { this.points=[]; this.line.geometry.setFromPoints([new THREE.Vector3()]) }
  dispose() { this.scene.remove(this.line); this.line.geometry.dispose() }
}

// ── Particle sphere ───────────────────────────────────────────────────────────
export function createParticle(color=C.cyan, r=0.14): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r,16,16),
    new THREE.MeshPhongMaterial({color,emissive:color,emissiveIntensity:0.9}))
}

// ── Dispose a group/object cleanly ───────────────────────────────────────────
export function disposeGroup(scene: THREE.Scene, g: THREE.Object3D | null) {
  if (!g) return
  scene.remove(g)
  g.traverse((o: any) => {
    if (o.geometry) o.geometry.dispose()
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m:any)=>m.dispose())
      else o.material.dispose()
    }
  })
}

// ── FIELD ARROWS ─────────────────────────────────────────────────────────────
// The CORRECT approach for 3D: draw small 3D arrows pointing in the field direction.
// When you rotate:
//   - If B points toward you → you see the arrowhead (cone tip pointing at camera)
//   - If B points away     → you see the tail (cylinder end)
//   - From the side        → you see the arrow profile
// This is physically unambiguous from any angle, unlike flat ⊗/⊙ symbols.
//
// fieldDir: normalized direction of B
// center:   center of the grid
// halfExt:  half-extent of the grid in scene units
// spacing:  distance between arrows
// color:    hex color
// arrowLen: length of each small arrow
export function createFieldArrows(
  fieldDir: THREE.Vector3,
  center: THREE.Vector3,
  halfExt: number,
  spacing: number,
  color: number,
  arrowLen = 0.5
): THREE.Group {
  const g = new THREE.Group()
  const fd = fieldDir.clone().normalize()
  // Build grid in the plane perpendicular to fd
  const up = Math.abs(fd.y) < 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0)
  const ax1 = new THREE.Vector3().crossVectors(fd, up).normalize()
  const ax2 = new THREE.Vector3().crossVectors(fd, ax1).normalize()
  const n = Math.ceil(halfExt / spacing)

  // Shared material (one per group for perf)
  const mat = new THREE.MeshPhongMaterial({ color, emissive:color, emissiveIntensity:0.35, shininess:40 })
  const lineMat = new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.7 })
  const r = arrowLen * 0.055
  const hl = arrowLen * 0.28
  const sl = arrowLen - hl

  // Shared geometries
  const shaftGeo = new THREE.CylinderGeometry(r, r, sl, 6)
  const headGeo  = new THREE.ConeGeometry(r*3, hl, 8)

  for (let i=-n; i<=n; i++) for (let j=-n; j<=n; j++) {
    const pos = center.clone()
      .addScaledVector(ax1, i*spacing)
      .addScaledVector(ax2, j*spacing)
      .addScaledVector(fd, -arrowLen*0.5) // center the arrow on its grid point

    const grp = new THREE.Group()

    const shaft = new THREE.Mesh(shaftGeo, mat)
    shaft.position.y = sl/2; grp.add(shaft)

    const head = new THREE.Mesh(headGeo, mat)
    head.position.y = sl + hl/2; grp.add(head)

    // always-visible line
    grp.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,arrowLen,0)]),
      lineMat
    ))

    // Orient along fd
    if (fd.distanceTo(new THREE.Vector3(0,-1,0)) < 0.001) grp.rotation.z = Math.PI
    else if (fd.distanceTo(new THREE.Vector3(0,1,0)) > 0.001)
      grp.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), fd))

    grp.position.copy(pos)
    g.add(grp)
  }
  return g
}
