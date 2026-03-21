'use client'
import Link from 'next/link'
import { ParamControl, FormulaBox, ResultsPanel } from '@/app/components/ParamControl'

export default function ManualPage() {
  return (
    <main className="relative z-10 min-h-screen p-2 md:p-5">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(to bottom, #00f0ff, #0070a0)' }} />
          <h1 className="text-2xl md:text-3xl font-bold"
            style={{ fontFamily: 'Orbitron, monospace', color: '#00f0ff', textShadow: '0 0 30px rgba(0,240,255,0.5)' }}>
            📖 Manual SimMag
          </h1>
        </div>
        <div className="ml-5 flex gap-3">
          <Link href="/" className="px-4 py-2 rounded-lg text-sm font-mono bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all">
            ← Volver a Simuladores
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sim 1: Circular */}
        <div className="physics-card p-6">
          <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1a3350' }}>
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold font-mono flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00f0ff' }}>
                1
              </span>
              <div>
                <h2 className="text-xl font-bold font-mono" style={{ color: '#00f0ff' }}>
                  Partícula en Campo Magnético
                </h2>
                <p className="text-sm text-gray-400 mt-1 font-mono">Trayectoria circular en B uniforme</p>
              </div>
            </div>
          </div>

          <FormulaBox title="Física clave" lines={[
            'F = q(v × B)  ← fuerza centrípeta',
            'r = mv / (|q|B)',
            'f = |q|B / (2πm)',
            'Dirección: regla mano derecha'
          ]} />

          <div className="mt-6 space-y-4 text-sm">
            <h3 className="font-bold text-cyan-400">Controles:</h3>
            <ul className="space-y-1 text-gray-300">
              <li>• <strong>q/e:</strong> Carga (neg=electron, pos=protón)</li>
              <li>• <strong>m/u:</strong> Masa en unidades atómicas</li>
              <li>• <strong>v:</strong> Velocidad inicial</li>
              <li>• <strong>B:</strong> Campo magnético</li>
              <li>• Play/Pausa, Reset, velocidades ×</li>
            </ul>
            <h3 className="font-bold text-cyan-400">Uso:</h3>
            <ol className="space-y-1 list-decimal ml-4 text-gray-300">
              <li>Ajusta parámetros → Observa trayectoria circular</li>
              <li>Prueba presets (e⁻, p⁺, α)</li>
              <li>Nota: radio inverso a |q|B, independiente de v</li>
            </ol>
          </div>
        </div>

        {/* Sim 2: Lorentz */}
        <div className="physics-card p-6">
          <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1a3350' }}>
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold font-mono flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00f0ff' }}>
                2
              </span>
              <div>
                <h2 className="text-xl font-bold font-mono" style={{ color: '#00f0ff' }}>
                  Fuerza con Campos E y B
                </h2>
                <p className="text-sm text-gray-400 mt-1 font-mono">F = q(E + v × B) — vectores descompuestos</p>
              </div>
            </div>
          </div>

          <FormulaBox title="Fuerza de Lorentz" lines={[
            'F = q(E + v × B)',
            'Fm = q(v × B)  ← perpendicular a v y B',
            'Fe = qE  ← paralela a E'
          ]} />

          <div className="mt-6 space-y-4 text-sm">
            <h3 className="font-bold text-cyan-400">Controles:</h3>
            <ul className="space-y-1 text-gray-300">
              <li>• Vectores <strong>v, E, B</strong> (componentes x,y,z)</li>
              <li>• <strong>q/e:</strong> signo de carga</li>
            </ul>
            <h3 className="font-bold text-cyan-400">Uso:</h3>
            <ol className="space-y-1 list-decimal ml-4 text-gray-300">
              <li>Varía vectores → ve Fm (rojo), Fe (azul), F total (amarillo)</li>
              <li>Revisa resultados: magnitudes, ángulo XY</li>
              <li>Prueba v || B → Fm=0</li>
            </ol>
          </div>
        </div>

        {/* Sim 3: Spectrometer */}
        <div className="physics-card p-6 col-span-1 lg:col-span-2">
          <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1a3350' }}>
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold font-mono flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00f0ff' }}>
                3
              </span>
              <div>
                <h2 className="text-xl font-bold font-mono" style={{ color: '#00f0ff' }}>
                  Espectrómetro de Masas
                </h2>
                <p className="text-sm text-gray-400 mt-1 font-mono">Selector v=E/B + separación por r=mv/qB</p>
              </div>
            </div>
          </div>

          <FormulaBox title="Etapas" lines={[
            '<strong>Selector:</strong> v = E/B  (solo velocidad correcta pasa)',
            '<strong>Cámara:</strong> r = mv / (|q|B₀)',
            '<strong>Detector:</strong> aterrizan a x=2r'
          ]} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-4 text-sm">
              <h3 className="font-bold text-cyan-400">Controles:</h3>
              <ul className="space-y-1 text-gray-300">
                <li>• <strong>Especie:</strong> +/- e⁻, H⁺, He⁺, He²⁺</li>
                <li>• <strong>E, B selector</strong> → fija v=E/B</li>
                <li>• <strong>B₀ cámara</strong>, voltaje placas</li>
              </ul>
            </div>
            <div className="space-y-4 text-sm">
              <h3 className="font-bold text-cyan-400">Uso:</h3>
              <ol className="space-y-1 list-decimal ml-4 text-gray-300">
                <li>Selecciona iones → animación paso a paso</li>
                <li>Ajusta E/B para seleccionar velocidad</li>
                <li>Varía B₀ → separa por radio/masa</li>
                <li>Observa detección en x=2r</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-500">
        <p>Controles 3D: arrastrar=rotar | shift+arrastrar=mover | scroll=zoom</p>
      </div>
    </main>
  )
}

