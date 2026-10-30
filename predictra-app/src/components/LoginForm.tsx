import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { User } from '../App';
import { FormField, SubmitButton } from './AuthPage';
import { loginWithKeycloak, checkKeycloakReachable } from '../services/keycloak';

const DEV_CREDS = { email: 'admin@predictra.x', password: 'SentraAdmin#2026!' };
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface Props {
  onSuccess: (user: User) => void;
  onForgot: () => void;
  onSignup: () => void;
}

export default function LoginForm({ onSuccess, onForgot, onSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [passErr, setPassErr] = useState('');

  // Keycloak server status
  const [keycloakOnline, setKeycloakOnline] = useState<boolean | null>(null);
  const [keycloakLoading, setKeycloakLoading] = useState(false);

  // In-app MFA enrollment / verification modal
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaMode, setMfaMode] = useState<'verify' | 'enroll'>('verify');
  const [mfaCode, setMfaCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('JBSWY3DPEHPK3PXP');
  const [totpQrSvg, setTotpQrSvg] = useState<string>('');
  const [activeDemoCode, setActiveDemoCode] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);

  useEffect(() => {
    let mounted = true;
    checkKeycloakReachable().then((online) => {
      if (mounted) setKeycloakOnline(online);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Countdown timer for 30-second TOTP rotation
  useEffect(() => {
    if (!mfaStep) return;
    const updateCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      setSecondsRemaining(30 - (nowSec % 30));
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [mfaStep]);

  // Fetch real RFC 6238 TOTP setup & scannable QR Code SVG
  const loadTotpSetup = useCallback(async (targetEmail: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/totp/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        setTotpSecret(data.secret);
        setTotpQrSvg(data.qr_code_svg);
        setActiveDemoCode(data.current_code);
      }
    } catch (e) {
      console.warn('Could not load TOTP setup from API, using fallback:', e);
    }
  }, []);

  const validateEmail = (v: string) => {
    if (!v) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Invalid email format';
    return '';
  };

  // Direct Keycloak OIDC PKCE redirect
  const handleKeycloakLogin = async () => {
    setKeycloakLoading(true);
    setError('');
    try {
      await loginWithKeycloak(window.location.origin);
    } catch (err) {
      setKeycloakLoading(false);
      setError('Could not connect to Keycloak identity provider. Ensure Docker container is running.');
      console.error(err);
    }
  };

  const handlePasswordLogin = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      const eErr = validateEmail(email);
      const pErr = password.length < 6 ? 'Password must be at least 6 characters' : '';
      setEmailErr(eErr);
      setPassErr(pErr);
      if (eErr || pErr) return;

      setLoading(true);
      await new Promise((r) => setTimeout(r, 600));

      const targetEmail = email.trim().toLowerCase();
      await loadTotpSetup(targetEmail);

      setLoading(false);
      setMfaStep(true);
      if (targetEmail === 'newuser@predictra.x' || targetEmail.includes('signup')) {
        setMfaMode('enroll');
      } else {
        setMfaMode('verify');
      }
    },
    [email, password, loadTotpSetup]
  );

  // Verify TOTP Code cryptographically against RFC 6238 time window
  const handleMfaSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      if (mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
        setError('Please enter a valid 6-digit TOTP code');
        return;
      }

      setLoading(true);
      try {
        const targetEmail = email.trim().toLowerCase() || 'admin@predictra.x';
        const res = await fetch(`${API_BASE_URL}/api/auth/totp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail, code: mfaCode }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.detail || 'Invalid TOTP code');
        }

        const isAdmin = targetEmail.includes('admin');
        onSuccess({
          id: `user-${targetEmail.replace(/[@.]/g, '-')}`,
          name: isAdmin ? 'Sentra Administrator' : 'Verification Operator',
          email: targetEmail,
          roles: isAdmin ? ['sentra-admin', 'sentra-operator'] : ['sentra-operator'],
          mfaVerified: true,
        });
      } catch (err: any) {
        setError(err.message || 'Invalid 6-digit authenticator code. Enter the active code from your authenticator app.');
      } finally {
        setLoading(false);
      }
    },
    [mfaCode, email, onSuccess]
  );

  // Fetch fresh current code for instant 1-click test fill
  const handleFillDemoCode = async () => {
    try {
      const targetEmail = email.trim().toLowerCase() || 'admin@predictra.x';
      const res = await fetch(`${API_BASE_URL}/api/auth/totp/current-code?email=${encodeURIComponent(targetEmail)}`);
      if (res.ok) {
        const data = await res.json();
        setMfaCode(data.current_code);
      } else {
        setMfaCode(activeDemoCode || '123456');
      }
    } catch {
      setMfaCode(activeDemoCode || '123456');
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     MFA Verification & Enrollment View (Keycloak TOTP Style)
     ────────────────────────────────────────────────────────────────────────── */
  if (mfaStep) {
    return (
      <motion.form
        onSubmit={handleMfaSubmit}
        className="flex flex-col gap-4 text-neutral-800"
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -18 }}
        transition={{ duration: 0.28 }}
      >
        <div className="text-center mb-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C8102E]/10 border border-[#C8102E]/25 text-[#C8102E] font-orbitron text-[0.65rem] font-bold tracking-widest uppercase mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C8102E] animate-pulse" />
            {mfaMode === 'enroll' ? 'TOTP MFA ENROLLMENT REQUIRED' : 'SECOND-FACTOR AUTHENTICATION'}
          </div>
          <h2 className="font-orbitron font-bold text-sm text-neutral-900 tracking-wide">
            {mfaMode === 'enroll' ? 'Enroll Authenticator App' : 'Enter Authenticator Code'}
          </h2>
          <p className="font-rajdhani text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
            {mfaMode === 'enroll'
              ? 'Scan this live QR code with Google Authenticator, Microsoft Authenticator, or Aegis.'
              : 'Enter the 6-digit time-based code generated by your authenticator app.'}
          </p>
        </div>

        {/* Real Scannable QR Code display for Enrollment mode */}
        {mfaMode === 'enroll' && (
          <div className="flex flex-col items-center p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <div className="w-36 h-36 bg-white p-2 rounded border border-neutral-300 shadow-xs flex items-center justify-center [&>svg]:w-full [&>svg]:h-full overflow-hidden">
              {totpQrSvg ? (
                <div dangerouslySetInnerHTML={{ __html: totpQrSvg }} className="w-full h-full flex items-center justify-center" />
              ) : (
                <div className="text-center text-xs font-rajdhani text-neutral-400">Loading QR...</div>
              )}
            </div>

            <div className="mt-2 text-center w-full">
              <span className="font-rajdhani text-[0.7rem] text-neutral-500 uppercase tracking-wider block">
                Manual Setup Key (Base32):
              </span>
              <code className="font-orbitron text-xs text-[#C8102E] font-bold tracking-widest select-all bg-white px-2 py-0.5 rounded border border-neutral-300 inline-block mt-0.5">
                {totpSecret}
              </code>
            </div>
          </div>
        )}

        {/* 6-Digit Code Input with Rotation Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="font-orbitron text-[0.62rem] text-neutral-600 tracking-wider uppercase font-semibold">
              6-Digit Verification Code <span className="text-[#C8102E]">*</span>
            </label>
            <span className="font-rajdhani text-xs font-semibold text-neutral-500 flex items-center gap-1">
              ⏱ Rotates in: <span className="font-orbitron text-[#C8102E]">{secondsRemaining}s</span>
            </span>
          </div>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="secure-input text-center text-xl md:text-2xl font-orbitron font-bold tracking-[0.45em] text-[#C8102E]"
            autoFocus
          />

          {/* 30-Second Rotation Progress Bar */}
          <div className="w-full h-1 bg-neutral-200 rounded-full overflow-hidden mt-0.5">
            <div
              className="h-full bg-[#C8102E] transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsRemaining / 30) * 100}%` }}
            />
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <SubmitButton
          loading={loading}
          label={mfaMode === 'enroll' ? 'CONFIRM ENROLLMENT & ENTER →' : 'VERIFY & ENTER SYSTEM →'}
        />

        {/* Quick helpers & mode switch */}
        <div className="flex items-center justify-between text-xs font-rajdhani text-neutral-500 pt-1">
          <button
            type="button"
            onClick={() => setMfaMode((m) => (m === 'verify' ? 'enroll' : 'verify'))}
            className="hover:text-[#C8102E] underline transition-colors cursor-pointer"
          >
            {mfaMode === 'verify' ? 'Switch to QR Enrollment View' : 'Back to Code Verification'}
          </button>
          <button
            type="button"
            onClick={handleFillDemoCode}
            className="hover:text-[#C8102E] transition-colors cursor-pointer flex items-center gap-1"
          >
            ⚡ <span className="underline font-semibold">Fill active code</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setMfaStep(false);
            setError('');
          }}
          className="text-xs font-rajdhani text-neutral-400 hover:text-neutral-700 transition-colors text-center mt-2 cursor-pointer"
        >
          ← Return to credential input
        </button>
      </motion.form>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     Standard Credential Login View
     ────────────────────────────────────────────────────────────────────────── */
  return (
    <motion.div
      className="flex flex-col gap-4 text-neutral-800"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Keycloak IdP Status Badge */}
      <div
        className={`px-3 py-2 rounded-lg border text-xs font-rajdhani flex items-center justify-between transition-colors ${
          keycloakOnline
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              keycloakOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="font-semibold">
            {keycloakOnline
              ? 'Keycloak Identity Provider: ONLINE (Realm: predictra-x)'
              : 'Keycloak Server Offline (Port 8080)'}
          </span>
        </div>
        <span className="font-orbitron text-[0.6rem] font-bold uppercase tracking-wider text-neutral-500">
          PKCE S256
        </span>
      </div>

      {/* Primary Action: Direct Keycloak OIDC + TOTP Login */}
      <motion.button
        type="button"
        onClick={handleKeycloakLogin}
        disabled={keycloakLoading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white font-orbitron text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2.5 shadow-md border border-neutral-700 hover:border-[#C8102E] cursor-pointer transition-all"
      >
        <svg className="w-4 h-4 text-[#C8102E]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
        <span>
          {keycloakLoading ? 'CONNECTING TO KEYCLOAK...' : 'SIGN IN VIA KEYCLOAK + TOTP'}
        </span>
        <span className="text-[#C8102E] font-bold">→</span>
      </motion.button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="font-rajdhani text-xs text-neutral-400 uppercase tracking-widest font-semibold">
          OR LOCAL AUTHENTICATION
        </span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      {/* In-app Password Login Form */}
      <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3.5">
        <FormField
          id="email-field"
          label="Email or Username"
          type="text"
          value={email}
          onChange={(v) => {
            setEmail(v);
            setEmailErr('');
          }}
          placeholder="admin@predictra.x"
          required
          error={emailErr}
          autoComplete="username"
        />

        <FormField
          id="pass-field"
          label="Password"
          type={showPass ? 'text' : 'password'}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setPassErr('');
          }}
          placeholder="••••••••••••"
          required
          error={passErr}
          autoComplete="current-password"
          rightElement={
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              className="text-xs font-rajdhani text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
            >
              {showPass ? 'HIDE' : 'SHOW'}
            </button>
          }
        />

        <div className="flex items-center justify-between text-xs font-rajdhani pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded text-[#C8102E] focus:ring-[#C8102E] cursor-pointer"
            />
            <span className="text-neutral-600">Remember session</span>
          </label>
          <button
            type="button"
            onClick={onForgot}
            className="text-[#C8102E] hover:underline transition-all cursor-pointer font-semibold"
          >
            Forgot Password?
          </button>
        </div>

        {/* 1-Click Fill Demo Credentials Button */}
        <div className="flex justify-end pt-0.5">
          <button
            type="button"
            onClick={() => {
              setEmail(DEV_CREDS.email);
              setPassword(DEV_CREDS.password);
            }}
            className="font-rajdhani text-xs text-neutral-500 hover:text-[#C8102E] transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            ⚡ <span className="underline font-semibold">Demo credentials (1-click fill)</span>
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        <SubmitButton loading={loading} label="VALIDATE CREDENTIALS →" />
      </form>

      {/* Switch to Signup */}
      <div className="text-center pt-2 border-t border-neutral-100">
        <button
          type="button"
          onClick={onSignup}
          className="font-rajdhani text-xs text-neutral-500 hover:text-[#C8102E] transition-colors cursor-pointer"
        >
          New operator?{' '}
          <span className="text-[#C8102E] font-bold">
            Register Account & Enroll TOTP →
          </span>
        </button>
      </div>
    </motion.div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="bg-red-50 border border-red-200 rounded-lg p-2.5 font-rajdhani text-xs text-[#C8102E] flex items-center gap-2"
    >
      <span>⚠</span>
      <span>{message}</span>
    </motion.div>
  );
}
