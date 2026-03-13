# SimMag — Simulador de Fuerzas Magnéticas

Aplicación web interactiva para estudiantes de segundo año de Física II. Visualiza en 3D los tres fenómenos fundamentales del electromagnetismo: movimiento circular en campo magnético, fuerza de Lorentz con campos simultáneos y el funcionamiento del espectrómetro de masas.

---

## Simulaciones

### Sim 1 — Partícula en Campo Magnético Uniforme
Una partícula cargada que se mueve perpendicularmente a un campo **B** uniforme describe una trayectoria circular. La simulación muestra los vectores de velocidad y fuerza centrípeta en tiempo real y calcula `F`, `r`, `T`, `f` y `ω`.

### Sim 2 — Fuerza de Lorentz con Campos E y B
Calcula y visualiza la fuerza total `F = q(E + v×B)` con campos eléctrico y magnético simultáneos. Los vectores se renderizan en espacio 3D proporcionales a su magnitud. Incluye un panel con los cinco pasos de cálculo intermedios.

### Sim 3 — Espectrómetro de Masas
Animación en dos fases: el selector de velocidades donde la partícula avanza en línea recta cuando `v = E/B`, y la cámara de deflexión donde describe un semicírculo de radio `r = mv/(qB₀)`. El punto de aterrizaje en la placa fotográfica se marca en tiempo real.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.0 |
| UI | React | 18 |
| Lenguaje | TypeScript | 5 |
| Renderizado 3D | Three.js | 0.163.0 |
| Estilos | Tailwind CSS | 3.3 |

---

## Instalación y uso

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd magnetic-simulator

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev

# 4. Abrir en el navegador
# http://localhost:3000
```

```bash
# Build de producción
npm run build
npm start
```

**Requiere:** Node.js 18+, navegador con soporte WebGL (Chrome recomendado).

---

## Estructura del proyecto

```
magnetic-simulator/
│
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
│
└── app/
    ├── layout.tsx              Layout raíz (HTML, fuentes, metadata)
    ├── page.tsx                Página principal y navegación entre sims
    ├── globals.css             Variables CSS y estilos del tema oscuro
    │
    ├── lib/
    │   ├── physics.ts          Núcleo físico y operaciones vectoriales
    │   └── three-utils.ts      Utilidades Three.js y OrbitControls
    │
    └── components/
        ├── ParamControl.tsx    Componentes UI reutilizables
        └── simulators/
            ├── CircularMotionSim.tsx     Sim 1
            ├── LorentzVectorSim.tsx      Sim 2
            └── MassSpectrometerSim.tsx   Sim 3
```

---

## Módulo de física (`app/lib/physics.ts`)

Todas las ecuaciones están centralizadas en este módulo. Es independiente de React y puede importarse en cualquier contexto.

```typescript
// Operaciones vectoriales
vec3(x, y, z)           // Crea un vector 3D
cross(a, b)             // Producto vectorial a × b
dot(a, b)               // Producto escalar
magnitude(v)            // Módulo |v|
scale(v, s)             // Escala un vector
add(a, b)               // Suma vectorial

// Física
lorentzForce(q, v, B)           // F = q(v × B)
totalLorentzForce(q, v, E, B)   // F = q(E + v × B)
circularMotion(q, m, v, B)      // → { F, r, T, f }
massSpectrometer(E, B, B0, m, q) // → { v, r }
```

### Constantes disponibles

```typescript
ELECTRON_CHARGE = 1.6e-19   // C
ELECTRON_MASS   = 9.11e-31  // kg
PROTON_MASS     = 1.67e-27  // kg
```

---

## Componentes UI (`app/components/ParamControl.tsx`)

Componentes compartidos entre las tres simulaciones:

| Componente | Descripción |
|-----------|-------------|
| `ParamControl` | Control numérico con etiqueta y unidad. Muestra un campo editable y opcionalmente un slider. |
| `ResultsPanel` | Tabla de resultados calculados, con colores por variable |
| `FormulaBox` | Caja de ecuaciones clave de la simulación activa |
| `PlaybackControls` | Botones pausa / reset y slider de velocidad |
| `OrbitHint` | Indicador de controles del mouse sobre el canvas 3D |

---

## Ecuaciones implementadas

```
Sim 1 — Movimiento circular
  F = |q|vB              fuerza magnética (centrípeta)
  r = mv / (|q|B)        radio de la órbita
  T = 2πm / (|q|B)       período (independiente de v)
  f = |q|B / (2πm)       frecuencia ciclotrónica
  ω = 2πf                velocidad angular

Sim 2 — Fuerza de Lorentz
  v × B = (vyBz−vzBy,  vzBx−vxBz,  vxBy−vyBx)
  F = q(E + v × B)       fuerza total

Sim 3 — Espectrómetro de masas
  v = E / B              velocidad seleccionada
  r = mv / (qB₀)         radio en cámara de deflexión
  m = qB₀(2r) / (2v)    masa a partir de posición medida
```

---

## Controles del canvas 3D

| Acción | Resultado |
|--------|-----------|
| Click + arrastrar | Rotar la cámara |
| Scroll | Zoom in / out |
| Click derecho + arrastrar | Desplazar (pan) |

---

## Características técnicas

- **Sin dependencias de WebGL externas**: OrbitControls implementado desde cero para evitar importar el módulo externo de Three.js (incompatible con el bundler de Next.js).
- **Canvas responsive**: `ResizeObserver` actualiza el renderer y la cámara al cambiar el tamaño de ventana sin recargar la escena.
- **Limpieza de memoria**: `disposeGroup()` elimina geometrías y materiales de Three.js antes de redibujar en cada frame.
- **Trail sin artefactos**: la estela de trayectoria detecta el reinicio del ciclo comparando la fase anterior y limpia antes de conectar puntos distantes.
- **Layout adaptable**: `flexDirection: column` en móvil (canvas arriba, controles abajo), dos columnas en desktop ≥ 860px.

---

## Documentación adicional

| Documento | Contenido |
|-----------|-----------|
| `01_wireframes.docx` | Diseño de interfaz y layout de las 3 simulaciones |
| `02_manual_usuario.docx` | Guía de uso para el estudiante |
| `03_apunte_teorico_practico.docx` | Teoría, ejercicios resueltos y tabla de fórmulas |
