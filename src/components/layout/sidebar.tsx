'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2"
            />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'STOCKS',
    items: [
      {
        name: 'Watchlist',
        href: '/watchlist',
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        ),
      },
      {
        name: 'Screener',
        href: '/screener',
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 14.414V20a1 1 0 01-.553.894l-4 2A1 1 0 017 22v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
        ),
      },
      {
        name: 'Earnings',
        href: '/earnings',
        icon: (
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'ETFs',
    items: [
      {
        name: 'Watchlist',
        href: '/etf',
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        ),
      },
      {
        name: 'Screener',
        href: '/etf/screener',
        icon: (
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 14.414V20a1 1 0 01-.553.894l-4 2A1 1 0 017 22v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
        ),
      },
      {
        name: 'Overlap',
        href: '/etf/overlap',
        icon: (
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="9" cy="12" r="6" strokeWidth={1.5} />
            <circle cx="15" cy="12" r="6" strokeWidth={1.5} />
          </svg>
        ),
      },
    ],
  },
];

const settingsItem: NavItem = {
  name: 'Settings',
  href: '/settings',
  icon: (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
};

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const linkClasses = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
      isActive(href)
        ? 'bg-terminal-accent/20 text-terminal-accent'
        : 'text-terminal-muted hover:bg-terminal-border hover:text-terminal-text'
    }`;

  return (
    <aside className="w-64 bg-terminal-card border-r border-terminal-border flex flex-col">
      <div className="p-4 border-b border-terminal-border">
        <h1 className="text-lg font-bold text-terminal-text">
          Investor Terminal
        </h1>
        <p className="text-xs text-terminal-muted">Analysis & Recommendations</p>
      </div>

      <nav className="flex-1 p-4">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.label && (
              <p className="px-3 mb-1 text-xs font-semibold text-terminal-muted uppercase tracking-widest">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClasses(item.href)}>
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-auto pt-4">
          <Link href={settingsItem.href} className={linkClasses(settingsItem.href)}>
            {settingsItem.icon}
            <span>{settingsItem.name}</span>
          </Link>
        </div>
      </nav>

      <div className="p-4 border-t border-terminal-border">
        <div className="text-xs text-terminal-muted">
          <p>Data Sources:</p>
          <p className="mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-success-dot mr-1"></span>
            SEC EDGAR
          </p>
          <p>
            <span className="inline-block w-2 h-2 rounded-full bg-success-dot mr-1"></span>
            Stooq Prices
          </p>
        </div>
      </div>
    </aside>
  );
}
