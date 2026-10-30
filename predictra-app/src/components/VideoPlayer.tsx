import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  src: string;
  muted: boolean;
  onComplete: () => void;
}

export default function VideoPlayer({ src, muted: initialMuted, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ambientRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [error, setError] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [needsClickForAudio, setNeedsClickForAudio] = useState(false);

  // Synchronize ambient background video with main video
  const syncAmbient = useCallback(() => {
    if (videoRef.current && ambientRef.current) {
      if (Math.abs(videoRef.current.currentTime - ambientRef.current.currentTime) > 0.15) {
        ambientRef.current.currentTime = videoRef.current.currentTime;
      }
    }
  }, []);

  const enableAudio = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
    }
    if (audioRef.current) {
      audioRef.current.muted = false;
      audioRef.current.volume = 1.0;
      audioRef.current.play().catch(() => {});
    }
    setIsMuted(false);
    setNeedsClickForAudio(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        videoRef.current.volume = 1.0;
        setNeedsClickForAudio(false);
      }
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const ambient = ambientRef.current;
    if (!video) return;

    const handleEnded   = () => onComplete();
    const handleError   = () => setError(true);
    const handleCanPlay = () => setBuffering(false);
    const handleWaiting = () => setBuffering(true);
    const handlePlaying = () => {
      setBuffering(false);
      if (ambient && ambient.paused) {
        ambient.play().catch(() => {});
      }
    };
    const handleTimeUpdate = () => syncAmbient();

    video.addEventListener('ended',      handleEnded);
    video.addEventListener('error',      handleError);
    video.addEventListener('canplay',    handleCanPlay);
    video.addEventListener('waiting',    handleWaiting);
    video.addEventListener('playing',    handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);

    // Initial attempt: Play WITH SOUND (unmuted)
    video.muted = false;
    video.volume = 1.0;
    
    video.play().then(() => {
      setIsMuted(false);
      setNeedsClickForAudio(false);
    }).catch(() => {
      // Browser blocked unmuted autoplay due to policy — fall back to muted and prompt user
      video.muted = true;
      setIsMuted(true);
      setNeedsClickForAudio(true);
      video.play().catch(() => setError(true));
    });

    if (ambient) {
      ambient.muted = true;
      ambient.play().catch(() => {});
    }

    // Global listener: First click anywhere on the page unlocks full sound
    const handleGlobalClick = () => {
      if (video.muted) {
        enableAudio();
      }
    };
    window.addEventListener('click', handleGlobalClick, { once: true });
    window.addEventListener('keydown', handleGlobalClick, { once: true });

    return () => {
      video.removeEventListener('ended',      handleEnded);
      video.removeEventListener('error',      handleError);
      video.removeEventListener('canplay',    handleCanPlay);
      video.removeEventListener('waiting',    handleWaiting);
      video.removeEventListener('playing',    handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalClick);
    };
  }, [onComplete, syncAmbient, enableAudio]);

  if (error) {
    return (
      <motion.div
        key="video-error"
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(180deg, #D9D9D9 0%, #D4D4D4 50%, #CDCDCD 100%)',
          zIndex: 80,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="text-center" style={{ maxWidth: 440, padding: '2rem' }}>
          <div className="font-orbitron text-xl mb-3" style={{ color: '#C8102E' }}>
            ⚠ VIDEO TRANSITION
          </div>
          <p className="font-rajdhani text-base mb-6" style={{ color: '#444444' }}>
            Continuing to the PREDICTRA-X intelligence portal.
          </p>
          <button
            onClick={onComplete}
            className="btn-primary"
            style={{ maxWidth: 260, margin: '0 auto' }}
          >
            ENTER PORTAL →
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="video-player"
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      /* ── EXACT COLOR MATCH: Studio grey gradient matching Trust.mp4 perimeter ── */
      style={{
        background: 'linear-gradient(180deg, #D9D9D9 0%, #D4D4D4 45%, #CDCDCD 100%)',
        zIndex: 80,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* ── AMBIENT VIDEO BACKLIGHT (Seamless blurred halo matching the video in real-time) ── */}
      <video
        ref={ambientRef}
        src={src}
        muted
        playsInline
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{
          filter: 'blur(45px) brightness(1.02) saturate(1.15)',
          transform: 'scale(1.12)',
          opacity: 0.85,
        }}
      />

      {/* ── FOREGROUND MAIN VIDEO WITH SOUND ── */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="auto"
        className="relative z-10 w-full h-full object-contain"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.08))',
        }}
      />

      {/* Synchronized fallback audio element if hardware decoder needs assistance */}
      <audio ref={audioRef} src="/trust_audio.mp3" preload="auto" />

      {/* ── TOP CONTROLS: Sound toggle + Skip Video button ── */}
      <div className="absolute top-6 inset-x-6 z-50 flex items-center justify-between pointer-events-auto">
        {/* Sound toggle status pill */}
        <motion.button
          onClick={toggleMute}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-neutral-400/50 bg-white/90 backdrop-blur-md shadow-sm text-neutral-800 hover:text-[#C8102E] hover:border-[#C8102E] transition-all font-orbitron text-xs font-semibold cursor-pointer"
        >
          <span className="text-sm">{isMuted ? '🔇' : '🔊'}</span>
          <span>{isMuted ? 'SOUND: MUTED (CLICK TO UNMUTE)' : 'SOUND: ON (100%)'}</span>
          {!isMuted && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </motion.button>

        {/* Skip Video button */}
        <motion.button
          onClick={onComplete}
          whileHover={{ scale: 1.05, borderColor: '#C8102E' }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-400/50 bg-white/90 backdrop-blur-md shadow-sm hover:border-[#C8102E] hover:text-[#C8102E] transition-all font-orbitron text-[0.68rem] font-semibold text-neutral-800 cursor-pointer"
        >
          <span>SKIP VIDEO</span>
          <span className="text-[#C8102E]">→</span>
        </motion.button>
      </div>

      {/* ── PULSATING UNMUTE CALLOUT (Visible if browser autoplay policy initially muted audio) ── */}
      <AnimatePresence>
        {needsClickForAudio && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
          >
            <motion.button
              onClick={enableAudio}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              animate={{
                boxShadow: [
                  '0 4px 14px rgba(200, 16, 46, 0.35)',
                  '0 8px 28px rgba(200, 16, 46, 0.65)',
                  '0 4px 14px rgba(200, 16, 46, 0.35)',
                ],
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-3 px-6 py-3 rounded-full bg-[#C8102E] text-white font-orbitron text-xs font-bold tracking-wider cursor-pointer shadow-lg"
            >
              <span className="text-base animate-bounce">🔊</span>
              <span>CLICK TO UNMUTE CINEMATIC AUDIO</span>
              <span className="text-white/80 text-[0.65rem] font-rajdhani font-semibold tracking-normal uppercase ml-1">
                (Stereo 44.1kHz)
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            style={{
              width: 44,
              height: 44,
              border: '3.5px solid rgba(200,16,46,0.2)',
              borderTopColor: '#C8102E',
              borderRadius: '50%',
              animation: 'ring-rotate-cw 0.75s linear infinite',
            }}
          />
        </div>
      )}

      {/* Bottom auto-advance indicator */}
      <div className="absolute bottom-5 right-6 pointer-events-none z-20" style={{ opacity: 0.75 }}>
        <span className="font-rajdhani text-xs tracking-widest uppercase font-bold" style={{ color: '#444444' }}>
          Auto-advances to portal upon completion
        </span>
      </div>
    </motion.div>
  );
}
