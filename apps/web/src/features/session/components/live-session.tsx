import { Share2 } from 'lucide-react';
import { Button } from 'shadcn-ui/button';
import { Card, CardContent } from 'shadcn-ui/card';
import { toast } from 'shadcn-ui/toast';

import { Money } from '@/components/ui/money';
import { useSessionEvents } from '@/features/session/api/session-events';
import { ClaimLineItemRow } from '@/features/session/claim/components/claim-line-item-row';
import {
  collectedCents,
  myShareCents,
} from '@/features/session/utils/claim-totals';
import type { Session } from '@/types/session';
import { getToken } from '@/utils/device-token';

export function LiveSession({ session }: { session: Session }) {
  const participantId = getToken(session.id)?.participantId ?? null;
  const isOpen = session.status === 'open';
  useSessionEvents(session.id, isOpen);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-160 flex-col pb-32">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-background px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate screen-title">
            {session.merchant ?? 'Receipt'}
          </h1>
        </div>
        {session.code && <ShareSessionButton />}
      </header>
      <main className="flex flex-col gap-4 px-5 pt-6">
        <CollectedCard session={session} />
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[0_4px_16px_rgba(42,37,48,0.04)]">
          <ul>
            {session.lineItems.map((lineItem) => (
              <ClaimLineItemRow
                key={lineItem.id}
                session={session}
                lineItem={lineItem}
                participantId={participantId}
                disabled={!isOpen}
              />
            ))}
          </ul>
        </div>
      </main>
      <div className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-surface shadow-[0_-8px_24px_rgba(42,37,48,0.08)]">
        <div className="mx-auto flex min-h-20 w-full max-w-160 items-center justify-between px-5 py-4">
          <span className="eyebrow text-content-secondary">Your share</span>
          <Money
            cents={myShareCents(session, participantId)}
            currency={session.currency}
            className="hero-title text-gold"
          />
        </div>
      </div>
    </div>
  );
}

function ShareSessionButton() {
  const share = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.add({ type: 'success', title: 'Link copied' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.add({
        type: 'error',
        title: 'Error',
        description: "Couldn't share the link",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Share the session link"
      onClick={share}
    >
      <Share2 />
    </Button>
  );
}

function CollectedCard({ session }: { session: Session }) {
  return (
    <Card className="w-full rounded-2xl shadow-soft ring-0">
      <CardContent>
        <p className="eyebrow text-content-secondary">Collected</p>
        <div className="mt-1 flex items-baseline gap-2">
          <Money
            cents={collectedCents(session)}
            currency={session.currency}
            className="hero-title text-gold"
          />
          <span className="screen-title text-content-tertiary">/</span>
          <Money
            cents={session.totalCents}
            currency={session.currency}
            className="screen-title text-content-secondary"
          />
        </div>
      </CardContent>
    </Card>
  );
}
