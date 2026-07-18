import React, { useState, useEffect } from 'react';
import { Eye, EyeSlash, CheckCircle, Warning } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '@/utils/supabase/client';
import defaultLogo from '../../../assets/logo.svg';

// Cache keys for branding (set by settings store after login)
const CACHED_LOGO_KEY = 'paw_pilot_cached_logo';
const CACHED_ORG_NAME_KEY = 'paw_pilot_cached_org_name';

const FEATURE_BULLETS = [
  'Check-in & capacity tracking',
  'Pet profiles & health records',
  'Staff & scheduling',
];

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetSending, setResetSending] = useState(false);

  // Cached branding from localStorage (set after first successful login)
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const [cachedOrgName, setCachedOrgName] = useState<string | null>(null);

  useEffect(() => {
    const logo = localStorage.getItem(CACHED_LOGO_KEY);
    const orgName = localStorage.getItem(CACHED_ORG_NAME_KEY);
    if (logo) setCachedLogo(logo);
    if (orgName) setCachedOrgName(orgName);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await login(email, password, rememberMe);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address above, then click "Forgot password?".');
      return;
    }
    setResetSending(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setNotice(`If an account exists for ${email.trim()}, a password reset link has been sent.`);
    } catch (err: any) {
      setError(err.message || 'Could not send reset email. Please try again.');
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#F4F3EF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Left Panel (desktop only) ──────────────────────────── */}
      <div
        className="hidden md:flex md:w-1/2 flex-col items-center justify-center relative overflow-hidden p-12"
        style={{ background: 'var(--primary)' }}
      >
        {/* Soft decorative blobs */}
        <div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-20"
          style={{ background: '#FFFFFF' }}
        />
        <div
          className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full opacity-10"
          style={{ background: '#FFFFFF' }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full opacity-10"
          style={{ background: '#FFFFFF' }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-sm text-center text-white">
          {/* Icon */}
          <div className="text-7xl mb-8 select-none">🐾</div>

          <h1 className="text-3xl font-bold mb-4 leading-tight">
            Welcome to PawPilotPro
          </h1>
          <p className="text-base mb-10 leading-relaxed" style={{ color: 'rgba(255,255,255,0.80)' }}>
            The operations platform built for dog daycares that care.
          </p>

          {/* Feature bullets */}
          <ul className="space-y-4 text-left">
            {FEATURE_BULLETS.map((bullet) => (
              <li key={bullet} className="flex items-center gap-3">
                <CheckCircle
                  className="h-5 w-5 shrink-0"
                  style={{ color: 'rgba(255,255,255,0.70)' }}
                />
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.90)' }}>
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right Panel / Login Card ───────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        <div
          className="bg-white rounded-2xl w-full max-w-md p-8 md:p-10"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
        >
          {/* Logo circle */}
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

          {/* Heading */}
          <h2 className="text-2xl font-bold mb-1" style={{ color: '#1C1916' }}>
            Sign in to your workspace
          </h2>
          <p className="text-sm mb-8" style={{ color: '#6B6762' }}>
            Enter your credentials to access the operations dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#1C1916' }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@dogday.com"
                className="w-full px-4 py-2.5 rounded-xl border text-base md:text-sm outline-none transition-all"
                style={{
                  borderColor: '#E2DED8',
                  color: '#1C1916',
                  background: '#FFFFFF',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E2DED8';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#1C1916' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border text-base md:text-sm outline-none transition-all"
                  style={{
                    borderColor: '#E2DED8',
                    color: '#1C1916',
                    background: '#FFFFFF',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2DED8';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                  style={{ color: '#6B6762' }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me + forgot password */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded cursor-pointer"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm cursor-pointer select-none"
                  style={{ color: '#6B6762' }}
                >
                  Keep me signed in for 30 days
                </label>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetSending}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: 'var(--primary)' }}
              >
                {resetSending ? 'Sending…' : 'Forgot password?'}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm"
                style={{
                  background: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                }}
              >
                <Warning className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success notice */}
            {notice && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm"
                style={{
                  background: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  color: '#166534',
                }}
              >
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center font-semibold text-sm rounded-xl transition-opacity disabled:opacity-60"
              style={{
                background: 'var(--primary)',
                color: '#FFFFFF',
                height: 44,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.opacity = '0.92';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {isLoading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-center" style={{ color: 'var(--tertiary-foreground)' }}>
          PawPilotPro &middot; Staff Operations Platform
        </p>
      </div>
    </div>
  );
}
