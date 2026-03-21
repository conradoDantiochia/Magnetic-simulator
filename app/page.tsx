'use client'
import { useState } from 'react'
import Link from 'next/link'
import CircularMotionSim from './components/simulators/CircularMotionSim'
import LorentzVectorSim from './components/simulators/LorentzVectorSim'
import MassSpectrometerSim from './components/simulators/MassSpectrometerSim'

type TabId = 'circular' | 'lorentz' | 'spectrometer'

const TABS: { id: TabId; num: string; label: string; short: string; desc: string }[] = [
  {
    id: 'circular',
    num: '1',
    label: 'Particula en Campo Magnetico',
    short: 'Sim 1 -- Circular',
    desc: 'Trayectoria circular de una particula cargada en campo B uniforme',
  },
  {
    id: 'lorentz',
    num: '2',
    label: 'Fuerza con Campos E y B',
    short: 'Sim 2 -- Lorentz',
    desc: 'F = q(E + v x B) -- vectores, pasos de calculo y angulo de la fuerza',
  },
  {
    id: 'spectrometer',
    num: '3',
    label: 'Espectrometro de Masas',
    short: 'Sim 3 -- Espectrometro',
    desc: 'Selector de velocidades v=E/B + trayectoria circular r=mv/(qB0)',
  },
]

export default function HomePage() {
  const [active, setActive] = useState<TabId>('circular')
  const current = TABS.find(t => t.id === active)!

  return (
    <main className="relative z-10 min-h-screen p-2 md:p-5">

      {/* Header */}
      <header className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(to bottom, #00f0ff, #0070a0)' }} />
          <h1 className="text-2xl md:text-3xl font-bold"
            style={{ fontFamily: 'Orbitron, monospace', color: '#00f0ff', textShadow: '0 0 30px rgba(0,240,255,0.5)' }}>
            SimMag
          </h1>
          <span className="text-gray-500 text-sm font-mono hidden sm:inline">-- Simulador de Fuerzas Magneticas</span>
        </div>
<div className="ml-5 flex flex-wrap gap-3 mt-2">
          {[
            { label: 'F = q(v x B)', color: '#00f0ff' },
            { label: 'r = mv/(qB)',  color: '#ffc832' },
            { label: 'v = E/B',      color: '#ff3d6b' },
            { label: 'f = qB/(2pm)', color: '#2dff6e' },
          ].map(f => (
            <span key={f.label} className="px-2 py-1 rounded text-xs font-mono"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: f.color }}
              title={`Fórmula clave: ${f.label}`}>
              {f.label}
            </span>
          ))}
        </div>
        {/* Manual button */}
        <div className="ml-auto flex gap-2 mt-2">
          <Link href="/manual" className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap"
            style={{
              background: 'rgba(0,240,255,0.12)',
              border: '1px solid rgba(0,240,255,0.45)',
              color: '#00f0ff',
            }}
            title="Guía completa de uso de todos los simuladores">
            📖 Manual
          </Link>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="flex gap-2 mb-4 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActive(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
            style={{
              background: active === tab.id ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0.3)',
              border: `1px solid ${active === tab.id ? 'rgba(0,240,255,0.45)' : '#1a3350'}`,
            }}
            title={tab.desc}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono"
              style={{ background: active === tab.id ? '#00f0ff' : '#1a3350', color: active === tab.id ? '#000' : '#4a7090' }}>
              {tab.num}
            </span>
            <span className="text-xs font-mono"
              style={{ color: active === tab.id ? '#00f0ff' : '#6b9abb' }}>
              {tab.short}
            </span>
          </button>
        ))}
      </nav>

      {/* Active simulator */}
      <div className="physics-card p-3 md:p-5">
        <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1a3350' }}>
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold font-mono flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00f0ff' }}>
              {current.num}
            </span>
            <div>
              <h2 className="text-base font-bold font-mono" style={{ color: '#00f0ff' }}>
                {current.label}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{current.desc}</p>
            </div>
          </div>
        </div>

        <div>
          {active === 'circular'     && <CircularMotionSim />}
          {active === 'lorentz'      && <LorentzVectorSim />}
          {active === 'spectrometer' && <MassSpectrometerSim />}
        </div>
      </div>

      {/* Footer -- constants reference */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { icon: 'e',  label: 'Carga electron', val: '1.6×10^{-19} C', tooltip: 'Carga elemental e = 1.602×10^{-19} C' },
          { icon: 'me', label: 'Masa electron',  val: '9.11×10^{-31} kg', tooltip: 'M_e ≈ masa del electrón' },
          { icon: 'mp', label: 'Masa proton',    val: '1.67×10^{-27} kg', tooltip: 'M_p ≈ 1836 M_e, masa unidad atómica' },
          { icon: 'T',  label: '1 Tesla',        val: '1 kg/(A s²)', tooltip: 'Unidad SI campo magnético. 1 T = 10.000 Gauss' },
          { icon: 'G',  label: '1 Gauss',        val: '10^{-4} T', tooltip: 'Unidad CGS común en física experimental' },
          { icon: 'RHR', label: 'Regla mano der.', val: 'v ⊓ B → F', tooltip: 'Regla mano derecha: v × B da dirección fuerza Lorentz para q>0' },
        ].map(c => (
          <div key={c.label} className="p-2 rounded-lg text-center"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #1a3350' }}
            title={c.tooltip}>
            <div className="text-xs font-bold font-mono" style={{ color: '#00f0ff' }}>{c.icon}</div>
            <div className="text-xs text-gray-500 font-mono mt-0.5">{c.label}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#ffc832' }}>{c.val}</div>
          </div>
        ))}
      </div>
    </main>
  )
}
