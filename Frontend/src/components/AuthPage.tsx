import { useEffect, useMemo, useState } from 'react';
import { X, LogIn, UserPlus, Mail, Lock, User, ArrowRight, Sparkles, KeyRound } from 'lucide-react';
import type { AuthUser } from '../lib/auth';
import { getErrorMessage } from '../lib/errors';

type AuthMode = 'login' | 'register' | 'recovery';

interface AuthPageProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (mode: AuthMode) => void;
  onAuthSuccess: (user: AuthUser) => void;
  onLogin: (email: string, password: string) => Promise<AuthUser>;
  onRegister: (name: string, email: string, password: string) => Promise<AuthUser>;
  onForgotPassword: (email: string) => Promise<void>;
  onResetPassword: (password: string) => Promise<void>;
}

export default function AuthPage({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
  onAuthSuccess,
  onLogin,
  onRegister,
  onForgotPassword,
  onResetPassword,
}: AuthPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setEmail('');
      setPassword('');
      setStatusMessage('');
      setErrorMessage('');
    }
  }, [isOpen, mode]);

  const title =
    mode === 'login'
      ? 'Welcome Back'
      : mode === 'register'
        ? 'Create Your Account'
        : 'Reset Your Password';

  const subtitle =
    mode === 'login'
      ? 'Sign in to save papers, collaborate with friends, and keep your research workspace in sync.'
      : mode === 'register'
        ? 'Register a workspace account to share papers, join collaboration threads, and personalize your library.'
        : 'Choose a new password to continue your session securely.';

  const helperText = useMemo(() => {
    return mode === 'login'
      ? 'Sessions now persist through Supabase auth, so your protected workspace data stays tied to your account.'
      : mode === 'register'
        ? 'Your profile and workspace data are stored per user in Supabase with row-level security.'
        : 'This screen opens after a valid recovery link returns you to the app.';
  }, [mode]);

  const handleSubmit = async () => {
    setErrorMessage('');
    setStatusMessage('');
    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        if (!name.trim() || !email.trim() || !password.trim()) return;
        const user = await onRegister(name.trim(), email.trim(), password.trim());
        onAuthSuccess(user);
        onClose();
      } else if (mode === 'login') {
        if (!email.trim() || !password.trim()) return;
        const user = await onLogin(email.trim(), password.trim());
        onAuthSuccess(user);
        onClose();
      } else {
        if (!password.trim()) return;
        await onResetPassword(password.trim());
        setStatusMessage('Password updated. You can close this window and continue with your workspace.');
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Authentication failed.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email first to receive a reset link.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('');
    setIsSubmitting(true);

    try {
      await onForgotPassword(email.trim());
      setStatusMessage('Password reset link sent. Open the email link in this browser to finish recovery.');
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Unable to send reset email.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[116] bg-[var(--bg-overlay)] p-4 backdrop-blur-md md:p-6">
      <div className="mx-auto flex h-full max-w-[1320px] overflow-hidden rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-strong)]">
        <div className="hidden w-[42%] flex-col justify-between border-r border-[var(--border-color)] bg-[var(--bg-shell)] p-8 lg:flex">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-accent)]">
              <Sparkles size={14} />
              Research Workspace
            </div>
            <h1 className="max-w-md text-4xl font-bold leading-tight text-[var(--text-primary)]">
              {mode === 'login' ? 'Continue your research flow without losing context.' : mode === 'register' ? 'Build a shared research identity for your workspace.' : 'Secure your workspace access again.'}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-[var(--text-secondary)]">
              Save papers, move between graph exploration and collaboration, and keep your discussions attached to the work that matters.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              'Saved papers are protected per user and sync across sessions.',
              'Collaboration threads and shared papers are scoped by account.',
              'Password reset and session persistence now run through Supabase auth.',
            ].map((item) => (
              <div key={item} className="soft-card rounded-[1.5rem] p-4 text-sm leading-7 text-[var(--text-primary)]">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-5 md:px-8">
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Register' : 'Recovery'}
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <X size={20} />
            </button>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-8 md:px-8">
            <div className="mx-auto max-w-[520px]">
              <p className="mb-8 text-sm leading-7 text-[var(--text-secondary)]">{subtitle}</p>

              <div className="soft-card rounded-[1.8rem] p-5 md:p-6">
                <div className="grid gap-4">
                  {mode === 'register' && (
                    <label className="block">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Full Name</div>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter your name"
                          className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] py-3.5 pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--ring-color)]"
                        />
                      </div>
                    </label>
                  )}

                  {mode !== 'recovery' && (
                    <label className="block">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Email</div>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] py-3.5 pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--ring-color)]"
                        />
                      </div>
                    </label>
                  )}

                  <label className="block">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                      {mode === 'recovery' ? 'New Password' : 'Password'}
                    </div>
                    <div className="relative">
                      {mode === 'recovery' ? (
                        <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                      ) : (
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                      )}
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'login' ? 'Enter your password' : mode === 'register' ? 'Create a password' : 'Enter a new password'}
                        className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] py-3.5 pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--ring-color)]"
                      />
                    </div>
                  </label>
                </div>

                {errorMessage && (
                  <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {errorMessage}
                  </div>
                )}

                {statusMessage && (
                  <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {statusMessage}
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {helperText}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] disabled:opacity-60"
                >
                  {mode === 'login' ? <LogIn size={16} /> : mode === 'register' ? <UserPlus size={16} /> : <KeyRound size={16} />}
                  {mode === 'login' ? 'Login to workspace' : mode === 'register' ? 'Register account' : 'Update password'}
                  <ArrowRight size={16} />
                </button>

                {mode === 'login' && (
                  <button
                    onClick={handleForgotPassword}
                    disabled={isSubmitting}
                    className="mt-3 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-60"
                  >
                    Send password reset link
                  </button>
                )}
              </div>

              {mode !== 'recovery' && (
                <div className="mt-6 text-center text-sm text-[var(--text-secondary)]">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}
                    className="font-semibold text-[var(--text-accent)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    {mode === 'login' ? 'Create one' : 'Sign in'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
