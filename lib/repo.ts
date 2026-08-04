import type Database from "better-sqlite3";
import type { Convocatoria, Evaluacion, Expediente, Hecho } from "./tipos";

export interface FiltrosBusqueda {
  texto?: string;
  nivel1?: string;
  instrumento?: string;
  beneficiario?: string;
  regionSync?: number;
  limite?: number;
}

interface FilaDb {
  codigo_bdns: string;
  titulo: string;
  titulo_coof: string | null;
  nivel1: string;
  nivel2: string;
  nivel3: string | null;
  fecha_registro: string | null;
  mrr: number;
  fecha_inicio_sol: string | null;
  fecha_fin_sol: string | null;
  abierta_flag: number | null;
  presupuesto: number | null;
  url_bases: string | null;
  sede: string | null;
  finalidad: string | null;
  beneficiarios: string;
  instrumentos: string;
  sectores: string;
  regiones: string;
  fondos: string;
  detalle_json: string | null;
  detalle_at: string | null;
  resumen_ia: string | null;
  resumen_at: string | null;
  fechas_del_pdf: number | null;
  sin_fechas_confirmado: number | null;
  plazo_relativo: string | null;
}

function aConvocatoria(f: FilaDb): Convocatoria {
  return {
    codigoBdns: f.codigo_bdns,
    titulo: f.titulo,
    tituloCoof: f.titulo_coof,
    nivel1: f.nivel1,
    nivel2: f.nivel2,
    nivel3: f.nivel3,
    fechaRegistro: f.fecha_registro ?? "",
    mrr: Boolean(f.mrr),
    fechaInicioSol: f.fecha_inicio_sol,
    fechaFinSol: f.fecha_fin_sol,
    abiertaFlag: f.abierta_flag === null ? null : Boolean(f.abierta_flag),
    presupuesto: f.presupuesto,
    urlBases: f.url_bases,
    sede: f.sede,
    finalidad: f.finalidad,
    beneficiarios: JSON.parse(f.beneficiarios),
    instrumentos: JSON.parse(f.instrumentos),
    sectores: JSON.parse(f.sectores),
    regiones: JSON.parse(f.regiones),
    fondos: JSON.parse(f.fondos),
    detalleAt: f.detalle_at,
    detalleJson: f.detalle_json,
    resumenIa: f.resumen_ia,
    resumenAt: f.resumen_at,
    fechasDelPdf: Boolean(f.fechas_del_pdf),
    sinFechasConfirmado: Boolean(f.sin_fechas_confirmado),
    plazoRelativo: f.plazo_relativo,
  };
}

/** Minúsculas y sin acentos, para que «energetica» encuentre «energética». */
function pelar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function crearRepo(db: Database.Database) {
  const ahora = () => new Date().toISOString();
  // SQLite no sabe de acentos: se le enseña.
  db.function("pelar", { deterministic: true }, (s: unknown) => pelar(String(s ?? "")));

  const stUpsertLista = db.prepare(`
    INSERT INTO convocatorias (codigo_bdns, titulo, titulo_coof, nivel1, nivel2, nivel3, fecha_registro, mrr, region_sync)
    VALUES (@codigoBdns, @titulo, @tituloCoof, @nivel1, @nivel2, @nivel3, @fechaRegistro, @mrr, @regionSync)
    ON CONFLICT(codigo_bdns) DO UPDATE SET
      titulo=excluded.titulo, titulo_coof=excluded.titulo_coof,
      nivel1=excluded.nivel1, nivel2=excluded.nivel2, nivel3=excluded.nivel3,
      fecha_registro=excluded.fecha_registro, mrr=excluded.mrr,
      region_sync=coalesce(excluded.region_sync, convocatorias.region_sync)
  `);

  const stUpsertDetalle = db.prepare(`
    UPDATE convocatorias SET
      fecha_inicio_sol=@fechaInicioSol, fecha_fin_sol=@fechaFinSol,
      abierta_flag=@abiertaFlag, presupuesto=@presupuesto, url_bases=@urlBases,
      sede=@sede, finalidad=@finalidad, beneficiarios=@beneficiarios,
      instrumentos=@instrumentos, sectores=@sectores, regiones=@regiones,
      fondos=@fondos, detalle_json=@detalleJson, detalle_at=@detalleAt
    WHERE codigo_bdns=@codigoBdns
  `);

  const repo = {
    upsertLista(filas: Convocatoria[], regionSync?: number): number {
      const tx = db.transaction((fs: Convocatoria[]) => {
        for (const f of fs) {
          stUpsertLista.run({
            codigoBdns: f.codigoBdns,
            titulo: f.titulo,
            tituloCoof: f.tituloCoof ?? null,
            nivel1: f.nivel1 ?? "",
            nivel2: f.nivel2 ?? "",
            nivel3: f.nivel3 ?? null,
            fechaRegistro: f.fechaRegistro ?? null,
            mrr: f.mrr ? 1 : 0,
            regionSync: regionSync ?? null,
          });
        }
      });
      tx(filas);
      return filas.length;
    },

    upsertDetalle(c: Convocatoria): void {
      // Si la fila lista no existe aún (detalle directo), la creamos primero.
      stUpsertLista.run({
        codigoBdns: c.codigoBdns,
        titulo: c.titulo,
        tituloCoof: c.tituloCoof ?? null,
        nivel1: c.nivel1 ?? "",
        nivel2: c.nivel2 ?? "",
        nivel3: c.nivel3 ?? null,
        fechaRegistro: c.fechaRegistro ?? null,
        mrr: c.mrr ? 1 : 0,
        regionSync: null,
      });
      stUpsertDetalle.run({
        codigoBdns: c.codigoBdns,
        fechaInicioSol: c.fechaInicioSol ?? null,
        fechaFinSol: c.fechaFinSol ?? null,
        abiertaFlag: c.abiertaFlag == null ? null : c.abiertaFlag ? 1 : 0,
        presupuesto: c.presupuesto ?? null,
        urlBases: c.urlBases ?? null,
        sede: c.sede ?? null,
        finalidad: c.finalidad ?? null,
        beneficiarios: JSON.stringify(c.beneficiarios ?? []),
        instrumentos: JSON.stringify(c.instrumentos ?? []),
        sectores: JSON.stringify(c.sectores ?? []),
        regiones: JSON.stringify(c.regiones ?? []),
        fondos: JSON.stringify(c.fondos ?? []),
        detalleJson: c.detalleJson ?? JSON.stringify({}),
        detalleAt: c.detalleAt ?? ahora(),
      });
    },

    pendientesDetalle(limite: number): Convocatoria[] {
      const filas = db
        .prepare(
          `SELECT * FROM convocatorias WHERE detalle_at IS NULL
           ORDER BY fecha_registro DESC LIMIT ?`,
        )
        .all(limite) as FilaDb[];
      return filas.map(aConvocatoria);
    },

    getConvocatoria(codigo: string): Convocatoria | null {
      const f = db
        .prepare(`SELECT * FROM convocatorias WHERE codigo_bdns=?`)
        .get(codigo) as FilaDb | undefined;
      return f ? aConvocatoria(f) : null;
    },

    buscar(filtros: FiltrosBusqueda): Convocatoria[] {
      const cond: string[] = [];
      const params: Record<string, unknown> = {};
      if (filtros.texto) {
        // Un texto puede traer varias alternativas separadas por "|": basta con
        // que case UNA. Los atajos las usan porque el BOE llama "pobreza
        // energética" a lo que la gente busca como "luz" o "suministros".
        const CAMPOS = `pelar(titulo || ' ' || coalesce(titulo_coof,'') || ' ' || nivel2 || ' ' ||
              coalesce(nivel3,'') || ' ' || coalesce(finalidad,'') || ' ' || sectores)`;
        const alternativas = filtros.texto
          .split("|")
          .map((t) => pelar(t).trim())
          .filter(Boolean);

        const orCond: string[] = [];
        alternativas.forEach((alt, a) => {
          // Dentro de una alternativa, TODAS sus palabras deben aparecer.
          const palabras = alt.split(/\s+/).filter((p) => p.length > 1);
          if (palabras.length === 0) return;
          const andCond = palabras.map((palabra, i) => {
            params[`p${a}_${i}`] = `%${palabra}%`;
            return `${CAMPOS} LIKE @p${a}_${i}`;
          });
          orCond.push(`(${andCond.join(" AND ")})`);
        });
        if (orCond.length > 0) cond.push(`(${orCond.join(" OR ")})`);
      }
      if (filtros.nivel1) {
        cond.push(`nivel1=@nivel1`);
        params.nivel1 = filtros.nivel1;
      }
      if (filtros.instrumento) {
        cond.push(`instrumentos LIKE @instrumento`);
        params.instrumento = `%${filtros.instrumento}%`;
      }
      if (filtros.beneficiario) {
        cond.push(`beneficiarios LIKE @beneficiario`);
        params.beneficiario = `%${filtros.beneficiario}%`;
      }
      if (filtros.regionSync != null) {
        cond.push(`(region_sync=@regionSync OR nivel1='ESTADO')`);
        params.regionSync = filtros.regionSync;
      }
      const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
      const filas = db
        .prepare(
          `SELECT * FROM convocatorias ${where}
           ORDER BY fecha_registro DESC LIMIT @limite`,
        )
        .all({ limite: filtros.limite ?? 500, ...params }) as FilaDb[];
      return filas.map(aConvocatoria);
    },

    contar(): number {
      const r = db.prepare(`SELECT count(*) n FROM convocatorias`).get() as { n: number };
      return r.n;
    },

    contarPendientes(): number {
      const r = db
        .prepare(`SELECT count(*) n FROM convocatorias WHERE detalle_at IS NULL`)
        .get() as { n: number };
      return r.n;
    },

    guardarResumen(codigo: string, resumenJson: string): void {
      db.prepare(`UPDATE convocatorias SET resumen_ia=?, resumen_at=? WHERE codigo_bdns=?`).run(
        resumenJson,
        ahora(),
        codigo,
      );
    },

    /** Plazo leído del PDF de las bases, no publicado en la BDNS. */
    guardarFechasRescatadas(
      codigo: string,
      inicio: string | null,
      fin: string | null,
      relativo: string | null,
    ): void {
      db.prepare(
        `UPDATE convocatorias SET fecha_inicio_sol=coalesce(?, fecha_inicio_sol),
           fecha_fin_sol=coalesce(?, fecha_fin_sol), plazo_relativo=?, fechas_del_pdf=1
         WHERE codigo_bdns=?`,
      ).run(inicio, fin, relativo, codigo);
    },

    /** Ya se miró el PDF y tampoco estaban: no se vuelve a intentar. */
    marcarSinFechas(codigo: string): void {
      db.prepare(`UPDATE convocatorias SET sin_fechas_confirmado=1 WHERE codigo_bdns=?`).run(codigo);
    },

    setHecho(perfilId: number, clave: string, valor: string, fuente: string): void {
      db.prepare(
        `INSERT INTO hechos (perfil_id, clave, valor, fuente, updated_at)
         VALUES (?,?,?,?,?)
         ON CONFLICT(perfil_id, clave) DO UPDATE SET valor=excluded.valor,
           fuente=excluded.fuente, updated_at=excluded.updated_at`,
      ).run(perfilId, clave, valor, fuente, ahora());
    },

    borrarHecho(perfilId: number, clave: string): void {
      db.prepare(`DELETE FROM hechos WHERE perfil_id=? AND clave=?`).run(perfilId, clave);
    },

    getHechos(perfilId: number): Map<string, string> {
      const filas = db
        .prepare(`SELECT clave, valor FROM hechos WHERE perfil_id=?`)
        .all(perfilId) as { clave: string; valor: string }[];
      return new Map(filas.map((f) => [f.clave, f.valor]));
    },

    getHechosDetalle(perfilId: number): Hecho[] {
      return (
        db
          .prepare(
            `SELECT clave, valor, fuente, updated_at as updatedAt FROM hechos WHERE perfil_id=? ORDER BY clave`,
          )
          .all(perfilId) as Hecho[]
      );
    },

    guardarEvaluacion(
      codigo: string,
      perfilId: number,
      datos: Partial<{
        dictamen: string;
        requisitosJson: string;
        veredictosJson: string;
        motivosJson: string;
      }>,
    ): void {
      const previa = repo.getEvaluacion(codigo, perfilId);
      db.prepare(
        `INSERT INTO evaluaciones (codigo_bdns, perfil_id, dictamen, requisitos_json, veredictos_json, motivos_json, updated_at)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(codigo_bdns, perfil_id) DO UPDATE SET
           dictamen=excluded.dictamen, requisitos_json=excluded.requisitos_json,
           veredictos_json=excluded.veredictos_json, motivos_json=excluded.motivos_json,
           updated_at=excluded.updated_at`,
      ).run(
        codigo,
        perfilId,
        datos.dictamen ?? previa?.dictamen ?? "pendiente",
        datos.requisitosJson ?? previa?.requisitosJson ?? null,
        datos.veredictosJson ?? previa?.veredictosJson ?? null,
        datos.motivosJson ?? previa?.motivosJson ?? null,
        ahora(),
      );
    },

    getEvaluacion(codigo: string, perfilId: number): Evaluacion | null {
      const f = db
        .prepare(
          `SELECT codigo_bdns as codigoBdns, perfil_id as perfilId, dictamen,
                  requisitos_json as requisitosJson, veredictos_json as veredictosJson,
                  motivos_json as motivosJson, updated_at as updatedAt
           FROM evaluaciones WHERE codigo_bdns=? AND perfil_id=?`,
        )
        .get(codigo, perfilId) as Evaluacion | undefined;
      return f ?? null;
    },

    crearExpediente(codigo: string, perfilId: number, carpeta: string, checklistJson: string): void {
      db.prepare(
        `INSERT OR IGNORE INTO expedientes (codigo_bdns, perfil_id, estado, carpeta, checklist_json, creado_at, updated_at)
         VALUES (?,?,'interesa',?,?,?,?)`,
      ).run(codigo, perfilId, carpeta, checklistJson, ahora(), ahora());
    },

    actualizarExpediente(
      codigo: string,
      datos: Partial<{ estado: string; checklistJson: string }>,
    ): void {
      if (datos.estado) {
        db.prepare(`UPDATE expedientes SET estado=?, updated_at=? WHERE codigo_bdns=?`).run(
          datos.estado,
          ahora(),
          codigo,
        );
      }
      if (datos.checklistJson) {
        db.prepare(`UPDATE expedientes SET checklist_json=?, updated_at=? WHERE codigo_bdns=?`).run(
          datos.checklistJson,
          ahora(),
          codigo,
        );
      }
    },

    getExpediente(codigo: string): Expediente | null {
      const f = db
        .prepare(
          `SELECT codigo_bdns as codigoBdns, perfil_id as perfilId, estado, carpeta,
                  checklist_json as checklistJson, creado_at as creadoAt, updated_at as updatedAt
           FROM expedientes WHERE codigo_bdns=?`,
        )
        .get(codigo) as Expediente | undefined;
      return f ?? null;
    },

    listarExpedientes(): Expediente[] {
      return db
        .prepare(
          `SELECT codigo_bdns as codigoBdns, perfil_id as perfilId, estado, carpeta,
                  checklist_json as checklistJson, creado_at as creadoAt, updated_at as updatedAt
           FROM expedientes ORDER BY updated_at DESC`,
        )
        .all() as Expediente[];
    },

    setAjuste(clave: string, valor: string): void {
      db.prepare(
        `INSERT INTO ajustes (clave, valor) VALUES (?,?)
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`,
      ).run(clave, valor);
    },

    getAjuste(clave: string): string | null {
      const f = db.prepare(`SELECT valor FROM ajustes WHERE clave=?`).get(clave) as
        | { valor: string }
        | undefined;
      return f?.valor ?? null;
    },

    registrarSync(territorio: number, desde: string, hasta: string, nuevas: number): void {
      db.prepare(
        `INSERT INTO sync_runs (territorio, desde, hasta, nuevas, ts) VALUES (?,?,?,?,?)`,
      ).run(territorio, desde, hasta, nuevas, ahora());
    },

    ultimoSync(territorio: number): { desde: string; hasta: string; nuevas: number; ts: string } | null {
      const f = db
        .prepare(
          `SELECT desde, hasta, nuevas, ts FROM sync_runs WHERE territorio=? ORDER BY id DESC LIMIT 1`,
        )
        .get(territorio) as { desde: string; hasta: string; nuevas: number; ts: string } | undefined;
      return f ?? null;
    },

    ultimoSyncGlobal(): { ts: string } | null {
      const f = db.prepare(`SELECT ts FROM sync_runs ORDER BY id DESC LIMIT 1`).get() as
        | { ts: string }
        | undefined;
      return f ?? null;
    },
  };

  return repo;
}

export type Repo = ReturnType<typeof crearRepo>;
