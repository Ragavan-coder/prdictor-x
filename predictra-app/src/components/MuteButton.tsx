import { motion } from 'framer-motion';

interface Props {
  muted: boolean;
  onToggle: () => void;
}

export default function MuteButton({ muted, onToggle }: Props) {
  return (
    <motion.button
      onClick={onToggle}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(200,16,46,0.25)',
        backdropFilter: 'blur(8px)',
        color: '#444444',
        fontSize: '0.68rem',
        fontFamily: 'Orbitron, monospace',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
      whileHover={{ scale: 1.05, borderColor: '#C8102E', color: '#C8102E' }}
      whileTap={{ scale: 0.95 }}
      aria-label={muted ? 'Unmute audio' : 'Mute audio'}
    >
      <span style={{ fontSize: '0.9rem' }}>{muted ? '🔇' : '🔊'}</span>
      <span>{muted ? 'UNMUTE' : 'MUTE'}</span>
    </motion.button>
  );
}
