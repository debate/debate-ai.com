'use client';

/**
 * Research settings → Account: the QwkSearch account linked to this debate-ai
 * account through "Sign in with QwkSearch" (see ../../connect-auth.ts).
 *
 * The embedded research workspace runs as this QwkSearch account — its chats,
 * history and plan — once linked. Upgrading is QwkSearch's: the button opens
 * the plan's Stripe link tied to the QwkSearch account, and coming back to
 * this tab re-reads the plan.
 *
 * This replaces the account page ported from qwksearch.com (profile, password,
 * sessions, linked providers, API key), which called qwksearch's same-origin
 * `/api/user*` routes — routes debate-ai.com doesn't serve — and was only ever
 * reachable as its "sign in" prompt while the embed was guest-only.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Loader2, LogOut, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  connectQwkSearch,
  disconnectQwkSearch,
  loadQwkSearchSession,
  useQwkSearchSession,
} from '../../connect-auth';
import { QWKSEARCH_ORIGIN } from '../../base-url';

const SectionCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section className={cn('rounded-xl border border-light-200 bg-secondary/50 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80', className)}>
    {children}
  </section>
);

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-4">
    <h4 className="text-sm text-black dark:text-white font-medium">{title}</h4>
    {subtitle && <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">{subtitle}</p>}
  </div>
);

const primaryButton =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#24A0ED] text-white text-sm hover:bg-[#1a8fd1] transition-colors disabled:opacity-60';
const secondaryButton =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-light-200 dark:border-dark-200 text-sm text-black/70 dark:text-white/70 hover:bg-light-200/60 dark:hover:bg-dark-200/60 transition-colors disabled:opacity-60';

const planLabel = (plan?: string | null) => (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Free');

export default function Account() {
  const { session, isPending } = useQwkSearchSession();
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Coming back from an upgrade on QwkSearch: re-read the plan.
  useEffect(() => {
    const onFocus = () => {
      if (session.connected) void loadQwkSearchSession(true);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [session.connected]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await loadQwkSearchSession(true);
      if (!next.connected) toast.info('Your QwkSearch account was unlinked — its API key changed. Sign in again.');
    } finally {
      setRefreshing(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectQwkSearch();
      toast.success('QwkSearch account unlinked.');
    } catch {
      toast.error('Failed to unlink the QwkSearch account.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-black/40 dark:text-white/40" />
      </div>
    );
  }

  if (!session.connected || !session.user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 px-6 text-center">
        <p className="text-black/70 dark:text-white/70 text-sm max-w-sm">
          Sign in with your QwkSearch account to save research chats, use your QwkSearch plan&apos;s
          models, and pick up where you left off on qwksearch.com.
        </p>
        <button onClick={() => connectQwkSearch()} className={primaryButton}>
          Sign in with QwkSearch
        </button>
        <p className="text-[11px] text-black/40 dark:text-white/40">
          You&apos;ll approve the link on {new URL(QWKSEARCH_ORIGIN).host} — and can create a QwkSearch account there if you don&apos;t have one.
        </p>
      </div>
    );
  }

  const { user, plan, upgradeUrl } = session;
  const isFree = !plan || plan === 'free';

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
      <SectionCard>
        <SectionTitle title="QwkSearch account" subtitle="Research chats here run as this QwkSearch account." />
        <div className="flex items-center gap-3">
          {user.image ? (
            <img src={user.image} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-light-200 dark:bg-dark-200 flex items-center justify-center text-lg font-medium text-black/50 dark:text-white/50">
              {user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm text-black dark:text-white">{user.name || user.email}</div>
            {user.email && <div className="truncate text-xs text-black/50 dark:text-white/50">{user.email}</div>}
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionTitle
          title="Plan"
          subtitle={isFree ? 'You are on the free QwkSearch plan.' : `QwkSearch ${planLabel(plan)}`}
        />
        <div className="flex flex-wrap gap-2">
          {isFree && upgradeUrl && (
            <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" className={primaryButton}>
              <Sparkles className="w-4 h-4" />
              Upgrade QwkSearch
            </a>
          )}
          <button onClick={refresh} disabled={refreshing} className={secondaryButton}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh plan
          </button>
          <a href={`${QWKSEARCH_ORIGIN}/settings`} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
            <ExternalLink className="w-4 h-4" />
            Manage on QwkSearch
          </a>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionTitle
          title="Unlink"
          subtitle="Research goes back to guest mode here. Your QwkSearch account and its chats are not affected."
        />
        <button onClick={disconnect} disabled={disconnecting} className={secondaryButton}>
          {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Sign out of QwkSearch
        </button>
      </SectionCard>
    </div>
  );
}
