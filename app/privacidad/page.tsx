import Link from "next/link";

export default function Privacidad() {
  return (
    <article className="mx-auto max-w-2xl">
      <p className="rotulo">Encaja</p>
      <h1 className="display mt-2 text-[34px] leading-tight">
        Aviso legal, privacidad e inteligencia artificial
      </h1>
      <p className="nota mt-3">Última actualización: 7 de agosto de 2026.</p>

      <div
        className="mt-7 rounded-lg border p-5 text-[14px] leading-relaxed"
        style={{ borderColor: "var(--ocre)", background: "var(--lienzo-alto)" }}
      >
        <p className="display text-[18px] text-[var(--tinta)]">Aviso importante</p>
        <p className="mt-2 text-[var(--grafito)]">
          Encaja se ha creado, documentado e investigado con ayuda de inteligencia artificial y
          también puede usarla para buscar, resumir, traducir, leer bases y conversar. La IA puede
          equivocarse, omitir información o trabajar con datos desactualizados. Comprueba siempre
          requisitos, plazos, importes y forma de solicitud en la fuente oficial antes de actuar.
        </p>
      </div>

      <div className="mt-9 space-y-8 text-[14px] leading-relaxed text-[var(--grafito)]">
        <section>
          <h2 className="display text-[21px] text-[var(--tinta)]">Quién está detrás</h2>
          <p className="mt-2">
            Encaja es un proyecto de Víctor Rivero — Rivero Studio. No es una administración
            pública, una gestoría ni un servicio oficial de los organismos que aparecen en el
            radar. Puedes comunicar una incidencia desde el{" "}
            <a
              className="enlace"
              href="https://github.com/riverostudio/encaja/issues"
              target="_blank"
              rel="noreferrer"
            >
              repositorio público
            </a>
            . No publiques allí datos personales o sensibles.
          </p>
        </section>

        <section>
          <h2 className="display text-[21px] text-[var(--tinta)]">
            Transparencia sobre inteligencia artificial
          </h2>
          <p className="mt-2">
            El orientador es un sistema automático y la interfaz indica si una respuesta ha usado
            la IA configurada por el usuario o el modo guiado sin IA. Los títulos en lenguaje
            claro, resúmenes, traducciones, preguntas, dictámenes y borradores también pueden haber
            sido generados o revisados con IA. Encaja no usa la IA para adoptar una decisión
            administrativa ni para producir efectos jurídicos sobre una persona.
          </p>
          <p className="mt-3">
            Esta información se facilita siguiendo el principio de transparencia del{" "}
            <a
              className="enlace"
              href="https://eur-lex.europa.eu/eli/reg/2024/1689/oj/spa"
              target="_blank"
              rel="noreferrer"
            >
              Reglamento europeo de inteligencia artificial
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="display text-[21px] text-[var(--tinta)]">
            Límites, errores y comprobación humana
          </h2>
          <p className="mt-2">
            Los resultados son orientación informativa: no son asesoramiento jurídico, fiscal,
            laboral o administrativo, no garantizan que una ayuda sea concedida y no sustituyen la
            resolución del organismo competente. Una conclusión como «Encajas» es provisional y
            depende de los datos introducidos y de la lectura disponible. Si existe cualquier
            diferencia, mandan la convocatoria, sus bases, la sede electrónica y la resolución
            oficial.
          </p>
        </section>

        <section>
          <h2 className="display text-[21px] text-[var(--tinta)]">Qué se guarda</h2>
          <p className="mt-2">
            En la versión pública, tu perfil, las respuestas de las entrevistas y tus expedientes
            se guardan únicamente en el almacenamiento de este navegador. Encaja no crea una cuenta
            ni conserva esos datos en una base de usuarios. Puedes exportarlos o borrarlos desde
            Ajustes.
          </p>
        </section>

        <section>
          <h2 className="display text-[21px] text-[var(--tinta)]">Cuándo salen del navegador</h2>
          <p className="mt-2">
            El perfil se envía temporalmente y mediante HTTPS a Encaja cuando filtras el radar o
            solicitas un dictamen. Si usas una función de inteligencia artificial, la clave, el
            mensaje, los hechos del perfil necesarios, parte de la conversación y el documento
            oficial pueden transmitirse al proveedor elegido —Google, Anthropic u OpenAI— para
            responder esa petición. Encaja no guarda la clave en el servidor ni usa las
            conversaciones para entrenar un modelo propio. El tratamiento del proveedor se rige
            además por sus propias condiciones y política de privacidad.
          </p>
        </section>

        <section>
          <h2 className="display text-[21px] text-[var(--tinta)]">Datos que no debes escribir</h2>
          <p className="mt-2">
            No introduzcas DNI o NIE, cuentas bancarias, contraseñas, claves, informes médicos,
            documentos completos ni datos de terceras personas en el chat. Describe la situación
            con datos aproximados siempre que sea suficiente. La{" "}
            <a
              className="enlace"
              href="https://www.aepd.es/infografias/info-recomendaciones-chatbots-ia.pdf"
              target="_blank"
              rel="noreferrer"
            >
              AEPD recomienda limitar los datos compartidos con chatbots
            </a>
            . Los menores deben utilizar la herramienta con supervisión adulta.
          </p>
        </section>

        <section>
          <h2 className="display text-[21px] text-[var(--tinta)]">Qué no hace Encaja</h2>
          <p className="mt-2">
            No firma, presenta ni envía solicitudes. Los resúmenes, dictámenes y borradores pueden
            contener errores: comprueba siempre el plazo, los requisitos y la forma de presentación
            en la convocatoria oficial antes de actuar.
          </p>
        </section>

        <section>
          <h2 className="display text-[21px] text-[var(--tinta)]">Control de tus datos</h2>
          <p className="mt-2">
            Usa «Descargar mis datos» para obtener una copia y «Borrar mis datos» para eliminar
            perfil, entrevistas, expedientes y clave de este navegador. Borrar los datos del sitio
            desde las preferencias del navegador produce el mismo efecto.
          </p>
        </section>
      </div>

      <Link href="/" className="btn btn-linea mt-10 inline-block">
        Volver al radar
      </Link>
    </article>
  );
}
