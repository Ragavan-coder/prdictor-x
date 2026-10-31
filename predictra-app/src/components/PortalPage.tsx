import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onEnter: () => void;
  onReplayVideo?: () => void;
}

export default function PortalPage({ onEnter, onReplayVideo }: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    // Subtle audio feedback if supported
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // AudioContext blocked or unavailable
    }

    setTimeout(() => {
      onEnter();
    }, 350);
  };

  return (
    <motion.div
      key="portal-page"
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden select-none"
      style={{
        background: '#ECEDEA',
        zIndex: 70,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── 3D STUDIO BACKGROUND (Exact room from video with lighting cove and floor reflection) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/clean_studio_bg.jpg)',
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          opacity: 1,
        }}
      />

      {/* Subtle architectural cove lights overlay for maximum crispness */}
      <div
        className="absolute top-0 inset-x-0 h-48 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 90% 80% at 50% -20%, rgba(255,255,255,0.6) 0%, rgba(234,234,234,0.2) 60%, transparent 100%)',
        }}
      />

      {/* Floating micro-light particles (subtle cinematic bokeh) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { x: '18%', y: '25%', s: 3, d: 0 },
          { x: '82%', y: '30%', s: 4, d: 1.2 },
          { x: '28%', y: '68%', s: 2.5, d: 2 },
          { x: '74%', y: '62%', s: 3.5, d: 0.8 },
          { x: '48%', y: '18%', s: 2, d: 1.6 },
          { x: '12%', y: '52%', s: 3, d: 2.4 },
          { x: '88%', y: '75%', s: 2.5, d: 1.9 },
        ].map((pt, idx) => (
          <motion.div
            key={idx}
            className="absolute rounded-full"
            style={{
              left: pt.x,
              top: pt.y,
              width: pt.s,
              height: pt.s,
              background: 'rgba(255, 255, 255, 0.9)',
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.8), 0 0 16px rgba(200, 16, 46, 0.25)',
            }}
            animate={{
              y: [0, -12, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.25, 1],
            }}
            transition={{
              duration: 4 + idx * 0.5,
              repeat: Infinity,
              delay: pt.d,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* ── TOP CONTROLS (Replay Video option) ── */}
      <div className="absolute top-6 inset-x-8 flex items-center justify-between z-20 pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#8B1E2D] animate-pulse" />
          <span className="font-orbitron text-[0.65rem] tracking-[0.2em] uppercase text-[#667085] font-semibold">
            SENTRA CORE ONLINE
          </span>
        </div>

        {onReplayVideo && (
          <motion.button
            onClick={onReplayVideo}
            whileHover={{ scale: 1.05, borderColor: '#8B1E2D' }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E4E7EC] bg-white/90 backdrop-blur-md shadow-xs text-[#20242C] hover:text-[#8B1E2D] hover:border-[#8B1E2D] transition-all font-rajdhani text-xs font-semibold cursor-pointer"
            title="Replay cinematic video"
          >
            <span>↺</span>
            <span className="tracking-wider uppercase">Replay Video</span>
          </motion.button>
        )}
      </div>

      {/* ── CENTERPIECE RECREATION (Exact visual from video & screenshot) ── */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl px-4 text-center">
        {/* PREDICTRA-X Brand Logo with exact 3D ruby X */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center"
        >
          {/* High-fidelity transparent logo asset extracted directly from the video */}
          <div className="relative flex items-center justify-center">
            <img
              src="/pred_x_only.png"
              alt="PREDICTRA-X"
              className="h-12 md:h-18 w-auto object-contain select-none"
              style={{
                filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.12)) drop-shadow(0 2px 4px rgba(200,16,46,0.15))',
              }}
              draggable={false}
            />
          </div>

          {/* Subtitle: SENTRA | FOUR-LAYER VERIFICATION CORE */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="font-rajdhani font-bold tracking-[0.22em] uppercase text-[#20242C] text-sm md:text-base mt-3.5"
            style={{ letterSpacing: '0.22em' }}
          >
            SENTRA <span className="text-[#667085] font-light mx-1">|</span> FOUR-LAYER VERIFICATION CORE
          </motion.div>

          {/* Tagline: TRUST EVERY VALUE. TRACK EVERY FDR. */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="font-rajdhani font-bold text-xs md:text-sm tracking-[0.18em] uppercase text-[#20242C] mt-4"
          >
            TRUST EVERY VALUE. TRACK EVERY FDR.
          </motion.p>

          {/* ── INTERACTIVE CALL-TO-ACTION BUTTON (PERFECT ENTERPRISE HERO BOX) ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="mt-8 sm:mt-10 relative w-full flex flex-col items-center"
          >
            <motion.button
              id="enter-intelligence-system-btn"
              onClick={handleClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                group relative w-full max-w-[640px] lg:max-w-[680px]
                flex flex-col items-center justify-center
                px-8 sm:px-14 md:px-16 py-5 sm:py-5.5 rounded-2xl
                border-2 cursor-pointer transition-all duration-300
                ${
                  isClicked
                    ? 'bg-[#8B1E2D] text-white border-[#8B1E2D] shadow-xl'
                    : 'bg-white/95 text-[#20242C] border-[#E4E7EC] hover:border-[#8B1E2D]'
                }
              `}
              style={{
                boxShadow: isHovered
                  ? '0 20px 48px -8px rgba(139, 30, 45, 0.22), 0 8px 20px -4px rgba(0, 0, 0, 0.08)'
                  : '0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Subtle crimson focus halo */}
              <span
                className="absolute inset-0 rounded-2xl border-2 border-[#8B1E2D] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  animation: 'progress-glow 2.5s infinite ease-in-out',
                }}
              />

              {/* Status Header inside the box */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${isClicked ? 'bg-white' : 'bg-[#8B1E2D]'} animate-pulse`} />
                <span className={`font-orbitron text-[0.66rem] sm:text-[0.68rem] tracking-[0.22em] uppercase font-semibold ${isClicked ? 'text-white/80' : 'text-[#667085]'}`}>
                  SECURE INTELLIGENCE GATEWAY
                </span>
              </div>

              {/* Main Headline CTA - spacious side clearance so words never touch edges */}
              <div className="flex items-center justify-center gap-3 w-full px-2">
                <span className={`font-rajdhani font-black text-base sm:text-lg md:text-xl tracking-[0.14em] uppercase transition-colors whitespace-nowrap ${
                  isClicked ? 'text-white' : 'text-[#20242C] group-hover:text-[#8B1E2D]'
                }`}>
                  ENTER THE INTELLIGENCE SYSTEM
                </span>
                <motion.span
                  className={`font-black text-lg sm:text-xl leading-none transition-colors ${
                    isClicked ? 'text-white' : 'text-[#8B1E2D] group-hover:text-[#6F1724]'
                  }`}
                  animate={{ x: isHovered ? 5 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  →
                </motion.span>
              </div>
            </motion.button>

            {/* Subtle instructional hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
              className="font-inter text-xs sm:text-[13px] tracking-wider text-[#667085] mt-3.5 select-none"
            >
              Click above to proceed to authentication
            </motion.p>
          </motion.div>
        </motion.div>
      </div>

      {/* ── BOTTOM RIGHT WATERMARK (Matches screenshot) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="absolute bottom-6 md:bottom-8 right-6 md:right-10 text-right pointer-events-none select-none z-20"
      >
        <div className="font-inter font-bold text-neutral-800 text-xs md:text-sm tracking-wide">
          Trust · Secure ·
        </div>
        <div className="font-inter font-bold text-neutral-800 text-xs md:text-sm tracking-wide">
          Protect
        </div>
      </motion.div>
    </motion.div>
  );
}
