import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeSlash, CheckCircle, Warning, CircleNotch } from '@phosphor-icons/react';
import { supabase } from '@/utils/supabase/client';
import defaultLogo from '../../../assets/logo.svg';

const CACHED_LOGO_KEY = 'paw_pilot_cached_logo';
const CACHED_ORG_NAME_KEY = 'paw_pilot_cached_org_name';

type Phase = 'verifying' | 'ready' | 'invalid' | 'done';

/**
 * Handles the Supabase password-recovery link.
 *
 * The recovery email sends the user back here with a token in the URL. The
 * Supabase client (detectSessionInUrl) consumes it and fires a
 * PASSWORD_RECOVERY event, establishing a short-lived session that lets the
 * user set a new password via supabase.auth.updateUser.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const [cachedOrgName, setCachedOrgName] = useState<string | null>(null);

  useEffect(() => {
    setCachedLogo(localStorage.getItem(CACHED_LOGO_KEY));
    setCachedOrgName(localStorage.getItem(CACHED_ORG_NAME_KEY));
  }, []);

  // Detect the recovery session created from the email link
  useEffect(() => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        resolved = true;
        setPhase('ready');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        resolved = true;
        setPhase('ready');
      }
    });

    // If no session has appeared shortly after the URL token is processed,
    // the link is missing/expired.
    const timer = setTimeout(() => {
      if (!resolved) setPhase(p => (p === 'verifying' ? 'invalid' : p));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Sign out the recovery session so the user logs in fresh with the new password
      await supabase.auth.signOut();
      setPhase('done');
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please request a new reset link.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    borderColor: '#E2DED8',
    color: '#1C1916',
    background: '#FFFFFF',
  } as const;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: '#F4F3EF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-8 md:p-10"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
      >
        {/* Logo */}
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'var(--primary-tint)' }}
        >
          <img
            src={cachedLogo || defaultLogo}
            alt={cachedOrgName || 'PawPilot Pro'}
            className="h-8 w-8 object-contain"
          />
        </div>

        {phase === 'verifying' && (
          <div className="flex flex-col items-center text-center py-6">
            <CircleNotch className="h-8 w-8 animate-spin mb-3" style={{ color: 'var(--primary)' }} />
            <p className="text-sm" style={{ color: '#6B6762' }}>Verifying your reset link…</p>
          </div>
        )}

        {phase === 'invalid' && (
          <div className="text-center">
            <Warning className="h-10 w-10 mx-auto mb-4" style={{ color: '#B45309' }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: '#1C1916' }}>
              Reset link invalid or expired
            </h2>
            <p className="text-sm mb-6" style={{ color: '#6B6762' }}>
              This password reset link is no longer valid. Please ask an administrator to send a new one.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full font-semibold text-sm rounded-xl text-white"
              style={{ background: 'var(--primary)', height: 44 }}
            >
              Back to sign in
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center">
            <CheckCircle className="h-10 w-10 mx-auto mb-4" style={{ color: '#16A34A' }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: '#1C1916' }}>
              Password updated
            </h2>
            <p className="text-sm mb-6" style={{ color: '#6B6762' }}>
              Your password has been set. You can now sign in with your new password.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full font-semibold text-sm rounded-xl text-white"
              style={{ background: 'var(--primary)', height: 44 }}
            >
              Go to sign in
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#1C1916' }}>
              Set a new password
            </h2>
            <p className="text-sm mb-8" style={{ color: '#6B6762' }}>
              Choose a password to finish setting up your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-1.5" style={{ color: '#1C1916' }}>
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                    style={{ color: '#6B6762' }}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5" style={{ color: '#1C1916' }}>
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              {error && (
                <div
                  className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm"
                  style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E' }}
                >
                  <Warning className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 font-semibold text-sm rounded-xl text-white transition-opacity disabled:opacity-60"
                style={{ background: 'var(--primary)', height: 44 }}
              >
                {submitting ? <CircleNotch className="h-4 w-4 animate-spin" /> : null}
                {submitting ? 'Saving…' : 'Set password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
