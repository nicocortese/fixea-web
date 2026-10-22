import "./globals.css";

// La metadata vive solo acá (Server Component). Las páginas son "use client",
// así que no pueden exportar metadata ni inyectar <head>/<title> a mano.
export const metadata = {
  title: "Fixea | Feedback visual de clientes",
  description:
    "Reportá y validá cambios visuales directamente sobre el sitio del cliente.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning={true}>
      <body
        className="antialiased bg-[#0B0C10] text-[#F1F5F9]"
        suppressHydrationWarning={true}
      >
        {children}
      </body>
    </html>
  );
}
