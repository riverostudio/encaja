import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import "./globals.css";
import Shell from "./componentes/Shell";

const display = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const texto = Inter({
  variable: "--font-texto",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar de Ayudas",
  description:
    "Todas las subvenciones y ayudas públicas de España, filtradas por tu territorio. Fuente oficial: BDNS.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>◎</text></svg>",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${texto.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
