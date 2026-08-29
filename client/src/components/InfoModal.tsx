export default function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,7,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 20 }}
      onClick={onClose}
    >
      <div style={{ background: '#15151f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 18, maxWidth: 300 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Como jogar</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'rgba(244,242,248,0.7)' }}>
          O Mestre da Cor recebe uma cor secreta e cria uma frase-pista. Os demais jogadores usam o seletor de cores (matiz, saturação, luminosidade) para escolher a cor que imaginam. Quanto mais perto perceptualmente da cor correta, mais pontos.
        </div>
        <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', marginTop: 14, background: '#8B5CF6', color: '#fff', fontWeight: 700, fontSize: 13, padding: 9, borderRadius: 11 }}>Entendi</button>
      </div>
    </div>
  );
}
