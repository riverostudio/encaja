# Encaja

**Todas las ayudas públicas de España, explicadas en cristiano — y si encajas en ellas.**

👉 **[Pruébala aquí](https://usar-encaja.vercel.app)** · [De qué va](https://encaja-ayudas.vercel.app)

---

## Por qué existe esto

Un día me puse a mirar si me correspondía alguna ayuda. Tres horas después seguía
leyendo un PDF de la Conselleria y no tenía ni idea de si podía pedirla o no.

Y no era culpa mía. Esto es un título real, tal cual lo publicó el organismo:

> «RESOLUCIÓN de 27 de julio de 2026, de la Conselleria de Educación, Cultura y
> Universidades, por la que se aprueban las bases reguladoras y se convocan ayudas
> económicas, en concepto de subvención, para contribuir a la financiación de los
> gastos de ejecución de acciones y programas…»

Traducido: **dinero para estudiar. Abierto hasta el 31 de agosto.**

Eso es lo que hace Encaja. Coge las miles de convocatorias repartidas por decenas de
boletines, las pone en un sitio, las traduce, y te dice si puedes pedirlas.

Ahora mismo tiene **4.114 convocatorias** y **609 abiertas**.

![El radar, con convocatorias reales](docs/capturas/radar.png)

---

## Qué hace, en cuatro pasos

**1. Te pregunta quién eres.** Ocho preguntas normales: si pides como persona o como
negocio, qué te vendría bien ahora, en qué situación estás, cuánto entra en casa, tu
código postal. Nada de formularios con jerga.

**2. Busca por ti.** Se conecta a la Base de Datos Nacional de Subvenciones, que es
donde por ley acaba toda ayuda pública de España. Con el código postal salen también
las de tu ayuntamiento y tu diputación, que no aparecen en ningún buscador.

**3. Te dice si encajas.** Descarta lo imposible con los datos oficiales, y para el
resto se lee el PDF de las bases, te hace las preguntas justas y dictamina: encajas,
no encajas, o depende. Siempre citando el trozo de las bases en el que se apoya.

**4. Te deja el expediente listo.** Lo que tienes que cumplir, lo que hay que aportar,
borradores redactados y el enlace a la sede donde se presenta.

---

## Dos cosas que no hace, y no es por pereza

**No firma ni presenta nada en tu nombre.** Podría. Técnicamente no es difícil. Pero
manejar el certificado digital de alguien y firmar ante la Administración no tiene
vuelta atrás, y esa responsabilidad no me la quedo yo. La app prepara el expediente;
la persona firma.

**No se inventa un dato que no tiene.** Si el organismo no ha publicado el plazo, dice
«plazo sin publicar» y te enlaza las bases. Prefiero quedarme corto a que suene bien y
que alguien pierda una convocatoria por fiarse de mí.

---

## Cosas que aprendí por el camino

**El paro y el Ingreso Mínimo Vital no salen en la base nacional.** Me costó entenderlo:
no son subvenciones, son *prestaciones*, y van por otro sitio. O sea que quien más lo
necesita nunca las encontraría en un buscador de subvenciones. Así que las traigo aparte,
en un listado a mano, con su enlace oficial. Comprobé los enlaces uno a uno — tres de los
que había escrito de memoria daban 404.

**Una de cada diez convocatorias no es para nadie que viva aquí.** Aparecían
contribuciones a la OMS, a UNRWA, escuelas taller en Bolivia, proyectos en Paraguay. Son
españolas —las convoca la AECID— pero transcurren fuera. 465 en total. Fuera del radar.

**Casi mil enlaces estaban rotos.** 904 URLs venían de la fuente oficial sin el `https://`
delante, así que no abrían. Otras traían el protocolo mutilado (`tps://`) o directamente
una ruta de Windows. Hay una función entera dedicada a arreglar esa miseria.

**El filtro de beneficiarios casi la lía.** «Personas jurídicas que no desarrollan
actividad económica» suena a particular, ¿verdad? Pues no: son asociaciones. Una prueba
pilló que la app le habría dicho a un particular que encajaba en ayudas que no podía ni
pedir.

**«Concesión directa» no es un error.** 262 convocatorias no tienen fecha porque se
conceden directamente, sin plazo de solicitud. Me pasé un rato buscando cómo
«arreglarlas» hasta que entendí que no había nada roto.

---

## Cómo se usa

### La versión de internet

[usar-encaja.vercel.app](https://usar-encaja.vercel.app). Entras y ya. Sin cuenta, sin
registro, sin instalar nada. Las 609 ayudas abiertas están ya traducidas, así que se lee
todo sin poner ninguna clave.

Solo hace falta una clave de IA propia para la parte del «¿encajo?», que es la que se lee
las bases y te entrevista. Esa clave se guarda **en tu navegador**, no en mi servidor.

### En tu ordenador

Necesitas Node 20 o más nuevo.

```bash
git clone https://github.com/riverostudio/encaja.git
cd encaja
npm install
npm run sync        # descarga las convocatorias (tarda unos minutos)
npm run dev
```

Se abre en http://localhost:3002. La primera vez te pide una clave de IA — Gemini,
Claude o GPT, la que quieras. Se comprueba contra el proveedor antes de guardarla, así
que si te equivocas al pegarla te enteras en el momento y no tres pantallas después.

Aquí sí se guarda todo en tu equipo: perfil, expedientes y traducciones, en un SQLite
dentro de `data/`. Nada sale de tu máquina salvo las llamadas a la IA que tú elijas.

### Los comandos

```bash
npm run dev      # desarrollo, puerto 3002
npm run build    # compilar
npm run start    # producción
npm test         # las 169 pruebas
npm run lint     # eslint
npm run sync     # traer convocatorias nuevas de la BDNS
```

---

## Cómo está hecho por dentro

Next.js 16 con App Router, TypeScript y Tailwind 4. SQLite con better-sqlite3, que va en
el mismo proceso y no necesita servidor aparte. Vitest para las pruebas.

```
lib/     la lógica: BDNS, encaje, requisitos, dictamen, expedientes, IA
app/     las pantallas y las rutas de API
tests/   169 pruebas
web/     la página de presentación (estática, se despliega aparte)
```

Tres decisiones que igual no son obvias:

**La BDNS necesita dos vueltas.** El listado no trae las fechas de plazo — hay que pedir
el detalle de cada convocatoria una por una. Así que la sincronización va en dos niveles:
primero la lista, luego una cola de detalles.

**Se traduce solo lo que miras.** Traducir 4.114 convocatorias de golpe sería tirar el
dinero. Se traducen las que tienes en pantalla, y lo traducido queda guardado para
siempre. Cuanto más se usa, menos trabajo queda. (Para la versión pública sí traduje las
609 abiertas de una vez, para que se pueda leer sin clave.)

**La IA es la que tú elijas.** Gemini, Claude o GPT, cuatro modelos de cada: dos potentes
y dos baratos. La clave se valida con una llamada real antes de guardarse.

Y una más, para la versión de internet: **el servidor no guarda nada tuyo**. Tu perfil y
tu clave viven en tu navegador y viajan en tus peticiones. La base que se publica va
limpia de datos personales.

---

## Los datos

Vienen del Sistema Nacional de Publicidad de Subvenciones y Ayudas Públicas
([infosubvenciones.es](https://www.infosubvenciones.es)), que gestiona la Intervención
General de la Administración del Estado. Se reutilizan al amparo de la Ley 37/2007, de
reutilización de la información del sector público.

Son datos vivos: un plazo puede cambiar o corregirse después de que Encaja los lea. **La
convocatoria oficial es la única que vale.** Encaja no es asesoramiento jurídico y
ninguna administración lo avala ni lo patrocina.

---

## Si quieres echar una mano

Se agradece. Sobre todo:

- **Datos mal.** Si ves un plazo raro, una traducción que dice algo que no es o un enlace
  roto, abre una incidencia con el código de la convocatoria. Eso es lo más útil de todo.
- **Prestaciones que faltan.** El listado a mano tiene ocho. Seguro que faltan.
- **Otras comunidades.** Está probado a fondo en la Valenciana, que es donde vivo. Si algo
  se comporta raro en la tuya, cuéntamelo.

Si vas a tocar código, mira [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licencia

[MIT](LICENSE). Cógelo, cámbialo, úsalo, móntate lo tuyo. Solo deja el aviso de copyright.

Los textos de las convocatorias no son míos: son de los organismos que las publican.

---

Hecho en 2026 en L'Eliana, Valencia, en el laboratorio de aplicaciones de
[Rivero Studio](https://riverostudio.web.app/apps/), porque la información que ya es
pública debería poder entenderse.
