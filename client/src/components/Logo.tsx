export default function Logo({ size = 19 }: { size?: number }) {
  return (
    <div
      style={{
        fontFamily: "'Space Grotesk',sans-serif",
        fontWeight: 700,
        fontSize: size,
        letterSpacing: -0.5,
        background: 'linear-gradient(90deg,#FF5C8A,#8B5CF6 45%,#29E7FF 85%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      color.io
    </div>
  );
}
