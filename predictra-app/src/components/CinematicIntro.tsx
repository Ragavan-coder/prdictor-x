import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

const LAYERS = [
  { id: 1, label: 'Evidence Verification',    icon: '◈' },
  { id: 2, label: 'Financial Calculations',   icon: '◆' },
  { id: 3, label: 'Bank Validation',          icon: '◉' },
  { id: 4, label: 'Doubtful-Digit Analysis',  icon: '◐' },
];

export default function CinematicIntro({ onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  const [activeLayers, setActiveLayers] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Optional: subtle cinematic audio
  const playTone = (freq: number, dur: number) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch { /* autoplay blocked — continue silently */ }
  };

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];

    // Phase 1 — shield appears
    t.push(setTimeout(() => { setPhase(1); playTone(220, 0.9); }, 300));

    // Phase 2 — layers activate sequentially
    t.push(setTimeout(() => { setPhase(2); setActiveLayers([1]); playTone(330, 0.4); }, 1100));
    t.push(setTimeout(() => { setActiveLayers([1,2]); }, 1600));
    t.push(setTimeout(() => { setActiveLayers([1,2,3]); }, 2100));
    t.push(setTimeout(() => { setActiveLayers([1,2,3,4]); playTone(440, 0.5); }, 2600));

    // Phase 3 — logo
    t.push(setTimeout(() => { setPhase(3); playTone(330, 0.7); }, 3400));

    // Phase 4 — progress bar → complete
    t.push(setTimeout(() => {
      setPhase(4);
      let p = 0;
      progressRef.current = setInterval(() => {
        p += 2;
        setProgress(p);
        if (p >= 100) {
          clearInterval(progressRef.current!);
          setTimeout(onComplete, 250);
        }
      }, 18);
    }, 4300));

    return () => {
      t.forEach(clearTimeout);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center intro-bg overflow-hidden"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
      style={{ zIndex: 100 }}
    >
      {/* Dot-grid texture (matches video) */}
      <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />

      {/* Radial vignette — gentle warm centre glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(200,16,46,0.04) 0%, transparent 70%)'
      }} />

      {/* Horizontal divider lines (like the video's top/bottom bands) */}
      <div className="absolute top-0 inset-x-0 h-10 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(200,16,46,0.05) 0%, transparent 100%)' }} />
      <div className="absolute bottom-0 inset-x-0 h-10 pointer-events-none"
        style={{ background: 'linear-gradient(0deg, rgba(200,16,46,0.05) 0%, transparent 100%)' }} />

      {/* Skip Intro button in top right */}
      <div className="absolute top-6 right-6 z-50">
        <motion.button
          onClick={onComplete}
          whileHover={{ scale: 1.05, borderColor: '#8B1E2D' }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-300 bg-white/90 backdrop-blur-md shadow-xs hover:border-[#8B1E2D] hover:text-[#8B1E2D] transition-all font-orbitron text-[0.68rem] font-semibold text-neutral-700 cursor-pointer"
        >
          <span>SKIP INTRO</span>
          <span className="text-[#8B1E2D]">→</span>
        </motion.button>
      </div>

      {/* Trust · Secure · Protect (bottom-right — matches the video) */}
      <motion.div
        className="absolute bottom-8 right-10 text-right"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 3 ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      >
        <p className="font-rajdhani font-semibold text-sm"
          style={{ color: 'rgba(26,26,26,0.45)', letterSpacing: '0.06em' }}>
          Trust · Secure · Protect
        </p>
      </motion.div>

      {/* ── Main centred content (Standardized Box Dimensions) ── */}
      <div className="relative z-10 flex flex-col items-center gap-7 w-full max-w-[640px] lg:max-w-[680px] px-8 sm:px-14 md:px-16 mx-auto">

        {/* SHIELD + RINGS */}
        <motion.div
          className="relative flex items-center justify-center"
          style={{ width: 220, height: 220 }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1 : 0.4 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Outer ambient glow (light/red tinted) */}
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{
            background: 'radial-gradient(circle, rgba(200,16,46,0.08) 0%, transparent 68%)',
          }} />

          {/* Ring 1 — slow */}
          <div className="absolute rounded-full ring-cw" style={{
            '--dur': '12s',
            width: 210, height: 210,
            border: '1.5px solid rgba(200,16,46,0.20)',
            borderTopColor: 'rgba(200,16,46,0.70)',
          } as React.CSSProperties} />

          {/* Ring 2 — medium */}
          <div className="absolute rounded-full ring-ccw" style={{
            '--dur': '8s',
            width: 174, height: 174,
            border: '1px dashed rgba(26,26,26,0.12)',
            borderTopColor: 'rgba(26,26,26,0.35)',
          } as React.CSSProperties} />

          {/* Ring 3 — fast, cyan-like (slate) */}
          <div className="absolute rounded-full ring-cw" style={{
            '--dur': '5s',
            width: 138, height: 138,
            border: '1.5px solid rgba(200,16,46,0.12)',
            borderLeftColor: 'rgba(200,16,46,0.55)',
            opacity: phase >= 2 ? 1 : 0,
            transition: 'opacity 0.6s',
          } as React.CSSProperties} />

          {/* Shield SVG */}
          <div style={{ width: 72, height: 82, filter: 'drop-shadow(0 6px 20px rgba(200,16,46,0.45))' }}>
            <ShieldSVG />
          </div>
        </motion.div>

        {/* SENTRA label */}
        <motion.div
          className="text-center mt-1.5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 8 }}
          transition={{ delay: 0.5, duration: 0.7 }}
        >
          <div className="font-orbitron font-bold tracking-[0.35em] text-sm"
            style={{ color: '#C8102E' }}>
            SENTRA
          </div>
          <div className="font-rajdhani text-xs tracking-[0.22em] mt-0.5"
            style={{ color: 'rgba(26,26,26,0.45)' }}>
            FOUR-LAYER VERIFICATION CORE
          </div>
        </motion.div>

        {/* FOUR LAYERS */}
        {phase >= 2 && (
          <div className="w-full flex flex-col gap-1.5">
            {LAYERS.map((l, i) => (
              <motion.div
                key={l.id}
                className={`layer-item ${activeLayers.includes(l.id) ? 'active' : ''}`}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12, duration: 0.45 }}
              >
                {/* Dot indicator */}
                <div className="status-dot" style={{
                  background: activeLayers.includes(l.id) ? '#C8102E' : '#CCCCCC',
                  boxShadow: activeLayers.includes(l.id) ? '0 0 6px rgba(200,16,46,0.5)' : 'none',
                  transition: 'all 0.4s ease',
                }} />
                <span className="font-rajdhani text-sm font-semibold" style={{
                  color: activeLayers.includes(l.id) ? '#1A1A1A' : '#AAAAAA',
                  transition: 'color 0.4s',
                  letterSpacing: '0.04em',
                }}>
                  {l.icon} &nbsp;L{l.id} — {l.label}
                </span>
                {activeLayers.includes(l.id) && (
                  <motion.span
                    className="ml-auto font-orbitron"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ fontSize: '0.58rem', color: '#C8102E', letterSpacing: '0.1em' }}
                  >
                    ACTIVE
                  </motion.span>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* PREDICTRA-X LOGO */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.88, filter: 'blur(8px)' }}
          animate={{
            opacity: phase >= 3 ? 1 : 0,
            scale:  phase >= 3 ? 1 : 0.88,
            filter: phase >= 3 ? 'blur(0px)' : 'blur(8px)',
          }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Main brand — matches the video exactly */}
          <div className="font-orbitron font-black tracking-wider flex items-baseline justify-center gap-0"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', lineHeight: 1 }}>
            <span style={{
              background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 40%, #1A1A1A 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              PREDICTRA-
            </span>
            <span style={{
              background: 'linear-gradient(135deg, #8B0000 0%, #C8102E 40%, #E8394F 65%, #C8102E 85%, #8B0000 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'metallic-shimmer 3s linear infinite',
            }}>
              X
            </span>
          </div>

          <div className="font-rajdhani font-semibold tracking-[0.2em] mt-2 text-sm"
            style={{ color: '#444444' }}>
            SENTRA | FOUR-LAYER VERIFICATION CORE
          </div>
          <div className="font-rajdhani font-bold tracking-[0.15em] mt-1 text-xs"
            style={{ color: '#1A1A1A' }}>
            TRUST EVERY VALUE. TRACK EVERY FDR.
          </div>
        </motion.div>

        {/* INITIALIZING BAR */}
        {phase >= 4 && (
          <motion.div
            className="w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-orbitron" style={{
                fontSize: '0.58rem', letterSpacing: '0.18em',
                color: 'rgba(26,26,26,0.4)', textTransform: 'uppercase',
              }}>
                Initializing Secure Environment
              </span>
              <span className="font-orbitron" style={{ fontSize: '0.6rem', color: '#C8102E' }}>
                {progress}%
              </span>
            </div>
            {/* Track */}
            <div className="w-full rounded-full overflow-hidden" style={{
              height: 3, background: 'rgba(26,26,26,0.10)'
            }}>
              <div className="h-full rounded-full" style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #8B0000, #C8102E, #E8394F)',
                boxShadow: '0 0 8px rgba(200,16,46,0.5)',
                animation: 'progress-glow 1.5s ease-in-out infinite',
                transition: 'width 0.02s linear',
              }} />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Shield SVG (crimson + dark charcoal, no white fill) ── */
function ShieldSVG() {
  return (
    <svg viewBox="0 0 72 82" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      {/* Body */}
      <path d="M36 3L6 14V40C6 58 19 74 36 80C53 74 66 58 66 40V14L36 3Z"
        fill="url(#shFill)" stroke="url(#shStroke)" strokeWidth="1.2" />
      {/* Inner highlight */}
      <path d="M36 12L16 21V40C16 54 25 66 36 72C47 66 56 54 56 40V21L36 12Z"
        fill="url(#shInner)" />
      {/* S mark */}
      <text x="36" y="50" textAnchor="middle"
        fontFamily="Orbitron, monospace" fontSize="22" fontWeight="800"
        fill="url(#shText)">S</text>
      <defs>
        <linearGradient id="shFill" x1="36" y1="3" x2="36" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#6B0000" />
          <stop offset="45%"  stopColor="#C8102E" />
          <stop offset="80%"  stopColor="#8B0000" />
          <stop offset="100%" stopColor="#3A0000" />
        </linearGradient>
        <linearGradient id="shStroke" x1="0" y1="0" x2="72" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#E8394F" />
          <stop offset="50%"  stopColor="#C8102E" />
          <stop offset="100%" stopColor="#6B0000" />
        </linearGradient>
        <linearGradient id="shInner" x1="36" y1="12" x2="36" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,160,160,0.25)" />
          <stop offset="100%" stopColor="rgba(200,16,46,0.03)"   />
        </linearGradient>
        <linearGradient id="shText" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFD0D0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
