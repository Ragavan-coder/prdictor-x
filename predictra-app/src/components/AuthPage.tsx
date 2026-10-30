import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../App';
import SecurityBackground from './SecurityBackground';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

interface Props {
  onAuthSuccess: (user: User) => void;
  onBackToPortal?: () => void;
}

export type AuthView = 'login' | 'signup' | 'forgot' | 'mfa-guide';

export default function AuthPage({ onAuthSuccess, onBackToPortal }: Props) {
  const [view, setView] = useState<AuthView>('login');

  return (
    <motion.div
      key="auth-page"
      className="fixed inset-0 flex items-center justify-center overflow-auto auth-bg py-8 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      style={{ zIndex: 60 }}
    >
      <SecurityBackground />

      {/* Centred Card Container */}
      <motion.div
        className="relative z-10 w-full max-w-lg my-auto"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Return to Portal Header */}
        {onBackToPortal && (
          <div className="flex justify-between items-center mb-3 px-1">
            <motion.button
              onClick={onBackToPortal}
              whileHover={{ x: -3 }}
              className="inline-flex items-center gap-1.5 text-xs font-rajdhani font-semibold text-neutral-600 hover:text-[#C8102E] transition-colors cursor-pointer"
            >
              <span>←</span>
              <span className="tracking-wider uppercase">Return to System Portal</span>
            </motion.button>

            <span className="font-orbitron text-[0.62rem] text-neutral-500 uppercase tracking-widest">
              Security Level 4 · MFA
            </span>
          </div>
        )}

        {/* Brand header */}
        <div className="text-center mb-5">
          <motion.div
            className="flex justify-center mb-2"
            initial={{ scale: 0, rotate: -120 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.25, duration: 0.6, type: 'spring', stiffness: 220 }}
          >
            <AuthShield />
          </motion.div>

          <motion.div
            className="font-orbitron font-black tracking-wider flex items-baseline justify-center"
            style={{ fontSize: 'clamp(1.3rem, 4vw, 1.75rem)' }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <span
              style={{
                background: 'linear-gradient(135deg, #1A1A1A, #2D2D2D, #1A1A1A)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              PREDICTRA-
            </span>
            <span
              style={{
                background:
                  'linear-gradient(135deg, #8B0000 0%, #C8102E 40%, #E8394F 65%, #C8102E 85%, #8B0000 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'metallic-shimmer 3.5s linear infinite',
              }}
            >
              X
            </span>
          </motion.div>

          <motion.p
            className="font-rajdhani text-xs tracking-[0.2em] mt-1 font-semibold text-neutral-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            SENTRA | FOUR-LAYER VERIFICATION CORE
          </motion.p>
        </div>

        {/* Security Card */}
        <motion.div
          className="card overflow-hidden bg-white/95 backdrop-blur-md shadow-xl border border-neutral-200 rounded-2xl"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Top crimson accent bar */}
          <div className="card-top-bar" />

          {/* Navigation Tabs */}
          <div className="flex border-b border-neutral-200">
            {[
              { id: 'login', label: 'SIGN IN' },
              { id: 'signup', label: 'CREATE ACCOUNT' },
              { id: 'mfa-guide', label: 'MFA & RECOVERY' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as AuthView)}
                className="flex-1 py-3 font-orbitron text-[0.68rem] tracking-wider uppercase transition-all duration-200 cursor-pointer font-bold"
                style={{
                  color: view === tab.id ? '#C8102E' : '#737373',
                  background: view === tab.id ? 'rgba(200,16,46,0.04)' : 'transparent',
                  borderBottom: view === tab.id ? '2.5px solid #C8102E' : '2.5px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Views */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {view === 'login' && (
                <LoginForm
                  key="login"
                  onSuccess={onAuthSuccess}
                  onForgot={() => setView('forgot')}
                  onSignup={() => setView('signup')}
                />
              )}
              {view === 'signup' && (
                <SignupForm
                  key="signup"
                  onSuccess={onAuthSuccess}
                  onBack={() => setView('login')}
                />
              )}
              {view === 'forgot' && (
                <ForgotForm key="forgot" onBack={() => setView('login')} />
              )}
              {view === 'mfa-guide' && (
                <MFAGuidanceView key="mfa-guide" onBack={() => setView('login')} />
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer badges */}
        <motion.div
          className="flex items-center justify-center gap-3 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <div className="mfa-badge">KEYCLOAK TOTP MFA</div>
          <span className="font-rajdhani text-xs text-neutral-500 font-semibold tracking-wide">
            OpenID Connect · PKCE S256 · SHA-256 Audit Chain
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ── Small shield for auth header ── */
function AuthShield() {
  return (
    <svg
      width="44"
      height="50"
      viewBox="0 0 48 54"
      fill="none"
      style={{ filter: 'drop-shadow(0 4px 12px rgba(200,16,46,0.35))' }}
    >
      <path
        d="M24 2L4 9.5V28C4 40 13 50 24 53C35 50 44 40 44 28V9.5L24 2Z"
        fill="url(#asFill)"
        stroke="url(#asStroke)"
        strokeWidth="1"
      />
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fontFamily="Orbitron, monospace"
        fontSize="15"
        fontWeight="800"
        fill="white"
      >
        S
      </text>
      <defs>
        <linearGradient id="asFill" x1="24" y1="2" x2="24" y2="53" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6B0000" />
          <stop offset="50%" stopColor="#C8102E" />
          <stop offset="100%" stopColor="#3A0000" />
        </linearGradient>
        <linearGradient id="asStroke" x1="0" y1="0" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8394F" />
          <stop offset="100%" stopColor="#6B0000" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── MFA Guidance & Recovery View ── */
function MFAGuidanceView({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-4 font-rajdhani text-neutral-800"
    >
      <div className="border-b border-neutral-200 pb-2">
        <h3 className="font-orbitron text-xs font-bold text-neutral-900 tracking-wider uppercase">
          Keycloak TOTP Multi-Factor Authentication
        </h3>
        <p className="text-xs text-neutral-500 mt-1">
          PREDICTRA-X enforces RFC 6238 Time-based One-Time Password verification for all operators.
        </p>
      </div>

      <div className="space-y-3 text-xs">
        <div className="flex gap-2.5 items-start p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
          <span className="font-orbitron font-bold text-sm text-[#C8102E]">1</span>
          <div>
            <span className="font-bold text-neutral-900 block">Enroll an Authenticator App</span>
            <span className="text-neutral-600">
              Download Google Authenticator, Microsoft Authenticator, FreeOTP, or Aegis on your mobile device.
            </span>
          </div>
        </div>

        <div className="flex gap-2.5 items-start p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
          <span className="font-orbitron font-bold text-sm text-[#C8102E]">2</span>
          <div>
            <span className="font-bold text-neutral-900 block">Scan QR Code or Enter Setup Key</span>
            <span className="text-neutral-600">
              Upon first registration or initial login, Keycloak automatically renders a high-res QR code and Base32 setup key.
            </span>
          </div>
        </div>

        <div className="flex gap-2.5 items-start p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
          <span className="font-orbitron font-bold text-sm text-[#C8102E]">3</span>
          <div>
            <span className="font-bold text-neutral-900 block">Subsequent Two-Factor Logins</span>
            <span className="text-neutral-600">
              Every login requires both your password and the active 6-digit TOTP code (refreshed every 30 seconds).
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
        <span className="font-bold text-amber-900 block font-orbitron text-[0.65rem] tracking-wider uppercase mb-1">
          Secure Account Recovery Policy:
        </span>
        <p className="text-amber-800 leading-relaxed">
          If your authenticator device is lost or compromised, contact your designated Sentra Realm Administrator
          (<code className="bg-amber-100/80 px-1 py-0.5 rounded text-amber-900 font-semibold">admin@predictra.x</code>).
          Administrators can reset TOTP credentials via the Keycloak Console or issue a temporary emergency bypass token after identity re-verification.
        </p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full py-2.5 rounded-lg bg-neutral-900 text-white font-orbitron text-xs font-bold tracking-wider uppercase cursor-pointer hover:bg-neutral-800 transition-colors"
      >
        ← BACK TO SIGN IN
      </button>
    </motion.div>
  );
}

/* ── Forgot Password View ── */
function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="flex flex-col gap-4"
    >
      <div className="text-center mb-1">
        <h3 className="font-orbitron font-bold text-xs uppercase tracking-wider text-neutral-900">
          Password & TOTP Reset Request
        </h3>
        <p className="font-rajdhani text-xs text-neutral-500 mt-1">
          Enter your registered email to trigger Keycloak's secure credential recovery flow.
        </p>
      </div>

      {submitted ? (
        <div className="text-center py-4">
          <div className="text-2xl mb-2">✉</div>
          <p className="font-rajdhani text-xs text-neutral-700">
            If an account exists for <strong className="text-neutral-900">{email}</strong>, a secure reset link with MFA confirmation has been dispatched.
          </p>
          <button
            onClick={onBack}
            className="btn-primary mt-4 py-2 font-orbitron text-xs"
          >
            ← BACK TO SIGN IN
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="flex flex-col gap-3.5"
        >
          <FormField
            id="forgot-email"
            label="Registered Operator Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="operator@predictra.x"
            required
          />

          <SubmitButton loading={false} label="DISPATCH RECOVERY LINK →" />

          <button
            type="button"
            onClick={onBack}
            className="text-xs font-rajdhani text-neutral-500 hover:text-neutral-900 text-center cursor-pointer mt-1"
          >
            ← Cancel and return to sign in
          </button>
        </form>
      )}
    </motion.div>
  );
}

/* ── Reusable FormField ── */
export interface FormFieldProps {
  id?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  rightElement?: React.ReactNode;
  autoComplete?: string;
}

export function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  error,
  hint,
  rightElement,
  autoComplete,
}: FormFieldProps) {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label
          htmlFor={fieldId}
          className="font-orbitron text-[0.62rem] font-semibold text-neutral-600 tracking-wider uppercase"
        >
          {label} {required && <span className="text-[#C8102E]">*</span>}
        </label>
        {rightElement}
      </div>

      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={`secure-input ${
          error ? 'border-[#C8102E] focus:border-[#C8102E]' : 'border-neutral-300'
        }`}
      />

      {error ? (
        <span className="font-rajdhani text-[0.72rem] text-[#C8102E] font-medium">{error}</span>
      ) : hint ? (
        <span className="font-rajdhani text-[0.7rem] text-neutral-500">{hint}</span>
      ) : null}
    </div>
  );
}

/* ── Reusable SubmitButton ── */
export function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn-primary mt-1 w-full py-2.5 font-orbitron text-xs font-bold tracking-wider uppercase cursor-pointer"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>VERIFYING CREDENTIALS...</span>
        </span>
      ) : (
        label
      )}
    </button>
  );
}
