import { isSessionCode } from '@repo/shared-types';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { HeroIllustration } from '@/components/hero-illustration';
import { Money } from '@/components/ui/money';
import { Wordmark } from '@/components/wordmark';
import { JoinSessionForm } from '@/features/session/components/join-session';
import type { Session } from '@/types/session';

export const Route = createFileRoute('/s/$code')({
  component: GuestJoinPage,
});

function GuestJoinPage() {
  const { code } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);

  if (!isSessionCode(code)) {
    return (
      <JoinScreen>
        <Heading
          title="This link looks broken"
          subtitle="Ask whoever paid to share the link again."
        />
      </JoinScreen>
    );
  }

  if (session) {
    return (
      <JoinScreen>
        <Heading
          title="You're in"
          subtitle="Picking what you had is coming soon."
        />
        <SessionSummary session={session} />
      </JoinScreen>
    );
  }

  return (
    <JoinScreen>
      <div className="surface-card">
        <HeroIllustration className="rounded-xl" />
      </div>
      <Heading
        title="Join the session"
        subtitle="Enter your name to start claiming items."
      />
      <JoinSessionForm code={code} onJoined={setSession} />
    </JoinScreen>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2 text-center">
      <h1 className="screen-title">{title}</h1>
      <p className="body-text text-content-secondary">{subtitle}</p>
    </div>
  );
}

function SessionSummary({ session }: { session: Session }) {
  return (
    <div className="surface-card text-center">
      <p className="eyebrow text-content-secondary">
        {session.merchant ?? 'Receipt'}
      </p>
      <Money
        cents={session.totalCents}
        currency={session.currency}
        className="price-total"
      />
      <p className="unit-meta text-content-tertiary">
        {session.lineItems.length === 1
          ? '1 item'
          : `${session.lineItems.length} items`}
      </p>
    </div>
  );
}

function JoinScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-center bg-background px-5 py-3">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-160 flex-1 flex-col items-center justify-center px-5 py-8">
        <div className="stagger-children flex w-full max-w-sm flex-col gap-8">
          {children}
        </div>
      </main>
    </div>
  );
}
