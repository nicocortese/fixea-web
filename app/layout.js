import "./globals.css";
import { Montserrat, Roboto_Mono } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata = {
  title: "FIXEA - Dashboard",
  description: "Plataforma de gestión y seguimiento de tickets",
  other: {
    "fixea-dashboard": "true",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${montserrat.variable} ${robotoMono.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="text-[#F1F5F9] font-sans antialiased"
      >
        {children}
      </body>
    </html>
  );
}
