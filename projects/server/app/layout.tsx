import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientLayout from './components/Layout'
import { LayoutProvider } from './contexts/LayoutContext'
import { ModalProvider } from './contexts/ModalContext'
import { AlertsProvider } from './contexts/AlertsContext'
import { ComplianceProvider } from './contexts/ComplianceContext'

const inter = Inter({ 
  subsets: ['latin'],
  fallback: ['system-ui', 'arial']
})

export const metadata: Metadata = {
  title: 'Tool Vault',
  description: 'TeamSpark MCP Tool Vault - MCP Server management and monitoring application',
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ModalProvider>
          <LayoutProvider>
            <AlertsProvider>
              <ComplianceProvider>
                <ClientLayout>
                  {children}
                </ClientLayout>
              </ComplianceProvider>
            </AlertsProvider>
          </LayoutProvider>
        </ModalProvider>
      </body>
    </html>
  );
} 