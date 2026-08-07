"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  enviarLatido,
  leerMetricasLocales,
  registrarPaginaLocal,
  sumarTiempoLocal,
} from "../lib/metricas-cliente";

const INTERVALO = 15_000;
const SIGUE_ACTIVO = 2 * 60_000;

export default function MetricasSesion() {
  const ruta = usePathname();
  const ultimaInteraccion = useRef(0);
  const ultimoPulso = useRef(0);
  const ciclos = useRef(0);

  useEffect(() => {
    if (!ruta.startsWith("/admin")) registrarPaginaLocal();
  }, [ruta]);

  useEffect(() => {
    const inicio = Date.now();
    ultimaInteraccion.current = inicio;
    ultimoPulso.current = inicio;
    const activar = () => {
      ultimaInteraccion.current = Date.now();
    };
    const eventos: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "touchstart"];
    eventos.forEach((evento) => window.addEventListener(evento, activar, { passive: true }));
    const intervalo = window.setInterval(() => {
      const ahora = Date.now();
      const transcurrido = Math.min(30, Math.round((ahora - ultimoPulso.current) / 1000));
      ultimoPulso.current = ahora;
      if (document.visibilityState !== "visible" || ahora - ultimaInteraccion.current > SIGUE_ACTIVO) {
        return;
      }
      if (window.location.pathname.startsWith("/admin")) return;
      const metricas = sumarTiempoLocal(transcurrido, window.location.pathname === "/");
      ciclos.current += 1;
      if (ciclos.current % 4 === 0) enviarLatido(metricas);
    }, INTERVALO);
    const alSalir = () => enviarLatido(leerMetricasLocales(), true);
    window.addEventListener("pagehide", alSalir);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("pagehide", alSalir);
      eventos.forEach((evento) => window.removeEventListener(evento, activar));
    };
  }, []);

  return null;
}
