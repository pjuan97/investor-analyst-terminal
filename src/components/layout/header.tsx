'use client';

import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';

interface HeaderProps {
  email: string;
}

export function Header({ email }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-14 bg-terminal-card border-b border-terminal-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm text-terminal-muted">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-terminal-muted">{email}</span>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="text-sm text-terminal-muted hover:text-terminal-text transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
