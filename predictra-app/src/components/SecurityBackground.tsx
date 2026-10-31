

const DOTS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  delay: Math.random() * 6,
  dur: 3 + Math.random() * 4,
}));

export default function SecurityBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>

      {/* Dot-grid (matches video texture) */}
      <div className="absolute inset-0 dot-grid opacity-50" />

      {/* Very subtle top-left radial blush */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 55% 45% at 15% 10%, rgba(139,30,45,0.04) 0%, transparent 60%),
          radial-gradient(ellipse 45% 40% at 85% 85%, rgba(139,30,45,0.03) 0%, transparent 60%)
        `,
      }} />

      {/* Outer decorative rings — very faint on white */}
      {[
        { size: '85vmin', dur: '28s', dir: 'cw',  opacity: 0.08 },
        { size: '110vmin', dur: '40s', dir: 'ccw', opacity: 0.05 },
        { size: '60vmin', dur: '18s', dir: 'cw',  opacity: 0.06 },
      ].map((r, i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: '50%', top: '50%',
          width: r.size, height: r.size,
          transform: 'translate(-50%, -50%)',
          border: `1px ${i === 1 ? 'dashed' : 'solid'} rgba(139,30,45,${r.opacity})`,
          animation: `ring-rotate-${r.dir} ${r.dur} linear infinite`,
        }} />
      ))}

      {/* Floating particles — very subtle on white */}
      {DOTS.map(d => (
        <div key={d.id} className="absolute rounded-full" style={{
          left: `${d.x}%`,
          top: `${d.y}%`,
          width: `${d.size}px`,
          height: `${d.size}px`,
          background: d.id % 3 === 0 ? '#8B1E2D' : '#CCCCCC',
          opacity: 0,
          animation: `particle-twinkle ${d.dur}s ${d.delay}s ease-in-out infinite`,
        }} />
      ))}

      {/* Corner bracket decorators */}
      {[
        { top: 20,    left: 20,   d: 'M0 24 L0 0 L24 0'   },
        { top: 20,    right: 20,  d: 'M28 24 L28 0 L4 0'  },
        { bottom: 20, left: 20,   d: 'M0 4 L0 28 L24 28'  },
        { bottom: 20, right: 20,  d: 'M28 4 L28 28 L4 28' },
      ].map((c, i) => (
        <div key={i} className="absolute" style={{ top: c.top, bottom: c.bottom, left: c.left, right: c.right }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.18 }}>
            <path d={c.d} stroke="#8B1E2D" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      ))}

      {/* Top accent line */}
      <div className="absolute top-0 inset-x-0" style={{
        height: 2,
        background: 'linear-gradient(90deg, transparent 0%, rgba(200,16,46,0.3) 25%, rgba(200,16,46,0.5) 50%, rgba(200,16,46,0.3) 75%, transparent 100%)',
      }} />
    </div>
  );
}
