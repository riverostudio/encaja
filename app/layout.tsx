import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import "./globals.css";
import Shell from "./componentes/Shell";
import Sesion from "./componentes/Sesion";

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
  title: "Encaja · ayudas públicas explicadas",
  description:
    "Todas las ayudas públicas de España, explicadas en cristiano. Te decimos si encajas y cómo pedirlas. Fuente oficial: BDNS.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>◎</text></svg>",
  },
};

// Fija la piel antes del primer pintado: sin parpadeo blanco al entrar en oscuro.
const GUION_TEMA = `(function(){try{
  var t = localStorage.getItem('tema');
  if(!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  document.documentElement.setAttribute('data-tema', t);
}catch(e){document.documentElement.setAttribute('data-tema','claro');}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-tema="claro" className={`${display.variable} ${texto.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Sesion />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
