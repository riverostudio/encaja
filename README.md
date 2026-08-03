# 📡 Radar de Ayudas

Todas las **subvenciones y ayudas económicas de España** en un panel local:
eliges territorio (por defecto **Comunitat Valenciana**, afinable con tu
**código postal**), y cuando una te interesa la app **te entrevista** y
dictamina si encajas citando el texto literal de las bases. Si encajas, te
monta el **expediente**: checklist de documentos, borradores en Word e
instrucciones de presentación.

> **Fuente única y oficial:** la BDNS (Base de Datos Nacional de Subvenciones),
> donde por ley se publica toda ayuda pública — Estado, autonomías,
> diputaciones y ayuntamientos. La app nunca afirma nada que no pueda
> enseñarte en el documento oficial.

## Arrancarla

```bash
cd ~/radar-ayudas && npm run dev
```

Abre **http://localhost:3002** (el 3000 es de World Monitor y el 3001 del CRM).

Si acabas de clonarla o borraste `node_modules`:

```bash
cd ~/radar-ayudas && npm ci
```

## Las 3 plantas

| Ruta | Qué hace |
|---|---|
| `/` | **RADAR**: selector de comunidad + código postal (46183 → l'Eliana activa tu ayuntamiento y diputación), filtros por tipo y estado, buscador, y los plazos en semáforo: 🔴 cierra en ≤7 días · 🟠 ≤21 · ⏳ abre pronto. Se sincroniza con la BDNS al entrar (si hace >6 h) o con el botón ⟳ |
| `/ficha` | **MI FICHA**: todo lo que la app sabe de ti. Cada entrevista la rellena; a la quinta ayuda casi no pregunta. Borrar un dato = volverá a preguntarse |
| `/expedientes` | **EXPEDIENTES**: tablero Interesa → En preparación → Presentada → Concedida/Denegada. Cada expediente es una carpeta REAL en `expedientes/` con FUENTE.md, INSTRUCCIONES.md y los borradores DOCX |

## La entrevista «¿Encajo?»

1. **Filtro estructural** (gratis, sin IA): beneficiario, territorio y plazo
   contra los datos oficiales de la BDNS. Si no cuadra, descarte inmediato con
   el motivo.
2. **Lectura de bases** (IA): descarga el PDF oficial, extrae los requisitos
   con su **cita literal**, y solo pregunta lo que tu ficha aún no sepa.
3. **Dictamen**: ✅ ENCAJAS / ❌ NO (con el artículo exacto) / 🤔 DUDA (qué
   consultar). Nunca inventa: sin dato suficiente, dictamina DUDA.

## La clave de Gemini (IA)

Sin clave, el radar y el filtro estructural funcionan igual; la lectura de
bases, la entrevista completa y los borradores necesitan una clave de
[Google AI Studio](https://aistudio.google.com/apikey):

- Pégala en **⚙︎ Ajustes** (se guarda en la base de datos local, fuera de git), o
- ponla en `.env.local` como `GEMINI_API_KEY=...`

**Nunca** va en el código, en git ni en el navegador.

## Sync manual / cron futuro

La app se actualiza al abrirla o con el botón. A propósito **no hay cron**.
Si algún día lo quieres:

```bash
npm run sync          # C. Valenciana
npm run sync -- 49    # otra región BDNS (49 = Cataluña)
```

## Dónde está cada cosa

- `lib/` — toda la lógica, pura y con tests (`npm test`, 60 tests)
- `app/api/` — capa fina HTTP · `app/` — interfaz
- `data/radar.db` — SQLite local (gitignored)
- `expedientes/` — tus expedientes (gitignored)
- `datasets/` — CP→municipio (14.270 códigos postales, fuentes abiertas) e ids
  del árbol de regiones BDNS; regenerables con `node scripts/generar-datasets.mjs`
- `docs/superpowers/` — spec y plan de diseño

## Límites a propósito

- **No firma ni presenta** ante la Administración: la sede electrónica y tu
  certificado son siempre tuyos. Los DOCX van marcados **BORRADOR**.
- No da consejo fiscal personalizado: enseña requisitos literales y enlaza fuentes.
- Datos BDNS dinámicos (aviso legal del SNPSAP): verifica siempre la
  convocatoria oficial antes de presentar.
