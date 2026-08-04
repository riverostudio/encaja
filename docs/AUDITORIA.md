# Auditoría del Radar de Ayudas

**4 de agosto de 2026** · tras el test final completo

---

## 1 · Qué hay construido

| | |
|---|---|
| Lógica pura (`lib/`) | 2.557 líneas · 16 módulos |
| Interfaz (`app/`) | 2.780 líneas · 14 componentes |
| API | 11 rutas |
| Tests | 104, en 11 ficheros (1.044 líneas) |
| Commits | 26 |

**Test final:** build limpio, 104/104 tests, lint sin avisos, **13 de 13 rutas
responden 200**. Cero fallos.

**Rendimiento medido:** pantallas 2-7 ms · filtrar 4.578 convocatorias 20-130 ms
· búsqueda de texto 19 ms. La app es instantánea; lo lento es la IA leyendo
PDFs oficiales (53 s la primera vez por convocatoria, luego caché).

---

## 2 · Los datos, sin maquillaje

| | |
|---|---|
| Convocatorias en el archivo | 4.578 |
| Con detalle descargado | 4.577 (99,98 %) |
| **Vigentes** (abiertas o por abrir) | **787** |
| Sin fechas publicadas por el organismo | 1.797 |
| Traducidas por la IA | 3 |
| Con las bases leídas | 5 |

Cobertura: 2.132 estatales · 1.456 autonómicas · 700 locales · 290 otros.

---

## 3 · Los seis agujeros reales

### 3.1 · Falta el 90 % de España
Solo está sincronizada **una comunidad** (la Valenciana) de diecinueve. Un
usuario de Sevilla abre la app y ve las ayudas de Valencia. **Es el fallo más
grave**: la app se anuncia como "de toda España" y no lo es.

### 3.2 · Lo más buscado no está en la fuente
El **paro del SEPE** y el **Ingreso Mínimo Vital** no son subvenciones: son
prestaciones, y no se publican en la BDNS. Quien entre buscando "el paro" no
lo va a encontrar, por mucho que sea justo lo que necesita.

### 3.3 · 249 fichas duplicadas
La BDNS registra cada línea de un mismo decreto por separado. Resultado:
**60 tarjetas idénticas** de "AYUDAS PARA INSERCIÓN LABORAL" y 26 del mismo
Real Decreto-ley. Ocupan la pantalla y esconden lo demás.

### 3.4 · El 39 % no dice cuándo se pide
1.797 convocatorias salen como "sin fechas" porque el organismo no las
registró. La app lo dice en vez de inventárselo — correcto — pero el usuario
se queda igual: tiene que abrir el PDF y buscarlo a mano.

### 3.5 · La IA solo trabaja cuando se la llama
Solo 3 convocatorias traducidas y 5 con bases leídas, porque se hace al abrir
cada ficha. Las otras 4.573 tarjetas enseñan el resumen calculado, que es
correcto pero seco. Y leer unas bases cuesta 53 segundos de espera.

### 3.6 · Nadie avisa de nada
Sin vigilante (fue una decisión consciente). Si no entras, no te enteras. Una
ayuda puede abrir y cerrar sin que lo sepas — que es exactamente como se
perdió EMPYME el 31 de julio.

---

## 4 · Cómo multiplicarlo por diez

Ordenado por cuánto cambia la vida del usuario dividido por lo que cuesta.

### Nivel 1 — Lo que lo vuelve real (semanas 1-2)

**1. España entera, de verdad.**
Sincronizar las 19 comunidades, no una. Son ~15.000 convocatorias al año más
las 51.000 locales; con sync incremental y detalle bajo demanda es viable.
*Sin esto, la app solo sirve en Valencia.*

**2. Agrupar las convocatorias hermanas.**
Una tarjeta por título+órgano con "60 líneas de esta misma ayuda" dentro. De
4.578 fichas a ~4.300 útiles, y la pantalla deja de repetirse.

**3. Rescatar las fechas del PDF.**
Cuando la BDNS no publica plazo, que la IA lo saque de las bases al abrir la
ficha y lo guarde. Recupera hasta 1.797 convocatorias que hoy son opacas.

**4. Traducir en lote, de noche.**
Un proceso que traduzca las vigentes mientras no miras (787 × ~5 s ≈ 1 hora,
una vez). Al entrar, todas las tarjetas hablan en cristiano desde el primer
segundo. Coste: unos céntimos con Gemini Flash.

### Nivel 2 — Lo que lo vuelve imprescindible (semanas 3-4)

**5. El vigilante que sí avisa.**
Cron diario que sincroniza, evalúa las nuevas contra tu perfil y te escribe
por WhatsApp o email **solo si algo te encaja**. El motor ya existe
(`npm run sync` + `evaluarEstructural`): falta el disparador y el canal.
*Esto convierte una herramienta que hay que recordar en una que te busca.*

**6. Prestaciones, no solo subvenciones.**
Añadir SEPE (paro, subsidios), Seguridad Social (IMV, prestación por hijo) y
las rentas mínimas autonómicas. No son convocatorias con plazo sino derechos
permanentes con requisitos: encajan en el mismo cuestionario. *Es lo que más
falta le hace a quien está sin trabajo.*

**7. Puntuación, no solo sí/no.**
Casi todas las convocatorias reparten por baremo. Que la IA extraiga los
criterios y estime cuántos puntos sacarías: pasar de "puedes pedirla" a
"puedes pedirla y saldrías en el puesto 12 de 40".

**8. Calendario y recordatorios.**
Un evento por expediente con avisos a 15, 7 y 2 días. El plazo es lo único
que no se puede recuperar.

### Nivel 3 — Lo que lo convierte en producto (mes 2+)

**9. Multiusuario de verdad.**
El esquema ya soporta varios perfiles. Añadir cuentas y despliegue a la nube
lo convierte en algo que puede usar cualquiera — que era la idea al meter los
tres proveedores de IA.

**10. Memoria de lo que funciona.**
Registrar qué expedientes se conceden y se deniegan. Con cien casos, la app
puede decir "de las de este organismo se concede el 30 %" — algo que hoy no
tiene nadie en España.

**11. Papeleo casi hecho.**
Guardar tus documentos recurrentes (certificados, alta de autónomo) y
reutilizarlos entre solicitudes. Hoy cada expediente empieza de cero.

---

## 5 · Lo que NO hay que hacer

- **Presentar solicitudes en nombre del usuario.** Manejar su certificado
  digital y firmar ante la Administración es irreversible. La app prepara; la
  persona firma. Ese límite es una decisión de diseño, no una carencia.
- **Adivinar cuando falta un dato.** Preferimos "las bases dicen quién puede
  pedirla" antes que inventar un beneficiario. Es lo que separa esta app de un
  chatbot que suena bien y miente.
- **Dar consejo fiscal o jurídico personalizado.** Se enseñan requisitos
  literales y se enlaza la fuente.

---

## 6 · Veredicto

Lo construido **funciona y es honesto**: 104 tests, cero rutas rotas, cada dato
enlaza su fuente oficial y cuando algo no se sabe se dice. El circuito completo
—encontrar, entender, comprobar si encajas, preparar el expediente y llegar a
la sede— está cerrado y verificado con tres solicitudes reales.

Lo que le falta para ser diez veces mejor no es más funcionalidad: es
**cobertura** (las 19 comunidades y las prestaciones) y **que trabaje sin que
se lo pidan** (traducción en lote y vigilante que avisa). Con los puntos 1, 4 y
5 hechos, esto deja de ser una herramienta que hay que recordar usar y pasa a
ser algo que te avisa de dinero que te corresponde.
