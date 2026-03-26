export interface Vec3 {
  x: number
  y: number
  z: number
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z })

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

export const magnitude = (v: Vec3) => Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2)

export const scale = (v: Vec3, s: number): Vec3 => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
})

export const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
})

export const angleBetween = (a: Vec3, b: Vec3) => {
  const cosA = dot(a, b) / (magnitude(a) * magnitude(b))
  return Math.acos(Math.max(-1, Math.min(1, cosA))) * (180 / Math.PI)
}

export const formatVec = (v: Vec3, decimals = 2) =>
  `(${v.x.toFixed(decimals)}i + ${v.y.toFixed(decimals)}j + ${v.z.toFixed(decimals)}k)`

export const vecMag = (v: Vec3) => magnitude(v)

export const ELECTRON_CHARGE = 1.6e-19
export const ELECTRON_MASS = 9.11e-31
export const PROTON_MASS = 1.67e-27
export const PROTON_CHARGE = 1.6e-19

export const circularMotion = (q: number, m: number, v: number, B: number) => {
  const absQ = Math.abs(q)
  const speed = Math.abs(v)
  const field = Math.abs(B)
  const F = absQ * speed * field
  const r = m * speed / (absQ * field)
  const T = 2 * Math.PI * m / (absQ * field)
  const f = 1 / T
  return { F, r, T, f }
}

export const massSpectrometer = (E: number, B: number, B0: number, m: number, q: number) => {
  const selectorB = Math.abs(B)
  const chamberB = Math.abs(B0)
  const absQ = Math.abs(q)
  const v = Math.abs(E) / selectorB
  const r = m * v / (absQ * chamberB)
  const qOverM = absQ / m
  return { v, r, qOverM }
}

export const dipoleTorque = (N: number, I: number, A: number, B: number, thetaDeg: number) => {
  const mu = N * I * A
  const theta = thetaDeg * Math.PI / 180
  const tau = mu * B * Math.sin(theta)
  return { mu, tau }
}

export const hallEffect = (RH: number, I: number, t: number, VH: number) => {
  const n = Math.abs(1 / (RH * ELECTRON_CHARGE))
  const B = Math.abs(VH * t / (RH * I))
  return { n, B }
}

export const cyclotron = (q: number, m: number, B: number, R: number) => {
  const absQ = Math.abs(q)
  const field = Math.abs(B)
  const f = absQ * field / (2 * Math.PI * m)
  const vmax = absQ * field * R / m
  const KE = 0.5 * m * vmax ** 2 / ELECTRON_CHARGE
  return { f, vmax, KE }
}
