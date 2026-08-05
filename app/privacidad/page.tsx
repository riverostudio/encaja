import Link from "next/link";

export default function Privacidad() {
  return (
    <article className="mx-auto max-w-2xl">
      <p className="rotulo">Encaja</p>
      <h1 className="display mt-2 text-[34px] leading-tight">Privacidad y uso responsable</h1>
      <p className="nota mt-3">Última actualización: 5 de agosto de 2026.</p>

      <div className="mt-9 space-y-8 text-[14px] leading-relaxed text-[var(--grafito)]">
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
            solicitas un dictamen. Si usas una función de inteligencia artificial, la clave, los
            datos estrictamente necesarios y el documento oficial se transmiten al proveedor que
            hayas elegido —Google, Anthropic u OpenAI— para responder esa petición. Encaja no guarda
            la clave en el servidor.
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
