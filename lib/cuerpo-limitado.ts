import "server-only";

export async function leerTextoLimitado(req: Request, maximoBytes: number): Promise<string | null> {
  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > maximoBytes) return null;
  const lector = req.body?.getReader();
  if (!lector) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximoBytes) {
      await lector.cancel();
      return null;
    }
    partes.push(value);
  }
  const unido = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    unido.set(parte, posicion);
    posicion += parte.byteLength;
  }
  return new TextDecoder().decode(unido);
}
