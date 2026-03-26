'use client'

import Link from 'next/link'
import { FormulaBox } from '@/app/components/ParamControl'

export default function ManualPage() {
  return (
    <main className="relative z-10 min-h-screen p-2 md:p-5">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-3">
          <div className="h-8 w-2 rounded-full" style={{ background: 'linear-gradient(to bottom, #00f0ff, #0070a0)' }} />
          <h1
            className="text-2xl font-bold md:text-3xl"
            style={{ fontFamily: 'Orbitron, monospace', color: '#00f0ff', textShadow: '0 0 30px rgba(0,240,255,0.5)' }}
          >
            Manual SimMag
          </h1>
        </div>
        <div className="ml-5 flex gap-3">
          <Link href="/" className="rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm font-mono transition-all hover:bg-cyan-500/30">
            Volver a simuladores
          </Link>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="physics-card p-6">
          <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1a3350' }}>
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold font-mono"
                style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00f0ff' }}
              >
                1
              </span>
              <div>
                <h2 className="text-xl font-bold font-mono" style={{ color: '#00f0ff' }}>
                  Particula en campo magnetico
                </h2>
                <p className="mt-1 text-sm font-mono text-gray-400">Trayectoria circular en un campo B uniforme</p>
              </div>
            </div>
          </div>

          <FormulaBox
            title="Fisica clave"
            lines={[
              'F = q(v x B)',
              'r = mv / (|q|B)',
              'f = |q|B / (2*pi*m)',
            ]}
          />

          <div className="mt-6 space-y-4 text-sm text-gray-300">
            <div>
              <div className="font-bold text-cyan-400">Entradas</div>
              <p>q, m, v y B.</p>
            </div>
            <div>
              <div className="font-bold text-cyan-400">Ayudas de lectura</div>
              <p>Los ejes X, Y y Z se muestran en blanco como referencia y se puede activar una casilla para ver los valores en la propia pantalla.</p>
            </div>
            <div>
              <div className="font-bold text-cyan-400">Que observar</div>
              <p>Como cambian F, r, T y f cuando se modifica cada parametro y como el signo de q altera el sentido del giro.</p>
            </div>
          </div>
        </div>

        <div className="physics-card p-6">
          <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1a3350' }}>
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold font-mono"
                style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00f0ff' }}
              >
                2
              </span>
              <div>
                <h2 className="text-xl font-bold font-mono" style={{ color: '#00f0ff' }}>
                  Fuerza de Lorentz
                </h2>
                <p className="mt-1 text-sm font-mono text-gray-400">Como se combinan los campos E y B sobre una carga</p>
              </div>
            </div>
          </div>

          <FormulaBox
            title="Idea central"
            lines={[
              'F = q(E + v x B)',
              'Fm = q(v x B)',
              'Fe = qE',
            ]}
          />

          <div className="mt-6 space-y-4 text-sm text-gray-300">
            <div>
              <div className="font-bold text-cyan-400">Entradas</div>
              <p>q/e, componentes de v, componentes de B y componentes de E.</p>
            </div>
            <div>
              <div className="font-bold text-cyan-400">Como conviene usarla</div>
              <p>Empezar con los casos guiados: solo B, solo E, balance E-B y v paralela a B.</p>
            </div>
            <div>
              <div className="font-bold text-cyan-400">Que observar</div>
              <p>Cuando Fm desaparece, cuando Fe domina y cuando ambas fuerzas se suman o se compensan.</p>
            </div>
          </div>
        </div>

        <div className="physics-card col-span-1 p-6 lg:col-span-2">
          <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #1a3350' }}>
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold font-mono"
                style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00f0ff' }}
              >
                3
              </span>
              <div>
                <h2 className="text-xl font-bold font-mono" style={{ color: '#00f0ff' }}>
                  Espectrometro de masas
                </h2>
                <p className="mt-1 text-sm font-mono text-gray-400">Selector de velocidades y camara de deflexion</p>
              </div>
            </div>
          </div>

          <FormulaBox
            title="Etapas"
            lines={[
              'Selector: v = E / B',
              'Camara: r = m v / (|q|B0)',
              'Objetivo: |q|/m = v / (r B0)',
            ]}
          />

          <div className="mt-6 grid grid-cols-1 gap-6 text-sm text-gray-300 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="font-bold text-cyan-400">Variables de entrada</div>
                <p>E y B en el selector, B0 en la camara, carga y masa de la particula.</p>
              </div>
              <div>
                <div className="font-bold text-cyan-400">Que se persigue</div>
                <p>Relacionar la curvatura observada con la razon carga/masa.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="font-bold text-cyan-400">Lectura</div>
                <p>La velocidad seleccionada se calcula automaticamente como v = E / B y el panel destaca |q|/m como salida principal.</p>
              </div>
              <div>
                <div className="font-bold text-cyan-400">Nota de visualizacion</div>
                <p>La trayectoria del dibujo se reescala para verse con claridad; los valores fisicos correctos estan en r y en |q|/m.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-gray-500">
        <p>Controles 3D: arrastrar = rotar | shift + arrastrar = mover | scroll = zoom</p>
      </div>
    </main>
  )
}
