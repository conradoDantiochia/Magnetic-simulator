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
    label: 'Particula en campo magnetico',
    short: 'Sim 1 -- Circular',
    desc: 'Movimiento circular en B uniforme. Incluye presets de la guia para Ej 1, Ej 3 y Ej 5.',
  },
  {
    id: 'lorentz',
    num: '2',
    label: 'Fuerza de Lorentz',
    short: 'Sim 2 -- Lorentz',
    desc: 'Entradas: carga q, velocidad v, campo electrico E y campo magnetico B. Incluye presets de la guia para Ej 2 a Ej 6.',
  },
  {
    id: 'spectrometer',
    num: '3',
    label: 'Espectrometro de masas',
    short: 'Sim 3 -- Espectrometro',
    desc: 'Entradas: E, B del selector, B0 de la camara, carga y masa. Incluye el preset exacto del Ej 7.',
  },
]

export default function HomePage() {
  const [active, setActive] = useState<TabId>('circular')
  const current = TABS.find((tab) => tab.id === active)!

  return (
    <main className="relative z-10 min-h-screen p-2 md:p-5">
      <header className="mb-4">
        <div className="mb-1 flex items-center gap-3">
          <div className="h-8 w-2 rounded-full" style={{ background: 'linear-gradient(to bottom, #00f0ff, #0070a0)' }} />
          <h1
            className="text-2xl font-bold md:text-3xl"
            style={{ fontFamily: 'Orbitron, monospace', color: '#00f0ff', textShadow: '0 0 30px rgba(0,240,255,0.5)' }}
          >
            SimMag
          </h1>
          <span className="hidden text-sm font-mono text-gray-500 sm:inline">Simulador de fuerzas magneticas</span>
        </div>

        <div className="ml-5 mt-2 flex flex-wrap gap-3">
          {[
            { label: 'F = q(v x B)', color: '#00f0ff' },
            { label: 'r = mv/(qB)', color: '#ffc832' },
            { label: 'v = E/B', color: '#ff3d6b' },
            { label: 'q/m = v/(rB0)', color: '#2dff6e' },
          ].map((formula) => (
            <span
              key={formula.label}
              className="rounded px-2 py-1 text-xs font-mono"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: formula.color }}
              title={`Formula clave: ${formula.label}`}
            >
              {formula.label}
            </span>
          ))}
        </div>

        <div className="ml-auto mt-2 flex gap-2">
          <Link
            href="/manual"
            className="flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-200 whitespace-nowrap"
            style={{
              background: 'rgba(0,240,255,0.12)',
              border: '1px solid rgba(0,240,255,0.45)',
              color: '#00f0ff',
            }}
            title="Guia completa de uso de los simuladores"
          >
            Manual
          </Link>
        </div>
      </header>

      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 transition-all duration-200"
            style={{
              background: active === tab.id ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0.3)',
              border: `1px solid ${active === tab.id ? 'rgba(0,240,255,0.45)' : '#1a3350'}`,
            }}
            title={tab.desc}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold font-mono"
              style={{ background: active === tab.id ? '#00f0ff' : '#1a3350', color: active === tab.id ? '#000' : '#4a7090' }}
            >
              {tab.num}
            </span>
            <span className="text-xs font-mono" style={{ color: active === tab.id ? '#00f0ff' : '#6b9abb' }}>
              {tab.short}
            </span>
          </button>
        ))}
      </nav>

      <div className="physics-card p-3 md:p-5">
        <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1a3350' }}>
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold font-mono"
              style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00f0ff' }}
            >
              {current.num}
            </span>
            <div>
              <h2 className="text-base font-bold font-mono" style={{ color: '#00f0ff' }}>
                {current.label}
              </h2>
              <p className="mt-0.5 text-xs font-mono text-gray-400">{current.desc}</p>
            </div>
          </div>
        </div>

        <div>
          {active === 'circular' && <CircularMotionSim />}
          {active === 'lorentz' && <LorentzVectorSim />}
          {active === 'spectrometer' && <MassSpectrometerSim />}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {[
          { icon: 'e', label: 'Carga electron', val: '1.6x10^-19 C', tooltip: 'Carga elemental e = 1.602x10^-19 C' },
          { icon: 'me', label: 'Masa electron', val: '9.11x10^-31 kg', tooltip: 'Masa del electron' },
          { icon: 'mp', label: 'Masa proton', val: '1.67x10^-27 kg', tooltip: 'Masa del proton' },
          { icon: 'T', label: '1 Tesla', val: '1 kg/(A s^2)', tooltip: 'Unidad SI del campo magnetico' },
          { icon: 'G', label: '1 Gauss', val: '10^-4 T', tooltip: 'Unidad CGS comun en laboratorio' },
          { icon: 'RHR', label: 'Mano derecha', val: 'v perpendicular B -> F', tooltip: 'Para q positiva, la direccion de v x B sigue la regla de la mano derecha' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg p-2 text-center"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #1a3350' }}
            title={card.tooltip}
          >
            <div className="text-xs font-bold font-mono" style={{ color: '#00f0ff' }}>{card.icon}</div>
            <div className="mt-0.5 text-xs font-mono text-gray-500">{card.label}</div>
            <div className="mt-0.5 text-xs font-mono" style={{ color: '#ffc832' }}>{card.val}</div>
          </div>
        ))}
      </div>
    </main>
  )
}
