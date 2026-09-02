export default function AdminSettings() {
  return (
    <div className="corio-admin-card">
      <div className="corio-admin-card-title">Sobre este painel</div>
      <div style={{ fontSize: 11.5, color: 'rgba(244,242,248,0.65)', lineHeight: 1.7 }}>
        <p style={{ margin: '0 0 10px' }}>
          O acesso é controlado por <code>profiles.is_admin</code>, verificado no servidor em toda chamada
          a <code>/admin/*</code> — nunca só escondendo o link no frontend.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          Fica pra uma próxima etapa: editor de texto completo de perguntas/títulos/avatares (hoje eles vêm de
          catálogos estáticos no código, não do banco), denúncia de jogador contra jogador, e histórico de
          ciclo de vida de sala (quando lotou/esvaziou).
        </p>
        <p style={{ margin: 0 }}>
          Configurações de gameplay (tempo de rodada, pontuação, etc.) continuam sendo alteradas direto no código,
          como sempre — esse painel é só de operação e análise.
        </p>
      </div>
    </div>
  );
}
