import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import defaultLogo from '../../../assets/logo.svg';

const CACHED_LOGO_KEY = 'paw_pilot_cached_logo';
const CACHED_ORG_NAME_KEY = 'paw_pilot_cached_org_name';

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

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
    try {
      await login(email, password, rememberMe);
    } catch (err: any) {
      const message =
        err?.message ||
        err?.error_description ||
        (typeof err === 'string' ? err : null) ||
        'Sign in failed. Please check your credentials and try again.';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-primary p-8 text-center">
          <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg p-2 overflow-hidden">
            <img
              src={cachedLogo || defaultLogo}
              alt={cachedOrgName || 'Paw Pilot Pro'}
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">{cachedOrgName || 'Paw Pilot Pro'}</h1>
          <p className="text-primary-foreground/80 mt-2 text-sm">Staff Operations Platform</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                placeholder="you@dogday.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
            </div>

            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-700 cursor-pointer select-none">
                Stay logged in
              </label>
            </div>

            {error && (
              <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-md border border-destructive/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
