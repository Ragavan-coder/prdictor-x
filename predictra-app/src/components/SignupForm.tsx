import { useState, useCallback, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { User } from '../App';
import { FormField, SubmitButton } from './AuthPage';

interface Props {
  onSuccess: (user: User) => void;
  onBack: () => void;
}

const RULES = [
  { test: (p: string) => p.length >= 8,       label: 'Min. 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p),     label: 'Uppercase letter'  },
  { test: (p: string) => /[0-9]/.test(p),     label: 'Number'            },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Special character' },
];

const STRENGTH_COLORS = ['#E8394F', '#E86A00', '#D4A500', '#2D7A2D'];
const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'];

export default function SignupForm({ onSuccess, onBack }: Props) {
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const score = RULES.filter(r => r.test(password)).length;

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name = 'Full name is required';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email required';
    if (score < 4)     e.password = 'Password does not meet all requirements';
    if (password !== confirmPass) e.confirm = 'Passwords do not match';
    return e;
  }, [name, email, password, confirmPass, score]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    onSuccess({ name: name.trim(), email });
  }, [name, email, password, validate, onSuccess]);

  return (
    <motion.form onSubmit={handleSubmit} className="flex flex-col gap-4"
      initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.28 }}>

      <FormField label="FULL NAME" value={name}
        onChange={v => { setName(v); setFieldErrors(p => ({ ...p, name: '' })); }}
        placeholder="John Operator" required error={fieldErrors.name} />

      <FormField label="EMAIL ADDRESS" type="email" value={email}
        onChange={v => { setEmail(v); setFieldErrors(p => ({ ...p, email: '' })); }}
        placeholder="operator@organization.com" required error={fieldErrors.email} />

      {/* Password + strength */}
      <div className="flex flex-col gap-1">
        <FormField label="PASSWORD" type={showPass ? 'text' : 'password'}
          value={password}
          onChange={v => { setPassword(v); setFieldErrors(p => ({ ...p, password: '' })); }}
          placeholder="Create a strong password" required error={fieldErrors.password}
          rightElement={
            <button type="button" onClick={() => setShowPass(s => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AAAAAA', fontSize: '0.85rem' }}>
              {showPass ? '🙈' : '👁'}
            </button>
          }
        />

        {password.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {/* Strength bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i < score ? STRENGTH_COLORS[score - 1] : '#EEEEEE',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
            {/* Rule checklist */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
              {RULES.map((rule, i) => (
                <span key={i} className="font-rajdhani" style={{
                  fontSize: '0.72rem',
                  color: rule.test(password) ? '#2D7A2D' : '#AAAAAA',
                  transition: 'color 0.3s',
                }}>
                  {rule.test(password) ? '✓' : '○'} {rule.label}
                </span>
              ))}
            </div>
            {score > 0 && (
              <div className="font-orbitron" style={{
                fontSize: '0.6rem', color: STRENGTH_COLORS[score - 1],
                letterSpacing: '0.12em', marginTop: 4,
              }}>
                {STRENGTH_LABELS[score - 1].toUpperCase()} PASSWORD
              </div>
            )}
          </div>
        )}
      </div>

      <FormField label="CONFIRM PASSWORD" type={showConfirm ? 'text' : 'password'}
        value={confirmPass}
        onChange={v => { setConfirmPass(v); setFieldErrors(p => ({ ...p, confirm: '' })); }}
        placeholder="Repeat your password" required
        error={fieldErrors.confirm}
        hint={confirmPass && !fieldErrors.confirm && confirmPass === password ? '✓ Passwords match' : undefined}
        rightElement={
          <button type="button" onClick={() => setShowConfirm(s => !s)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AAAAAA', fontSize: '0.85rem' }}>
            {showConfirm ? '🙈' : '👁'}
          </button>
        }
      />

      {error && (
        <div style={{
          background: 'rgba(200,16,46,0.05)', border: '1px solid rgba(200,16,46,0.2)',
          borderRadius: 6, padding: '8px 12px',
          fontFamily: 'Rajdhani, sans-serif', fontSize: '0.82rem', color: '#C8102E',
        }}>
          ⚠ {error}
        </div>
      )}

      <SubmitButton loading={loading} label="CREATE ACCOUNT →" />

      <button type="button" onClick={onBack} className="font-rajdhani text-sm text-center"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}>
        Already have an account?{' '}
        <span style={{ color: '#C8102E', fontWeight: 600 }}>Sign In →</span>
      </button>
    </motion.form>
  );
}
