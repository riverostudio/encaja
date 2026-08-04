# Echar una mano

Gracias por pasarte. Va sin ceremonia.

## Lo más útil que puedes hacer

No es código. Es **avisar de datos mal**.

La app lee de una fuente oficial y traduce con IA, y las dos cosas se equivocan. Si ves
un plazo que no cuadra, una traducción que dice algo que no es, o un enlace que no abre,
abre una incidencia con:

- el **código de la convocatoria** (sale en la ficha)
- qué pone la app
- qué pone la convocatoria oficial

Con eso lo arreglo en un rato. Sin eso, no hay por dónde empezar.

Lo mismo con las **prestaciones**: el listado a mano tiene ocho (paro, subsidio, IMV,
complemento de infancia, bono social, cese de actividad, no contributivas y becas del
Ministerio). Si falta alguna que no esté en la base nacional, dímelo con su enlace
oficial.

Y con las **comunidades**: esto está probado a fondo en la Valenciana, que es donde vivo.
Si en la tuya sale algo raro, cuéntamelo.

## Si vas a tocar código

```bash
npm install
npm test          # las 169, deberían pasar todas
npm run dev
```

Cuatro cosas y ya:

**Prueba antes de código.** No por dogma: es que aquí los fallos son de los que no se ven.
La app puede decirle a alguien que encaja en una ayuda que no puede pedir, y eso no
revienta ni sale en los registros. Los dos peores fallos de todo el proyecto los pilló una
prueba, no yo mirando la pantalla.

**Todo en español.** Nombres de funciones, variables, comentarios, mensajes. La app va de
que la gente entienda las cosas; quedaría feo que el código no se entendiera.

**Los comentarios explican el porqué, no el qué.** Si hace falta un comentario para saber
*qué* hace una línea, el problema es la línea. Los que sí valen la pena son del tipo
«ojo: esto viene con el protocolo mutilado desde la fuente».

**Nunca inventar un dato.** Si un campo viene vacío de la fuente, se dice que está vacío.
No se rellena, no se estima, no se deduce. Es la regla de la que no me muevo.

## Cómo está repartido

```
lib/     la lógica de verdad. Aquí van las pruebas.
app/     pantallas y rutas de API. Poca lógica, casi todo delegado a lib/.
tests/   una por módulo de lib/
web/     la página de presentación, estática, se despliega aparte
```

## Los commits

En español, en presente, contando **por qué** además de qué:

```
fix: las URLs sin protocolo no abrían

904 convocatorias traían la web sin el https:// delante, así que el enlace
llevaba a una ruta relativa y daba 404. urlAbsoluta() lo repara al leer.
```

## Dudas

Abre una incidencia y ya. Aunque sea para preguntar.
