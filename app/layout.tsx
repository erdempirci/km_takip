import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KM Takip',
  description: 'Şirket Aracı KM ve Devir Teslim Takip Uygulaması',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="bg-slate-100 antialiased">{children}</body>
    </html>
  );
}
