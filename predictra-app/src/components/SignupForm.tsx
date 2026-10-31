import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { User } from '../App';
import { FormField, SubmitButton } from './AuthPage';
import { registerWithKeycloak, checkKeycloakReachable } from '../services/keycloak';

interface Props {
  onSuccess: (user: User) => void;
  onBack: () => void;
}

const RULES = [
  { test: (p: string) => p.length >= 8,          label: 'Min. 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p),        label: 'Uppercase letter'  },
  { test: (p: string) => /[0-9]/.test(p),        label: 'Number'            },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Special character' },
];

const STRENGTH_COLORS = ['#E8394F', '#E86A00', '#D4A500', '#2D7A2D'];
const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function SignupForm({ onSuccess, onBack }: Props) {
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPass,     setConfirmPass]     = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [keycloakLoading, setKeycloakLoading] = useState(false);
  const [keycloakOnline,  setKeycloakOnline]  = useState<boolean | null>(null);
  const [error,           setError]           = useState('');
  const [successMsg,      setSuccessMsg]      = useState('');
  const [fieldErrors,     setFieldErrors]     = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    checkKeycloakReachable().then((online: boolean) => {
      if (mounted) setKeycloakOnline(online);
    });
    return () => { mounted = false; };
  }, []);

  const score = RULES.filter(r => r.test(password)).length;

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email required';
    if (score < 4) e.password = 'Password does not meet all requirements';
    if (password !== confirmPass) e.confirm = 'Passwords do not match';
    return e;
  }, [name, email, password, confirmPass, score]);

  // Keycloak Native Registration with PKCE S256
  const handleKeycloakRegister = async () => {
    setKeycloakLoading(true);
    setError('');
    try {
      await registerWithKeycloak(window.location.origin);
    } catch (err) {
      setKeycloakLoading(false);
      setError('Could not connect to Keycloak identity provider. Ensure Docker container is running.');
      console.error(err);
    }
  };

  // Local Form Submission -> Backend API -> Keycloak Admin API
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || `Registration failed (${res.status})`);
      }

      setSuccessMsg('Account created in Keycloak! Redirecting to sign in & TOTP enrollment...');
      setTimeout(() => {
        onSuccess({
          id: data.userId || 'new-user',
          name: name.trim(),
          email: email.trim(),
          roles: ['sentra-operator'],
          mfaVerified: false,
        });
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Check network or server status.');
    } finally {
      setLoading(false);
    }
  }, [name, email, password, validate, onSuccess]);

  return (
    <motion.div
      className="w-full box-border flex flex-col gap-4 text-neutral-800"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.28 }}
    >
      {/* Keycloak IdP Status Badge — Standardized Width */}
      <div
        className={`w-full box-border px-3.5 py-2.5 rounded-xl border text-xs font-rajdhani flex items-center justify-between transition-colors ${
          keycloakOnline
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              keycloakOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="font-semibold truncate">
            {keycloakOnline
              ? 'Keycloak Identity Provider: ONLINE (Realm: predictra-x)'
              : 'Keycloak Server Offline (Port 8080)'}
          </span>
        </div>
        <span className="font-orbitron text-[0.62rem] font-bold uppercase tracking-wider text-neutral-500 flex-shrink-0 pl-2">
          PKCE S256
        </span>
      </div>

      {/* Direct Keycloak Registration Button (Standardized h-12 Box) */}
      <motion.button
        type="button"
        onClick={handleKeycloakRegister}
        disabled={keycloakLoading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full h-12 box-border rounded-xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white font-orbitron text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2.5 shadow-md border border-neutral-700 hover:border-[#8B1E2D] cursor-pointer transition-all"
      >
        <svg className="w-4 h-4 text-[#8B1E2D] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
        <span className="truncate">{keycloakLoading ? 'CONNECTING TO KEYCLOAK...' : 'REGISTER VIA KEYCLOAK + ENROLL TOTP'}</span>
        <span className="text-[#8B1E2D] font-bold flex-shrink-0">→</span>
      </motion.button>

      {/* Divider — Centered & Full Width */}
      <div className="w-full box-border flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="font-rajdhani text-xs text-neutral-400 uppercase tracking-widest font-semibold whitespace-nowrap text-center select-none">
          OR QUICK REGISTRATION
        </span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      <form onSubmit={handleSubmit} className="w-full box-border flex flex-col gap-4">
        <FormField
          label="FULL NAME"
          value={name}
          onChange={(v) => {
            setName(v);
            setFieldErrors((p) => ({ ...p, name: '' }));
          }}
          placeholder="John Operator"
          required
          error={fieldErrors.name}
        />

        <FormField
          label="EMAIL ADDRESS"
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            setFieldErrors((p) => ({ ...p, email: '' }));
          }}
          placeholder="operator@organization.com"
          required
          error={fieldErrors.email}
        />

        {/* Password + strength */}
        <div className="w-full box-border flex flex-col gap-1.5">
          <FormField
            label="PASSWORD"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(v) => {
              setPassword(v);
              setFieldErrors((p) => ({ ...p, password: '' }));
            }}
            placeholder="Create a strong password"
            required
            error={fieldErrors.password}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="text-xs font-rajdhani font-semibold text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer select-none"
              >
                {showPass ? 'HIDE' : 'SHOW'}
              </button>
            }
          />

          {password.length > 0 && (
            <div className="w-full box-border mt-1">
              <div className="flex gap-1.5 mb-1.5 w-full">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      background: i < score ? STRENGTH_COLORS[score - 1] : '#E5E7EB',
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 w-full">
                {RULES.map((rule, i) => (
                  <span
                    key={i}
                    className="font-rajdhani text-[0.72rem] transition-colors"
                    style={{
                      color: rule.test(password) ? '#16845B' : '#9CA3AF',
                    }}
                  >
                    {rule.test(password) ? '✓' : '○'} {rule.label}
                  </span>
                ))}
              </div>
              {score > 0 && (
                <div
                  className="font-orbitron text-[0.62rem] font-bold tracking-wider mt-1.5"
                  style={{ color: STRENGTH_COLORS[score - 1] }}
                >
                  {STRENGTH_LABELS[score - 1].toUpperCase()} PASSWORD
                </div>
              )}
            </div>
          )}
        </div>

        <FormField
          label="CONFIRM PASSWORD"
          type={showConfirm ? 'text' : 'password'}
          value={confirmPass}
          onChange={(v) => {
            setConfirmPass(v);
            setFieldErrors((p) => ({ ...p, confirm: '' }));
          }}
          placeholder="Repeat your password"
          required
          error={fieldErrors.confirm}
          hint={confirmPass && !fieldErrors.confirm && confirmPass === password ? '✓ Passwords match' : undefined}
          rightElement={
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              className="text-xs font-rajdhani font-semibold text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer select-none"
            >
              {showConfirm ? 'HIDE' : 'SHOW'}
            </button>
          }
        />

        {error && (
          <div className="w-full box-border bg-red-50 border border-red-200 rounded-xl p-3 font-rajdhani text-xs text-[#8B1E2D] flex items-center gap-2">
            <span>⚠</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="w-full box-border bg-emerald-50 border border-emerald-200 rounded-xl p-3 font-rajdhani text-xs text-emerald-800 flex items-center gap-2">
            <span>✓</span>
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        <SubmitButton loading={loading} label="CREATE ACCOUNT IN KEYCLOAK →" />

        <div className="w-full box-border text-center pt-3 border-t border-neutral-200">
          <button
            type="button"
            onClick={onBack}
            className="font-rajdhani text-xs text-neutral-600 hover:text-[#8B1E2D] transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
          >
            <span>Already have an account?</span>
            <span className="text-[#8B1E2D] font-bold underline">Sign In →</span>
          </button>
        </div>
      </form>
    </motion.div>
  );
}
