export default function AjustesPage() {
  return (
    <div className="shell">
      <h1 className="section-title">Ajustes</h1>
      <p className="section-sub">
        Stub de preferencias del local. Acá irán idioma, OpenAI, zonas y notificaciones.
      </p>
      <section className="panel">
        <ul className="inv-list">
          <li className="inv-row">
            <div>
              <strong>Idioma</strong>
              <div className="inv-meta">Español (fijo en MVP)</div>
            </div>
          </li>
          <li className="inv-row">
            <div>
              <strong>OpenAI</strong>
              <div className="inv-meta">Usá OPENAI_API_KEY en el entorno del servidor</div>
            </div>
          </li>
          <li className="inv-row">
            <div>
              <strong>Operador</strong>
              <div className="inv-meta">Dueño · single-tenant</div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
