import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { urlAbsoluta } from "./url-oficial";

interface DireccionDns {
  address: string;
  family: number;
}

interface RespuestaWeb {
  status: number;
  location?: string;
  contentType?: string;
  texto: string;
}

type Resolver = (hostname: string) => Promise<DireccionDns[]>;
type Solicitar = (
  url: URL,
  direccion: DireccionDns,
  timeoutMs: number,
  maxBytes: number,
) => Promise<RespuestaWeb>;

export interface OpcionesWebSegura {
  resolver?: Resolver;
  solicitar?: Solicitar;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirecciones?: number;
}

const REDIRECCIONES = new Set([301, 302, 303, 307, 308]);

function ipv4ANumero(ip: string): number {
  return ip.split(".").reduce((total, parte) => total * 256 + Number(parte), 0) >>> 0;
}

function enRangoIpv4(ip: number, base: string, bits: number): boolean {
  const mascara = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mascara) === (ipv4ANumero(base) & mascara);
}

function gruposIpv6(address: string): number[] | null {
  const limpia = address.toLowerCase().split("%")[0];
  const convertir = (parte: string): number[] => {
    if (!parte) return [];
    return parte.split(":").flatMap((grupo) => {
      if (!grupo.includes(".")) return [Number.parseInt(grupo, 16)];
      const ip = ipv4ANumero(grupo);
      return [(ip >>> 16) & 0xffff, ip & 0xffff];
    });
  };
  const lados = limpia.split("::");
  if (lados.length > 2) return null;
  const izquierda = convertir(lados[0]);
  const derecha = convertir(lados[1] ?? "");
  const ceros = lados.length === 2 ? 8 - izquierda.length - derecha.length : 0;
  const grupos = [...izquierda, ...Array.from({ length: ceros }, () => 0), ...derecha];
  return grupos.length === 8 && grupos.every((grupo) => Number.isFinite(grupo))
    ? grupos
    : null;
}

/** Solo direcciones globales: se excluyen redes privadas, locales y reservadas. */
export function esIpPublica(address: string): boolean {
  const tipo = net.isIP(address);
  if (tipo === 4) {
    const ip = ipv4ANumero(address);
    const reservadas: Array<[string, number]> = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return !reservadas.some(([base, bits]) => enRangoIpv4(ip, base, bits));
  }
  if (tipo === 6) {
    const grupos = gruposIpv6(address);
    if (!grupos) return false;
    const [g0, g1, g2] = grupos;
    // Solo global unicast (2000::/3), excluyendo rangos especiales que
    // encapsulan IPv4 o no son enrutable públicamente.
    if ((g0 & 0xe000) !== 0x2000) return false;
    if (g0 === 0x2002) return false; // 6to4
    if (g0 === 0x2001 && g1 === 0x0000) return false; // Teredo
    if (g0 === 0x2001 && g1 === 0x0002 && g2 === 0x0000) return false; // benchmark
    if (g0 === 0x2001 && g1 === 0x0db8) return false; // documentación
    if (g0 === 0x2001 && g1 >= 0x0010 && g1 <= 0x002f) return false; // ORCHID
    if (g0 === 0x3ffe) return false; // 6bone retirado
    if (g0 === 0x3fff && g1 <= 0x0fff) return false; // documentación
    return true;
  }
  return false;
}

const resolverPredeterminado: Resolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

async function conTimeout<T>(promesa: Promise<T>, timeoutMs: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promesa,
      new Promise<never>((_, reject) => {
        temporizador = setTimeout(() => reject(new Error("Tiempo de espera DNS agotado")), timeoutMs);
      }),
    ]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

const solicitarPredeterminado: Solicitar = (url, direccion, timeoutMs, maxBytes) =>
  new Promise((resolve, reject) => {
    const modulo = url.protocol === "https:" ? https : http;
    const req = modulo.request(
      {
        protocol: url.protocol,
        hostname: direccion.address,
        family: direccion.family,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        method: "GET",
        path: `${url.pathname}${url.search}`,
        servername: url.protocol === "https:" ? url.hostname : undefined,
        checkServerIdentity:
          url.protocol === "https:"
            ? (_host, cert) => tls.checkServerIdentity(url.hostname, cert)
            : undefined,
        headers: {
          Host: url.host,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
          "User-Agent": "Encaja/1.0 lector-seguro-de-bases",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = Array.isArray(res.headers.location)
          ? res.headers.location[0]
          : res.headers.location;
        const contentType = String(res.headers["content-type"] ?? "");
        const anunciado = Number(res.headers["content-length"] ?? 0);
        if (anunciado > maxBytes) {
          res.destroy(new Error("Respuesta externa demasiado grande"));
          return;
        }
        const partes: Buffer[] = [];
        let bytes = 0;
        res.on("data", (parte: Buffer | string) => {
          const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
          bytes += buffer.length;
          if (bytes > maxBytes) {
            res.destroy(new Error("Respuesta externa demasiado grande"));
            return;
          }
          partes.push(buffer);
        });
        res.on("end", () => {
          resolve({
            status,
            location,
            contentType,
            texto: Buffer.concat(partes).toString("utf8"),
          });
        });
        res.on("error", reject);
      },
    );
    const limiteTotal = setTimeout(
      () => req.destroy(new Error("Tiempo de espera agotado")),
      timeoutMs,
    );
    req.once("close", () => clearTimeout(limiteTotal));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Tiempo de espera agotado")));
    req.on("error", reject);
    req.end();
  });

/**
 * Descarga texto externo fijando la conexión a una IP pública ya validada.
 * Cada redirección vuelve a pasar por URL, DNS, puerto, tamaño y timeout.
 */
export async function descargarTextoWebSeguro(
  entrada: string,
  opciones: OpcionesWebSegura = {},
): Promise<{ url: string; texto: string; contentType: string }> {
  const resolver = opciones.resolver ?? resolverPredeterminado;
  const solicitar = opciones.solicitar ?? solicitarPredeterminado;
  const timeoutMs = opciones.timeoutMs ?? 10_000;
  const maxBytes = opciones.maxBytes ?? 1_000_000;
  const maxRedirecciones = opciones.maxRedirecciones ?? 4;
  let actual = urlAbsoluta(entrada);
  if (!actual) throw new Error("URL externa no válida");

  for (let salto = 0; salto <= maxRedirecciones; salto++) {
    const url = new URL(actual);
    const puerto = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    if (!((url.protocol === "https:" && puerto === 443) || (url.protocol === "http:" && puerto === 80))) {
      throw new Error("Puerto externo no permitido");
    }

    const direcciones = await conTimeout(resolver(url.hostname), timeoutMs);
    if (!direcciones.length || direcciones.some((direccion) => !esIpPublica(direccion.address))) {
      throw new Error("Destino externo no público");
    }
    const direccion = direcciones.find((item) => item.family === 4) ?? direcciones[0];
    const respuesta = await solicitar(url, direccion, timeoutMs, maxBytes);

    if (REDIRECCIONES.has(respuesta.status) && respuesta.location) {
      if (salto === maxRedirecciones) throw new Error("Demasiadas redirecciones externas");
      const siguiente = urlAbsoluta(new URL(respuesta.location, url).toString());
      if (!siguiente) throw new Error("Redirección externa no válida");
      actual = siguiente;
      continue;
    }
    if (respuesta.status < 200 || respuesta.status >= 300) {
      throw new Error(`Respuesta externa HTTP ${respuesta.status}`);
    }
    if (!/^(?:text\/|application\/(?:xhtml\+xml|xml))/i.test(respuesta.contentType ?? "")) {
      throw new Error("La fuente externa no es texto web");
    }
    if (Buffer.byteLength(respuesta.texto) > maxBytes) {
      throw new Error("Respuesta externa demasiado grande");
    }
    return { url: actual, texto: respuesta.texto, contentType: respuesta.contentType ?? "" };
  }
  throw new Error("No se pudo completar la descarga externa");
}
