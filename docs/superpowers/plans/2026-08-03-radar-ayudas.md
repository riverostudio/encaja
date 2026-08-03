# Radar de Ayudas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App local (Next.js, puerto 3002) que sincroniza la BDNS, muestra todas las ayudas de España filtrables por territorio/CP, entrevista al usuario para dictaminar encaje y monta expedientes con borradores DOCX.

**Architecture:** Next.js 15 App Router con API routes como capa fina sobre módulos puros en `lib/` (testables con Vitest). SQLite (better-sqlite3) como cache local de la BDNS + estado de perfil/evaluaciones/expedientes. Gemini solo server-side. Sync en dos niveles: lista en masa + cola de detalles.

**Tech Stack:** Next.js 15 (TS, App Router), Tailwind 4, better-sqlite3, docx, Vitest, API BDNS (`https://www.infosubvenciones.es/bdnstrans/api`), Gemini API.

## Global Constraints

- Node ≥22. Puerto **3002** (3000 = World Monitor, 3001 = CRM).
- Repo en `~/radar-ayudas` (NUNCA en Drive). `data/`, `expedientes/`, `.env.local` gitignored.
- La clave Gemini nunca en código/git: `.env.local` (`GEMINI_API_KEY`) o tabla `ajustes`.
- Todo texto de UI en español. Cada dato de ayuda enlaza su fuente oficial BDNS.
- La app no firma ni presenta nada ante la Administración.
- BDNS: concurrencia máx 4, `User-Agent: radar-ayudas-local/1.0`, sync incremental.
- Tests: `npx vitest run` verde antes de cada commit. Commits frecuentes con mensajes `feat:`/`fix:`/`test:`.
- Los módulos de `lib/` no importan nada de Next/React (puros, testables).

## File Structure

```
lib/tipos.ts          — tipos compartidos (Convocatoria, Requisito, Hecho, Dictamen…)
lib/db.ts             — apertura SQLite + migración de esquema (idempotente)
lib/repo.ts           — CRUD: convocatorias, hechos, evaluaciones, expedientes, ajustes
lib/plazos.ts         — semáforo de plazos (puro)
lib/territorio.ts     — normalizador de nombres + resolutor CP + match órgano local
lib/bdns.ts           — cliente HTTP BDNS (busqueda, detalle, catálogos, PDF bases)
lib/sync.ts           — sync 2 niveles con cola de detalles
lib/encaje.ts         — evaluación estructural (sin IA)
lib/gemini.ts         — cliente Gemini server-side (clave env/ajustes)
lib/requisitos.ts     — extracción de requisitos de bases + parser JSON + siguientePregunta
lib/dictamen.ts       — combina estructural + veredictos → dictamen final
lib/expediente.ts     — carpeta, checklist, DOCX borradores, INSTRUCCIONES.md
datasets/cp-municipios.csv — dataset abierto CP→municipio/provincia/CCAA (committed)
scripts/sync.mjs      — CLI `npm run sync` (mismo motor, enchufable a cron futuro)
app/api/…             — routes finas: sync, convocatorias, encaje, expedientes, ajustes
app/(ui)              — RADAR (/), /ficha, /expedientes, /expedientes/[codigo]
tests/*.test.ts       — Vitest por módulo
```

---

### Task 1: Tipos + DB + repositorio

**Files:** Create `lib/tipos.ts`, `lib/db.ts`, `lib/repo.ts`, `tests/repo.test.ts`

**Interfaces (Produces):**
- `abrirDb(ruta?: string): Database` — migra el esquema si falta (CREATE TABLE IF NOT EXISTS). Por defecto `data/radar.db`; en tests, ruta `:memory:`.
- `Convocatoria` (tipo): `{ codigoBdns: string; titulo: string; tituloCoof?: string|null; nivel1: string; nivel2: string; nivel3: string|null; fechaRegistro: string; mrr: boolean; fechaInicioSol?: string|null; fechaFinSol?: string|null; abiertaFlag?: boolean|null; presupuesto?: number|null; urlBases?: string|null; sede?: string|null; finalidad?: string|null; beneficiarios: string[]; instrumentos: string[]; sectores: string[]; regiones: string[]; fondos: string[]; detalleAt?: string|null; detalleJson?: string|null }`
- `Repo` con: `upsertLista(filas)`, `upsertDetalle(conv)`, `pendientesDetalle(limite)`, `buscar(filtros)` (filtros: `{ texto?, nivel1?, instrumento?, beneficiario?, estadoPlazo?, regionesLike?, organosLocales? }`), `getConvocatoria(codigo)`, `setHecho/getHechos(perfilId)`, `guardarEvaluacion/getEvaluacion`, `crearExpediente/actualizarExpediente/listarExpedientes`, `setAjuste/getAjuste`, `registrarSync/ultimoSync`.
- Esquema SQL del spec (tablas: convocatorias, sync_runs, perfiles, hechos, evaluaciones, expedientes, ajustes; perfil 1 "Victor" sembrado).

- [ ] **Paso 1:** Escribir `tests/repo.test.ts` con: (a) `abrirDb(':memory:')` dos veces no falla (migración idempotente); (b) `upsertLista` inserta y re-upsert no duplica (mismo codigoBdns); (c) `upsertDetalle` rellena fechas y `pendientesDetalle` deja de devolverla; (d) `setHecho` sobrescribe valor y `getHechos` lo devuelve; (e) `buscar({texto})` encuentra por título (FTS o LIKE).
- [ ] **Paso 2:** `npx vitest run` → FALLA (módulos no existen).
- [ ] **Paso 3:** Implementar `lib/tipos.ts`, `lib/db.ts`, `lib/repo.ts` mínimos para pasar.
- [ ] **Paso 4:** `npx vitest run` → VERDE.
- [ ] **Paso 5:** `git commit -m "feat: base de datos y repositorio"`

### Task 2: Semáforo de plazos

**Files:** Create `lib/plazos.ts`, `tests/plazos.test.ts`

**Interfaces (Produces):**
- `estadoPlazo(inicio: string|null|undefined, fin: string|null|undefined, hoy?: Date): { estado: 'urgente'|'aviso'|'abierta'|'proxima'|'cerrada'|'sin_fechas'; dias: number|null }`
  - `urgente` = abierta y quedan ≤7 días · `aviso` = ≤21 · `abierta` = resto abierta
  - `proxima` = inicio en el futuro (dias = hasta apertura) · `cerrada` = fin pasado
  - `sin_fechas` = sin inicio ni fin. Fechas ISO `YYYY-MM-DD`; fin inclusive.

- [ ] **Paso 1:** Test con hoy=2026-08-03: fin 2026-08-05→urgente(2), fin 2026-08-20→aviso(17), fin 2026-10-29→abierta(87), inicio 2026-09-15→proxima(43), fin 2026-07-31→cerrada, nulls→sin_fechas, inicio pasado sin fin→abierta(dias null).
- [ ] **Paso 2:** Rojo. **Paso 3:** Implementar. **Paso 4:** Verde. **Paso 5:** commit `feat: semáforo de plazos`.

### Task 3: Territorio — normalizador, CP, match local

**Files:** Create `lib/territorio.ts`, `datasets/cp-municipios.csv`, `tests/territorio.test.ts`

**Interfaces (Produces):**
- `normalizar(s: string): string` — mayúsculas, sin acentos/diéresis, sin artículos iniciales (EL/LA/LOS/LAS/L'/ELS/LES), guiones y separadores → espacio, colapsa espacios. `"L'Eliana"→"ELIANA"`, `"Riba-roja de Túria"→"RIBA ROJA DE TURIA"`.
- `resolverCP(cp: string): { municipio: string; provincia: string; ccaa: string; regionIds: number[] } | null` — desde el CSV (columnas `cp,municipio,provincia,ccaa`). regionIds = [id CCAA, id provincia] del árbol BDNS (mapa estático `CCAA_REGION` en el módulo con los 19 ids + provincias, copiado del endpoint `/regiones` verificado: C. Valenciana=54, Alicante=55, Castellón=56, Valencia=57…).
- `esOrganoDeMiZona(nivel2: string, nivel3: string|null, zona: {municipio,provincia}): boolean` — true si nivel2/3 normalizados contienen el municipio normalizado, o son la diputación/mancomunidad de la provincia.
- `CCAAS: {id:number; nombre:string}[]` para el selector de la UI.
- Dataset: descargar CSV abierto CP→municipio (repo `inigoflores/ds-codigos-postales`, licencia abierta; ~15k CP). Si la descarga falla, generarlo desde otra fuente abierta de datos.gob.es. Committed en `datasets/`.

- [ ] **Paso 1:** Tests: normalizar los ejemplos de arriba; `resolverCP('46183')` → L'Eliana/Valencia/C. Valenciana con ids [54,57]; `resolverCP('28013')` → Madrid; `esOrganoDeMiZona('PAIPORTA','AYUNTAMIENTO DE PAIPORTA',{municipio:'Paiporta',provincia:'Valencia'})` true; `('VALENCIA','DIPUTACIÓN PROVINCIAL DE VALENCIA',…)` true; `('VILOBÍ D\'ONYAR',…)` false.
- [ ] **Paso 2:** Rojo. **Paso 3:** Descargar dataset + implementar. **Paso 4:** Verde. **Paso 5:** commit `feat: territorio y código postal`.

### Task 4: Cliente BDNS

**Files:** Create `lib/bdns.ts`, `tests/bdns.test.ts`

**Interfaces (Produces):**
- `buscarPagina(opts: { regiones?: number[]; fechaDesde?: string; fechaHasta?: string; page: number; pageSize?: number }, fetchFn?): Promise<{ filas: FilaLista[]; totalPaginas: number; total: number }>` — GET `/convocatorias/busqueda?vpd=GE&order=fechaRecepcion&direccion=desc…` (fechas dd/mm/yyyy).
- `FilaLista = { codigoBdns, titulo, tituloCoof, nivel1, nivel2, nivel3, fechaRegistro, mrr }` (mapea `numeroConvocatoria→codigoBdns`, `descripcion→titulo`, `fechaRecepcion→fechaRegistro`).
- `detalle(codigoBdns, fetchFn?): Promise<Convocatoria>` — GET `/convocatorias?numConv=…`, mapea `tiposBeneficiarios[].descripcion→beneficiarios[]` etc., fechas a ISO.
- `descargarBases(conv, fetchFn?): Promise<{ tipo:'pdf'|'html'; datos: Buffer|string } | null>` — primero `documentos[0]` vía `/convocatorias/documentos?idDocumento=`, si no `urlBases`.
- Todas aceptan `fetchFn` inyectable (default `fetch` global con User-Agent y timeout 30s) para testear con mocks.

- [ ] **Paso 1:** Tests con `fetchFn` mock devolviendo JSON real capturado (fixture con la respuesta verificada de Riba-roja 923287): mapeo de campos, fechas ISO, paginación (totalPages), y que `regiones=[54]` serializa `regiones=54`.
- [ ] **Paso 2:** Rojo. **Paso 3:** Implementar. **Paso 4:** Verde. **Paso 5:** commit `feat: cliente BDNS`.

### Task 5: Sync de dos niveles

**Files:** Create `lib/sync.ts`, `tests/sync.test.ts`

**Interfaces:**
- Consumes: `Repo`, `buscarPagina`, `detalle`.
- Produces: `syncLista(repo, regionId, opts?): Promise<{ nuevas: number; paginas: number }>` — desde `ultimoSync(regionId)` o backfill 365 días; pagina hasta agotar; upsertLista; registrarSync.
- `syncDetalles(repo, opts?: { limite?: number; concurrencia?: number; onProgreso?: (hecho,total)=>void }): Promise<number>` — toma `pendientesDetalle` (más recientes primero), fetch detalle con concurrencia 4 y reintento único con backoff 2s, upsertDetalle. Devuelve nº completados. Errores por ítem no rompen la cola.
- `refrescarAbiertas(repo): Promise<number>` — re-fetch detalle de convocatorias con `fecha_fin_sol >= hoy - 3 días` o sin fechas, y `detalleAt` > 7 días.

- [ ] **Paso 1:** Tests con repo `:memory:` y fetch mock: backfill inserta N filas; segundo sync con fechaDesde solo trae delta; cola de detalles respeta límite y marca `detalleAt`; un detalle que falla 2 veces no rompe el resto (queda pendiente).
- [ ] **Paso 2:** Rojo. **Paso 3:** Implementar. **Paso 4:** Verde. **Paso 5:** commit `feat: sync BDNS dos niveles`.

### Task 6: Encaje estructural

**Files:** Create `lib/encaje.ts`, `tests/encaje.test.ts`

**Interfaces:**
- Consumes: `Convocatoria`, `estadoPlazo`, hechos (`Map<string,string>`).
- Produces: `evaluarEstructural(conv, hechos, hoy?): { resultado: 'pasa'|'no'|'duda'; motivos: { regla: string; detalle: string }[] }`
  - Reglas: (1) plazo no `cerrada`; (2) beneficiario: si perfil `tipo_actividad=autonomo|pyme` exige que `beneficiarios` incluya texto con "PYME" o "PERSONAS FÍSICAS QUE DESARROLLAN"; si `particular`, los "QUE NO DESARROLLAN"; beneficiarios vacío → duda; (3) territorio: si la conv es LOCAL y hay `cp` en hechos, `esOrganoDeMiZona` debe pasar; (4) sector: si `sectores` no vacío y perfil tiene `cnae_letras`, intersección; sin dato → duda, nunca `no`.
  - Hechos clave v1: `tipo_actividad` (autonomo|pyme|particular), `cp`, `cnae_letras` (p.ej. "R,S"), `municipio`.

- [ ] **Paso 1:** Tests: conv cerrada→no("plazo"); autónomo vs beneficiarios PYME→pasa; particular vs PYME→no("beneficiario"); LOCAL de Paiporta con cp 46183 (L'Eliana)→no("territorio"); LOCAL de L'Eliana con cp 46183→pasa; sin sectores→no penaliza; sector no coincidente→duda.
- [ ] **Paso 2:** Rojo. **Paso 3:** Implementar. **Paso 4:** Verde. **Paso 5:** commit `feat: encaje estructural`.

### Task 7: Gemini + extracción de requisitos + entrevista

**Files:** Create `lib/gemini.ts`, `lib/requisitos.ts`, `tests/requisitos.test.ts`

**Interfaces:**
- `lib/gemini.ts` produce: `hayClave(repo): boolean` (env `GEMINI_API_KEY` o ajuste `gemini_key`); `generar(repo, partes: Parte[], opts?): Promise<string>` — POST `v1beta/models/<modelo>:generateContent` (modelo = ajuste `gemini_modelo` o `gemini-2.5-flash`), `Parte = {texto} | {pdf: Buffer}` (inlineData base64, mimeType application/pdf), `responseMimeType: 'application/json'` cuando se pide JSON. Errores → excepción con mensaje legible.
- `lib/requisitos.ts` produce:
  - `Requisito = { id: string; literal: string; tipo: 'dato'|'documento'|'condicion'; clave?: string; pregunta?: string; respuestas?: string[] }`
  - `parsearRequisitos(jsonTexto: string): Requisito[]` — valida forma, ids únicos, descarta malformados (nunca lanza por un ítem malo).
  - `PROMPT_EXTRACCION` (constante): instruye a Gemini a devolver SOLO JSON `{requisitos:[…]}` con literal = cita textual de las bases, clave en snake_case reutilizable (`tipo_actividad`, `num_empleados`, `al_corriente_hacienda`…), pregunta en español claro con `respuestas` si es sí/no.
  - `siguientePregunta(requisitos, hechos): Requisito | null` — primer requisito tipo dato/condicion cuya `clave` no esté en hechos.
  - `PROMPT_VEREDICTO` + `parsearVeredictos(jsonTexto): { id: string; veredicto: 'cumple'|'no_cumple'|'duda'; motivo: string }[]`.

- [ ] **Paso 1:** Tests (sin red): `parsearRequisitos` con JSON válido, con basura alrededor (```json fences```), con ítem sin literal (se descarta); `siguientePregunta` salta claves ya conocidas y devuelve null al agotar; `parsearVeredictos` idem.
- [ ] **Paso 2:** Rojo. **Paso 3:** Implementar. **Paso 4:** Verde. **Paso 5:** commit `feat: extracción de requisitos y entrevista`.

### Task 8: Dictamen

**Files:** Create `lib/dictamen.ts`, `tests/dictamen.test.ts`

**Interfaces:**
- Consumes: resultado estructural (T6), veredictos (T7).
- Produces: `dictaminar(estructural, veredictos): { dictamen: 'encaja'|'no_encaja'|'duda'|'pendiente'; motivos: { origen:'estructural'|'bases'; detalle: string; literal?: string }[] }`
  - estructural `no` → `no_encaja`. Algún veredicto `no_cumple` → `no_encaja`. Todos `cumple` y estructural `pasa` → `encaja`. Cualquier `duda` restante → `duda`. Sin veredictos aún (entrevista a medias) → `pendiente`.

- [ ] **Paso 1:** Tests de las 5 combinaciones de arriba.
- [ ] **Paso 2-4:** Rojo → implementar → verde. **Paso 5:** commit `feat: dictamen`.

### Task 9: Expediente

**Files:** Create `lib/expediente.ts`, `tests/expediente.test.ts`

**Interfaces:**
- Consumes: `Requisito[]`, `Convocatoria`, `generar` (Gemini), repo.
- Produces:
  - `montarChecklist(requisitos): ItemChecklist[]` — de los tipo `documento`: `{ id, texto, estado: 'lo_tengo'|'pedirlo'|'redactarlo'|'pendiente', nota? }` (estado inicial `pendiente`).
  - `crearCarpetaExpediente(baseDir, conv): string` — `expedientes/<codigo>-<slug(titulo,40)>/`, crea dirs, escribe `FUENTE.md` (enlaces oficiales BDNS/bases/sede).
  - `escribirInstrucciones(dir, conv, requisitos): string` — `INSTRUCCIONES.md` con plazo, sede (o "buscar en las bases"), checklist en Markdown y el aviso "firma y presentación las haces tú".
  - `generarBorradorDocx(dir, titulo, secciones: {h:string; p:string[]}[]): Promise<string>` — DOCX con la librería `docx`, portada con marca **BORRADOR — revisar antes de presentar**, devuelve ruta.

- [ ] **Paso 1:** Tests en dir temporal: checklist solo con tipo documento; carpeta creada con FUENTE.md e INSTRUCCIONES.md conteniendo el enlace BDNS y el aviso; DOCX existe y pesa >1kB.
- [ ] **Paso 2-4:** Rojo → implementar → verde. **Paso 5:** commit `feat: expedientes con borradores DOCX`.

### Task 10: API routes

**Files:** Create `app/api/sync/route.ts`, `app/api/convocatorias/route.ts`, `app/api/convocatorias/[codigo]/route.ts`, `app/api/encaje/[codigo]/route.ts`, `app/api/expedientes/route.ts`, `app/api/expedientes/[codigo]/route.ts`, `app/api/ajustes/route.ts`, `lib/servidor.ts`

**Interfaces (Produces, JSON):**
- `lib/servidor.ts`: singleton `getRepo()` (una conexión por proceso) + `errorJson(e)`.
- `POST /api/sync` body `{regionId}` → `{nuevas, detalles}` (syncLista + syncDetalles(200) + refrescarAbiertas). `GET /api/sync` → `{ultimo, pendientesDetalle}`.
- `GET /api/convocatorias?texto&nivel1&instrumento&beneficiario&estado&region&cp` → `{filas: (Convocatoria & {plazo})[]}` — aplica `estadoPlazo` y, con cp, incluye locales de la zona; orden: urgentes primero, luego fin ascendente.
- `GET /api/convocatorias/<codigo>` → detalle (fetch-through a BDNS si falta) + evaluación existente.
- `POST /api/encaje/<codigo>` body `{accion:'iniciar'} | {accion:'responder', clave, valor} | {accion:'dictaminar'}` → `{fase, pregunta?, requisitos?, dictamen?, motivos?}`. `iniciar`: estructural; si pasa y hay clave Gemini, descarga bases y extrae requisitos (cachea); devuelve primera pregunta. `responder`: guarda hecho, devuelve siguiente. `dictaminar`: veredictos Gemini + dictaminar.
- `POST /api/expedientes` body `{codigo}` → crea expediente (carpeta+checklist desde evaluación). `GET /api/expedientes` → lista. `PATCH /api/expedientes/<codigo>` body `{estado?|item?:{id,estado,nota}}`. `POST /api/expedientes/<codigo>` body `{accion:'borrador', tipo:'memoria'|'declaracion'}` → genera DOCX con Gemini y datos de ficha.
- `GET/POST /api/ajustes` — get devuelve `{tieneClaveGemini: boolean, territorio, cp, modelo}` (NUNCA la clave); post guarda.

- [ ] **Paso 1:** Implementar routes (capa fina, sin lógica nueva). **Paso 2:** `npm run build` compila sin errores. **Paso 3:** commit `feat: API routes`.

### Task 11: UI — tema radar + shell

**Files:** Modify `app/layout.tsx`, `app/globals.css`; Create `app/componentes/Shell.tsx`

- Fuentes next/font: Space Grotesk (display) + IBM Plex Mono (números). Paleta CSS vars: fondo `#050A14`, tinta `#E8F6FF`, acento lima `#B8FF29`, cian `#3EE8FF`, alerta `#FF4D5E`, ámbar `#FFB020`. Tarjetas `#0B1424` borde `#16233B`.
- Shell: cabecera con logo "📡 RADAR DE AYUDAS", barrido de radar animado sutil (CSS conic-gradient girando en un disco de 28px), nav 3 pestañas: RADAR / MI FICHA / EXPEDIENTES. Responsive.
- [ ] Implementar + `npm run build` verde + commit `feat: tema radar y shell`.

### Task 12: UI — página RADAR

**Files:** Create `app/page.tsx` (client), `app/componentes/TarjetaAyuda.tsx`, `app/componentes/Filtros.tsx`, `app/componentes/DetalleAyuda.tsx`, `app/componentes/BannerSync.tsx`

- Selector territorio (CCAAS + "Toda España") defecto C. Valenciana; caja CP con resolución mostrada ("46183 → L'Eliana, Valencia"); filtros instrumento/beneficiario/estado; buscador con debounce.
- BannerSync: "última actualización hace X" (rojo >7 días), botón ACTUALIZAR con progreso (poll GET /api/sync), auto-sync al cargar si >6h.
- Tarjetas: semáforo de plazo con cuenta atrás en mono grande (`⏳ CIERRA EN 5 DÍAS`), órgano con chip LOCAL/AUTONÓMICA/ESTATAL, importe si consta, chip de instrumento.
- DetalleAyuda (drawer lateral): todos los campos, enlaces oficiales (BDNS, bases, sede), botones **¿ENCAJO?** y **AL EXPEDIENTE**.
- Estado en URL query (?ccaa=&cp=&q=…) para volver atrás sin perder filtros.
- [ ] Implementar + build verde + commit `feat: página radar`.

### Task 13: UI — entrevista de encaje

**Files:** Create `app/componentes/Entrevista.tsx` (se abre dentro de DetalleAyuda)

- Al pulsar ¿ENCAJO?: POST iniciar → si estructural descarta, muestra ❌ con motivos y literales. Si pasa: muestra requisitos extraídos (con sus literales plegables) y la entrevista pregunta a pregunta (input según `respuestas`: botones sí/no o texto/número). Barra de progreso "pregunta 3 de 7". Al agotar → botón DICTAMINAR → banner grande ✅/❌/🤔 con motivos citando literal. Sin clave Gemini → aviso con enlace a Ajustes (modal de ajustes accesible desde la cabecera: clave, modelo, CP por defecto).
- [ ] Implementar + build verde + commit `feat: entrevista de encaje`.

### Task 14: UI — Mi Ficha

**Files:** Create `app/ficha/page.tsx`

- Tabla editable de hechos (clave legible, valor, de dónde salió, cuándo). Añadir/editar/borrar (borrar = la próxima entrevista volverá a preguntar). Chips de claves más comunes prellenables (tipo_actividad, cp, municipio, num_empleados, al_corriente_hacienda, al_corriente_ss).
- [ ] Implementar + build verde + commit `feat: mi ficha`.

### Task 15: UI — Expedientes

**Files:** Create `app/expedientes/page.tsx`, `app/expedientes/[codigo]/page.tsx`

- Lista tipo tablero por estado (Interesa / En preparación / Presentada / Concedida / Denegada) con mover de estado. Detalle: plazo gigante arriba, checklist interactiva (lo tengo / pedirlo / redactarlo + nota), botones "Redactar memoria" y "Redactar declaración" (→ DOCX, muestra ruta y botón abrir carpeta vía `open`… no: mostrar ruta y enlace `file://` no funciona — mostrar ruta copiable), sección INSTRUCCIONES renderizada.
- Endpoint auxiliar `POST /api/expedientes/<codigo>` acción `abrir_carpeta` que ejecuta `open <dir>` en el servidor (estamos en local; es el Mac del usuario).
- [ ] Implementar + build verde + commit `feat: expedientes UI`.

### Task 16: CLI sync + docs + puerto

**Files:** Create `scripts/sync.mjs`; Modify `package.json` (scripts `dev -p 3002`, `start -p 3002`, `sync`), `README.md`

- `scripts/sync.mjs`: node script que abre repo, syncLista(región de ajustes o 54) + syncDetalles + refrescarAbiertas, imprime resumen. Para cron futuro.
- README estilo caja7dias: qué es, arrancar (`npm run dev` → 3002), las 3 plantas, dónde vive la clave, dónde caen los expedientes, aviso legal BDNS, y que NO presenta solicitudes.
- [ ] Implementar + build + commit `feat: CLI sync y documentación`.

### Task 17: TEST EN VIVO (pedido explícito de Victor)

- [ ] Arrancar `npm run dev` (3002), abrir con el navegador integrado.
- [ ] Sync real contra BDNS (C. Valenciana): verificar contador de convocatorias y detalles.
- [ ] Verificar radar: filtros, CP 46183 (aparecen locales de la zona), semáforos coherentes con fechas reales.
- [ ] Entrevista con una ayuda real abierta de la C. Valenciana (estructural; con IA solo si hay clave — si no, verificar el aviso).
- [ ] Crear expediente real: carpeta en disco, FUENTE.md, INSTRUCCIONES.md, checklist. DOCX si hay clave.
- [ ] Capturas de cada planta para Victor. Corregir lo que falle y re-verificar.
- [ ] Commit final `fix:` si hubo arreglos + resumen.

## Self-Review

- **Cobertura del spec:** fuente/API (T4-5), CP (T3), semáforo (T2), ficha persistente (T1,14), entrevista+dictamen con literales (T6-8,13), expediente+DOCX+instrucciones (T9,15), estilo radar (T11-12), sin cron pero CLI (T16), test en vivo (T17), clave Gemini fuera de git (T7,10), multi-perfil como dato (esquema T1). ✔
- **Placeholders:** ninguno — cada task lleva interfaces exactas y casos de test concretos. ✔
- **Consistencia de tipos:** `Convocatoria` (T1) la consumen T4-6,9-12; `Requisito` (T7) la consumen T8-9,13; nombres revisados. ✔
