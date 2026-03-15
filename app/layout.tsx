import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SimMag — Simulador de Fuerzas Magnéticas',
  description: 'Simulador interactivo de física electromagnética',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
