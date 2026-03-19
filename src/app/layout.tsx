import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

export const metadata: Metadata = {
  title: 'CYMS - ระบบบริหารจัดการลานตู้คอนเทนเนอร์อัจฉริยะ',
  description: 'Smart Container Yard Management System — ระบบบริหารจัดการลานตู้คอนเทนเนอร์แบบรวมศูนย์ รองรับ Multi-Yard, Real-time, Paperless',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
