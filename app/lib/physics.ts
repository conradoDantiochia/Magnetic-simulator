// ────────────────────────────────────────────────
// Vector math utilities
// ────────────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number }

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z })

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

export const magnitude = (v: Vec3) => Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2)

export const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s })

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export const angleBetween = (a: Vec3, b: Vec3) => {
  const cosA = dot(a, b) / (magnitude(a) * magnitude(b))
  return Math.acos(Math.max(-1, Math.min(1, cosA))) * (180 / Math.PI)
}

export const formatVec = (v: Vec3, decimals = 2) =>
  `(${v.x.toFixed(decimals)}î + ${v.y.toFixed(decimals)}ĵ + ${v.z.toFixed(decimals)}k̂)`

export const vecMag = (v: Vec3) => magnitude(v)

// ────────────────────────────────────────────────
// Physics constants
// ────────────────────────────────────────────────

export const ELECTRON_CHARGE = 1.6e-19   // C
export const ELECTRON_MASS   = 9.11e-31  // kg
export const PROTON_MASS     = 1.67e-27  // kg
export const PROTON_CHARGE   = 1.6e-19   // C

// ────────────────────────────────────────────────
// Problem solvers
// ────────────────────────────────────────────────

/** Prob 1 & 3 & 5: Circular motion in magnetic field */
export const circularMotion = (q: number, m: number, v: number, B: number) => {
  const F = Math.abs(q) * v * B          // N  (v ⊥ B)
  const r = m * v / (Math.abs(q) * B)    // m
  const T = 2 * Math.PI * m / (Math.abs(q) * B) // s
  const f = 1 / T                         // Hz
  return { F, r, T, f }
}

// /** Prob 3: Alpha particle force */
// export const lorentzForce = (q: number, v: Vec3, B: Vec3): Vec3 => {
//   const vxB = cross(v, B)
//   return scale(vxB, q)
// }

// /** Prob 4: Electron in vector fields */
// export const electronForceVec = (v: Vec3, B: Vec3): Vec3 => {
//   const q = -ELECTRON_CHARGE
//   return lorentzForce(q, v, B)
// }

// /** Prob 6: Combined E and B force (Lorentz) */
// export const totalLorentzForce = (q: number, v: Vec3, E: Vec3, B: Vec3): Vec3 => {
//   const fE = scale(E, q)
//   const fB = lorentzForce(q, v, B)
//   return add(fE, fB)
// }

/** Prob 7: Mass spectrometer */
export const massSpectrometer = (E: number, B: number, B0: number, m: number, q: number) => {
  const v = E / B       // velocity selector
  const r = m * v / (Math.abs(q) * B0)
  return { v, r }
}

// /** Prob 8: Force on current-carrying wire */
// export const wireForce = (I: number, L: number, B: Vec3, direction: Vec3): Vec3 => {
//   const mag_dir = magnitude(direction)
//   const Lhat = scale(direction, L / mag_dir)
//   const ILvec: Vec3 = scale(Lhat, I)
//   return cross(ILvec, B)
// }

// /** Prob 11: Torque on magnetic dipole */
// export const dipoleTorque = (N: number, I: number, A: number, B: number, theta_deg: number) => {
//   const mu = N * I * A   // magnetic moment
//   const theta = theta_deg * Math.PI / 180
//   const tau = mu * B * Math.sin(theta)
//   return { mu, tau }
// }

// /** Prob 12: Hall effect */
// export const hallEffect = (RH: number, I: number, t: number, VH: number) => {
//   const n = Math.abs(1 / (RH * ELECTRON_CHARGE))  // carrier density
//   const B = Math.abs(VH * t / (RH * I))
//   return { n, B }
// }

// /** Prob 13: Cyclotron */
// export const cyclotron = (q: number, m: number, B: number, R: number) => {
//   const f = Math.abs(q) * B / (2 * Math.PI * m)
//   const vmax = Math.abs(q) * B * R / m
//   const KE = 0.5 * m * vmax ** 2 / ELECTRON_CHARGE  // eV
//   return { f, vmax, KE }
// }
