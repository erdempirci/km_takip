import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Şirket Aracı KM Takip',
  description: 'Ortak araç kilometre ve devir teslim takip uygulaması',
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
