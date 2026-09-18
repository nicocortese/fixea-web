import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased bg-[#0b0d13] text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
