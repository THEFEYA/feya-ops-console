import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'FEYA Ops Console',
  description: 'Операционная консоль управления лидогенерацией',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body className="font-sans antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'hsl(220 15% 10%)',
              border: '1px solid hsl(220 15% 20%)',
              color: 'hsl(210 40% 95%)',
            },
          }}
        />
      </body>
    </html>
  )
}
