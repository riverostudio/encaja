import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import "./globals.css";
import Shell from "./componentes/Shell";
import Sesion from "./componentes/Sesion";
import MetricasSesion from "./componentes/MetricasSesion";

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
    "Miles de ayudas públicas de España, explicadas en lenguaje claro. Comprueba si encajas y cómo pedirlas. Fuente oficial: BDNS.",
  // El icono sale de app/icon.svg y app/apple-icon.png: la bandera.
};

// Fija la piel antes del primer pintado: sin parpadeo blanco al entrar en oscuro.
const GUION_TEMA = `(function(){try{
  var t = localStorage.getItem('tema');
  if(!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  document.documentElement.setAttribute('data-tema', t);
  var a = JSON.parse(localStorage.getItem('encaja.accesibilidad.v1') || '{}');
  if(a.textoGrande) document.documentElement.setAttribute('data-texto-grande','');
  if(a.contrasteAlto) document.documentElement.setAttribute('data-contraste-alto','');
  if(a.reducirMovimiento) document.documentElement.setAttribute('data-reducir-movimiento','');
  if(a.lecturaFacil) document.documentElement.setAttribute('data-lectura-facil','');
}catch(e){document.documentElement.setAttribute('data-tema','claro');}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-tema="claro" className={`${display.variable} ${texto.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Sesion />
        <MetricasSesion />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
