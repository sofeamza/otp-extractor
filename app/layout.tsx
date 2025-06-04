import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OTP extractor',
  description: 'Clic MMU OTP extractor'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
