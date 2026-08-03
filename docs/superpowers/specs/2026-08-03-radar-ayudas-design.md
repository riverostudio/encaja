# Radar de Ayudas — Diseño

**Fecha:** 3 de agosto de 2026 · **Aprobado por:** Victor (en chat, "sigue")

## Qué es

Todas las subvenciones y ayudas económicas de España en un panel local. El usuario
elige territorio —por defecto Comunitat Valenciana, afinable por código postal—,
navega las ayudas, y cuando una le interesa la app le entrevista y dictamina si
encaja. Si encaja, la app monta el expediente: checklist de documentos, borradores
redactados con IA e instrucciones de presentación. Firmar y presentar queda
siempre en manos del usuario.

## Decisiones tomadas (con Victor, 3-ago-2026)

| Decisión | Elección |
|---|---|
| Alcance | Personal ahora, **vendible después**: perfil como dato, no hardcodeado |
| Cobertura | **Toda España**, selector de comunidad (defecto C. Valenciana) **+ código postal** |
| Profundidad | **Expediente listo para firmar** (borradores incluidos), nunca presentar por él |
| Detección | Sin vigilante automático: **entra él cuando quiera**; el panel grita los plazos |
| Avisos | Solo en el propio panel |
| Memoria | **Ficha persistente** que se rellena entrevista a entrevista; esquema multi-perfil |
| Tipos de ayuda | **Todo lo que da o ahorra dinero**: fondo perdido, préstamo, aval, ventaja fiscal, financiación riesgo |
| Ubicación | App nueva independiente en `~/radar-ayudas`, puerto 3002, fuera de Drive |
| Estilo | "Muy chulo, novedoso y sencillo": estética radar/sonar oscura, tipografía grande |
| IA | Gemini; la clave se pega en Ajustes de la app (o `.env.local`), nunca en código/git |
| Verificación | TDD en la lógica + **test en vivo final** contra la BDNS real |

## La fuente: BDNS (verificada en vivo el 3-ago-2026)

- API pública sin clave: `https://www.infosubvenciones.es/bdnstrans/api`
- Por ley (art. 20 LGS) **toda** convocatoria pública de España se publica ahí:
  Estado, CCAA, diputaciones, ayuntamientos, universidades. 646.363 convocatorias.
- Endpoints verificados con llamadas reales:
  - `GET /convocatorias/busqueda` — lista paginada. Parámetros que funcionan:
    `page`, `pageSize` (máx ~200), `order`, `direccion`, `regiones` (id del árbol
    NUTS; 54 = C. Valenciana **e incluye** las de ámbito "ES - España"),
    `beneficiarios`, `instrumentos`, `fechaDesde/fechaHasta` (dd/mm/yyyy, sobre
    fecha de registro), `descripcion` + `descripcionTipoBusqueda`,
    `tipoAdministracion` (C/A/L/O). El parámetro `abierto` NO filtra (verificado:
    mismo total) → el estado abierta/cerrada se calcula localmente con las fechas
    del detalle.
  - `GET /convocatorias?numConv=<código>` — detalle completo: `tiposBeneficiarios`,
    `sectores` (letra CNAE), `regiones`, `instrumentos`, `fechaInicioSolicitud`,
    `fechaFinSolicitud`, `abierto`, `presupuestoTotal`, `descripcionFinalidad`,
    `urlBasesReguladoras`, `sedeElectronica`, `documentos[]`, `fondos`, `mrr`.
  - `GET /convocatorias/documentos?idDocumento=<id>` — descarga el PDF de bases.
  - Catálogos: `/regiones` (árbol NUTS con ids), `/beneficiarios`, `/instrumentos`,
    `/finalidades`, `/actividades` (CNAE). Todos verificados.
  - `GET /convocatorias/exportar?tipoDoc=csv` — CSV masivo, pero con las MISMAS
    columnas que la lista (sin fechas de plazo) → no sustituye al detalle.
- La lista NO trae fechas de solicitud ni beneficiarios → **sync en dos niveles**
  (lista en masa, detalle en cola).
- Aviso legal BDNS: reutilización permitida con restricciones (citar fuente,
  datos dinámicos). La app enlaza siempre a la fuente oficial.

**Regla de oro:** la app nunca afirma nada que no pueda enseñar en el documento
oficial. Cada ficha enlaza sus bases (así no se cuela otra "Cuota Cero" fantasma).

## Arquitectura

- **Next.js 15 (App Router, TS) + Tailwind 4**, servidor local puerto 3002
  (3000 = World Monitor, 3001 = CRM caja7dias).
- **SQLite** (`better-sqlite3`) en `data/radar.db` (gitignored). Toda búsqueda del
  panel es local e instantánea; la API de la BDNS solo se toca al sincronizar.
- **Sin cron** (decisión de Victor): sync al abrir la app (si han pasado >6 h) +
  botón "Actualizar ahora". Banner "última actualización hace X" (rojo si >7 días).
- **Gemini** desde el servidor (nunca desde el navegador): clave en `.env.local`
  (`GEMINI_API_KEY`) o en Ajustes (tabla `ajustes`, gitignored con la DB).
  Modelo por defecto `gemini-2.5-flash`, configurable.
- **Expedientes** en `expedientes/<codigoBDNS>-<slug>/` (gitignored): DOCX
  generados con la librería `docx`, checklist e instrucciones en Markdown.

### Esquema de datos (SQLite)

- `convocatorias`: codigo_bdns PK, titulo, titulo_coof, nivel1/2/3, fecha_registro,
  mrr, detalle_json, detalle_at, fecha_inicio_sol, fecha_fin_sol, abierta,
  presupuesto, url_bases, sede, finalidad + columnas JSON (beneficiarios,
  instrumentos, sectores, regiones, fondos). Índices por fecha_fin_sol y nivel1.
  FTS5 sobre título + órgano para el buscador.
- `sync_runs`: territorio, desde, hasta, nuevas, detalles_pendientes, timestamp.
- `perfiles`: id, nombre (v1: un perfil "Victor"; multi-perfil = añadir filas).
- `hechos`: perfil_id, clave, valor, fuente ("entrevista <codigo>"/"manual"),
  updated_at. Es la ficha que se rellena.
- `evaluaciones`: convocatoria, perfil, dictamen (encaja/no/duda/pendiente),
  requisitos_json (extraídos de las bases), respuestas_json, motivo, updated_at.
- `expedientes`: convocatoria, perfil, estado (interesa→preparacion→presentada→
  concedida/denegada), carpeta, checklist_json, timestamps.
- `ajustes`: clave/valor (gemini_key, modelo, territorio_defecto, cp).

### Sync en dos niveles

1. **Lista** (barato): por territorio suscrito, `busqueda` con `regiones=<id>` y
   `fechaDesde` = último sync (backfill inicial: 12 meses). Upsert de filas lista.
2. **Detalle** (cola): para cada convocatoria sin detalle, `GET /convocatorias`
   → rellena fechas/beneficiarios/sectores. Orden: más recientes primero.
   Concurrencia limitada (4), reintentos con backoff, progreso visible en la UI.
   Refresco de detalle si la convocatoria sigue potencialmente abierta y el
   detalle tiene >7 días.
3. Territorio nuevo seleccionado → se suscribe y sincroniza on-demand con
   progreso. "Toda España" = búsqueda live paginada + cache, sin backfill total.

### Código postal → territorio

Dataset abierto CP→municipio (INE) empaquetado en `data/cp/` (~15k filas, CSV en
el repo). `resolverCP("46183")` → { municipio: "L'Eliana", provincia: "Valencia",
ccaa: "Comunitat Valenciana", idsRegion: [54, 57] }. El filtro añade las
convocatorias LOCAL cuyo órgano (nivel2/nivel3 normalizados: mayúsculas, sin
acentos, sin artículos L'/EL/LA, guiones) case con el municipio, su mancomunidad
o su diputación provincial. Tabla de alias manual para nombres cooficiales
(p. ej. "RIBA-ROJA DE TÚRIA"). El normalizador y el resolutor llevan tests.

## Las 3 plantas (UX)

### 1 · RADAR (`/`)
- Cabecera: selector Toda España / CCAA (defecto C. Valenciana) / provincia +
  caja de CP. Botón "Actualizar ahora" + "última actualización hace X".
- Filtros: tipo de instrumento, beneficiario (autónomo-pyme / persona física /
  sin actividad), estado (abiertas / abren pronto / todas), buscador FTS.
- Tarjetas grandes: título, órgano (con nivel LOCAL/CCAA/ESTADO), importe si
  consta, **plazo con semáforo**: 🔴 ≤7 días · 🟠 ≤21 · 🟢 abierta · ⏳ abre
  pronto · ⚫ cerrada · ❔ sin fechas publicadas ("consultar bases", enlazadas).
- Orden por defecto: abiertas que cierran antes, primero.
- Tarjeta → panel de detalle con todos los datos BDNS + enlace a bases y sede +
  botones "¿Encajo?" y "Al expediente".

### 2 · ENCAJE (entrevista, en el detalle)
- Fase estructural (sin IA, sin preguntas): beneficiario vs perfil, territorio
  vs perfil, plazo. Descarte inmediato con motivo si no cuadra.
- Fase bases (IA): descarga el PDF de bases (BDNS `documentos` o
  `urlBasesReguladoras`), Gemini extrae requisitos → JSON estructurado
  {id, texto_literal, tipo (dato|documento|condición), clave_perfil, pregunta}.
  Extracción cacheada por convocatoria en `evaluaciones.requisitos_json`.
- Entrevista: solo pregunta lo que la ficha no sepa, de una en una, estilo chat.
  Cada respuesta se guarda como `hecho` del perfil → la siguiente ayuda pregunta
  menos.
- Dictamen: ✅ ENCAJAS (requisitos con cita literal) · ❌ NO (requisito
  incumplido con el artículo exacto) · 🤔 DUDA (qué consultar y a quién).
  El dictamen SIEMPRE muestra el texto literal de las bases en que se apoya.
- Sin clave de Gemini: la fase estructural funciona igual; la fase bases muestra
  el aviso "pega tu clave en Ajustes" con enlace.

### 3 · EXPEDIENTE (`/expedientes`, `/expedientes/<codigo>`)
- "Al expediente" crea carpeta real `expedientes/<codigo>-<slug>/` + registro.
- Checklist de documentos (de los requisitos tipo "documento"): estado por ítem
  *lo tengo / hay que pedirlo / hay que redactarlo*, con notas.
- "Redactar" (IA): memoria técnica, declaraciones responsables, presupuesto →
  DOCX en la carpeta, marcados **BORRADOR** hasta revisión humana.
- `INSTRUCCIONES.md`: pasos de presentación (sede electrónica de la convocatoria,
  enlace, qué subir, plazo). La app NO firma ni presenta: límite de diseño.
- Tablero de estados: Interesa → En preparación → Presentada → Concedida/Denegada.

## Estilo visual

Estética **radar/sonar**: fondo oscuro azul-noche, acentos eléctricos (lima/cian),
tipografía display (Space Grotesk) + mono para importes y cuentas atrás, tarjetas
grandes, barrido de radar sutil en cabecera. Sencillez: 3 secciones (RADAR /
MI FICHA / EXPEDIENTES), cero manual, se entiende en 10 segundos. Móvil OK
(uso principal: Mac).

## Qué NO hace (a propósito)

- No firma, no presenta, no toca certificados FNMT.
- No da consejo fiscal/financiero personalizado: enseña requisitos literales
  y enlaza fuentes.
- Sin cron/vigilante (elección de Victor) — el código de sync queda invocable
  por CLI (`npm run sync`) para enchufarle un cron el día que quiera.
- Sin login ni nube en v1 (vendible después: perfil ya es dato, deploy futuro
  a Firebase como el CRM).

## Testing

- **Vitest**, TDD en la lógica pura: normalizador de nombres, resolutor de CP,
  reglas de encaje estructural, cálculo de semáforo de plazos, upsert de sync
  (fetch mockeado), montaje de checklist desde requisitos.
- La capa Gemini se testea con respuestas mockeadas (el parser de su JSON).
- **Test en vivo final** (pedido por Victor): arrancar, sincronizar BDNS real,
  entrevista con una ayuda real de la C. Valenciana, generar un expediente real,
  capturas en el navegador.

## Riesgos asumidos

- La BDNS puede limitar el API ante abuso → concurrencia 4, backoff, User-Agent
  identificable, sync incremental (nunca re-descarga histórico).
- Municipio↔órgano local es matching por nombre → alias manuales + tests; si un
  ayuntamiento no casa, la ayuda sigue visible a nivel CCAA (fallo suave).
- Los PDF de bases varían muchísimo → la extracción siempre enseña el literal y
  el dictamen degradado es DUDA, nunca un "sí" inventado.
- `pageSize` real del API puede ser <200 → el sync pagina hasta agotar, no asume.
