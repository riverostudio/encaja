# Auditoría actual de Encaja

**8 de agosto de 2026** · después de integrar métricas persistentes y administración

## Veredicto

Encaja está operativa para buscar ayudas de toda España, explicar por qué una opción
puede corresponder, mostrar los requisitos conocidos y llevar a la sede, bases o ficha
oficial disponible. El asistente conversacional no consulta la memoria libre de un
modelo para decidir qué ayudas existen: recupera primero resultados del catálogo de
Encaja y la IA configurada por el visitante solo los explica.

## Cobertura comprobada

| Comprobación | Resultado |
|---|---:|
| Convocatorias públicas | 19.770 |
| Convocatorias con detalle descargado | 19.770 |
| Territorios sincronizados | 19 de 19 |
| Con sede o bases específicas | 19.500 |
| Solo con ficha oficial BDNS | 270 |
| Vías prioritarias fuera de la BDNS | 12 |
| Pruebas unitarias | 213 |
| Pruebas de navegador | 30, escritorio y móvil |

Las 270 convocatorias sin sede ni bases separadas siguen teniendo la ficha oficial de
la BDNS. En esos casos la interfaz no etiqueta el enlace como solicitud directa: explica
que se debe consultar allí la forma de presentación.

## Escenarios del orientador

La clasificación y recuperación se prueban para:

- persona con pocos recursos;
- estudiante;
- autónomo;
- profesional, preguntando antes si trabaja por cuenta propia o ajena;
- trabajador por cuenta ajena;
- además de desempleo, vivienda urgente y necesidades familiares.

Cada resultado del chat contiene organismo, resumen, plazo, requisitos principales y
un botón oficial. Las convocatorias de la BDNS también permiten abrir «¿Encajo?» para
leer las condiciones detalladas de sus bases.

## Límites que se mantienen a propósito

- Encaja no presenta ni firma solicitudes en nombre de nadie.
- Una coincidencia es una posible ayuda, no una concesión garantizada.
- Los requisitos resumidos son orientativos; las bases o el organismo oficial mandan.
- Cuando la fuente no publica un enlace directo, Encaja no inventa uno.
- La cobertura es dinámica: una administración puede corregir o publicar una
  convocatoria después de la última sincronización.

## Privacidad y API de IA

El chat funciona de forma guiada sin clave. Si el visitante configura Gemini, Claude u
OpenAI, el orientador reutiliza ese mismo proveedor. En la web pública la clave y el
perfil permanecen en el navegador y se envían solo durante la petición necesaria; no se
guardan en la base pública.

La aplicación muestra una sola vez por navegador un aviso inicial que se puede cerrar y
mantiene una identificación breve de IA en el orientador. Las explicaciones extensas se
centralizan en una única página legal, que detalla que la IA también ayudó a crear,
documentar e investigar el proyecto, que Encaja no adopta decisiones con efectos
jurídicos y que la fuente oficial siempre debe verificarse.

## Métricas y administración

El panel de actividad del visitante se calcula y guarda en su navegador: tiempo activo,
tiempo en el radar, textos de búsquedas e historial de ayudas. La vigencia se recalcula
con las fechas oficiales cada vez que abre Expedientes.

La telemetría de administración es optativa y separada. Tras consentimiento explícito,
solo envía tipos de evento permitidos, categorías generales, duración, rutas y códigos
BDNS públicos. Los identificadores aleatorios se transforman con HMAC; no se registran
IP en la base, claves de IA, perfil, código postal, mensajes, documentos ni texto libre.
El panel deduplica pestañas para mostrar navegadores activos. `/admin` usa una contraseña
solo de servidor, cookie `HttpOnly`, `Secure`, `SameSite=Strict`, caducidad de ocho horas,
límite de intentos persistente en Neon y respuestas sin caché. Los eventos tienen
retención máxima de 365 días. «Borrar mis datos» elimina también los eventos asociados al
identificador seudonimizado y renueva ese identificador.
