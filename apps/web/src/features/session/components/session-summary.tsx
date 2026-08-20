import { ChevronDownIcon, Share2, Users } from 'lucide-react';

import { Avatar, AvatarFallback } from 'shadcn-ui/avatar';
import { Badge } from 'shadcn-ui/badge';
import { Button } from 'shadcn-ui/button';
import { Card, CardContent } from 'shadcn-ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'shadcn-ui/collapsible';
import { cn } from 'shadcn-ui-utils';

import { Money } from '@/components/ui/money';
import { Wordmark } from '@/components/wordmark';
import { ShareSessionButton } from '@/features/session/components/share-session-button';
import {
  initials,
  myShareCents,
  type ParticipantBreakdown,
  participantBreakdowns,
  sessionOwner,
} from '@/features/session/utils/claim-totals';
import { formatSessionDate } from '@/features/session/utils/format-session-date';
import type { Session } from '@/types/session';
import { getToken } from '@/utils/device-token';

export function SessionSummary({ session }: { session: Session }) {
  const participantId = getToken(session.id)?.participantId ?? null;
  const owner = sessionOwner(session);
  const isOwner = Boolean(participantId) && owner?.id === participantId;
  const breakdowns = participantBreakdowns(session);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-160 flex-col pb-32">
      <SummaryHeader session={session} />
      <main className="flex flex-col gap-8 px-5 pt-6">
        <GrandTotal session={session} />
        <YourShareCard
          session={session}
          participantId={participantId}
          owner={owner}
          isOwner={isOwner}
        />
        <section>
          <h2 className="flex items-center gap-2 item-name">
            <Users size={18} className="text-content-secondary" />
            Breakdown
          </h2>
          <ul className="mt-4 overflow-hidden rounded-lg border border-border bg-surface shadow-[0_4px_16px_rgba(42,37,48,0.04)]">
            {breakdowns.map((breakdown) => (
              <BreakdownRow
                key={breakdown.participant.id}
                breakdown={breakdown}
                currency={session.currency}
                isMe={breakdown.participant.id === participantId}
              />
            ))}
          </ul>
        </section>
      </main>
      <div className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-surface shadow-[0_-8px_24px_rgba(42,37,48,0.08)]">
        <div className="mx-auto flex min-h-20 w-full max-w-160 items-center px-5 py-4">
          <ShareSessionButton size="xl" className="w-full">
            <Share2 size={20} />
            Share summary
          </ShareSessionButton>
        </div>
      </div>
    </div>
  );
}

function SummaryHeader({ session }: { session: Session }) {
  const date = formatSessionDate(session.date);

  return (
    <header className="sticky top-0 z-40 flex flex-col items-center gap-0.5 border-b border-border bg-background px-5 py-3 text-center">
      <Wordmark className="text-[14px] leading-4" />
      <h1 className="w-full truncate screen-title">
        {session.merchant ?? 'Receipt'}
      </h1>
      {date && <p className="unit-meta text-content-secondary">{date}</p>}
    </header>
  );
}

function GrandTotal({ session }: { session: Session }) {
  return (
    <section className="flex flex-col items-center gap-3 text-center">
      <p className="eyebrow text-content-secondary">Grand total</p>
      <Money
        cents={session.totalCents}
        currency={session.currency}
        className="hero-title tabular-nums"
      />
    </section>
  );
}

type YourShareCardProps = {
  session: Session;
  participantId: string | null;
  owner: ReturnType<typeof sessionOwner>;
  isOwner: boolean;
};

function YourShareCard({
  session,
  participantId,
  owner,
  isOwner,
}: YourShareCardProps) {
  const mineCents = myShareCents(session, participantId);
  const collectCents = session.totalCents - mineCents;
  const me = session.participants.find((p) => p.id === participantId);

  return (
    <Card className="rounded-2xl border-l-4 border-l-primary shadow-soft ring-0">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-content-secondary">Your share</p>
          {isOwner ? (
            <>
              <p className="screen-title">
                Your share{' '}
                <Money
                  cents={mineCents}
                  currency={session.currency}
                  className="text-primary tabular-nums"
                />
              </p>
              <p className="unit-meta text-content-secondary">
                {collectCents === 0 ? (
                  'Nobody claimed any items.'
                ) : (
                  <>
                    You collect{' '}
                    <Money
                      cents={collectCents}
                      currency={session.currency}
                      className="text-gold-deep"
                    />{' '}
                    from the group.
                  </>
                )}
              </p>
            </>
          ) : mineCents === 0 ? (
            <>
              <p className="screen-title">Nothing to pay</p>
              <p className="unit-meta text-content-secondary">
                You didn't claim any items.
              </p>
            </>
          ) : (
            <>
              <p className="screen-title">
                You owe{' '}
                <Money
                  cents={mineCents}
                  currency={session.currency}
                  className="text-primary tabular-nums"
                />
              </p>
              <p className="unit-meta text-content-secondary">
                to {owner?.name ?? 'the payer'}.
              </p>
            </>
          )}
        </div>
        <Avatar size="lg" className="shrink-0">
          <AvatarFallback className="border-2 item-name">
            {initials(me?.name ?? null)}
          </AvatarFallback>
        </Avatar>
      </CardContent>
    </Card>
  );
}

type BreakdownRowProps = {
  breakdown: ParticipantBreakdown;
  currency: string;
  isMe: boolean;
};

function BreakdownRow({ breakdown, currency, isMe }: BreakdownRowProps) {
  const { participant, totalCents, lines } = breakdown;
  const expandable = lines.length > 0;

  return (
    <Collapsible
      render={<li className={cn('border-b border-border last:border-b-0')} />}
    >
      <CollapsibleTrigger
        disabled={!expandable}
        render={
          <Button
            variant="ghost"
            className="h-auto w-full gap-3 rounded-none px-4 py-4 aria-disabled:hover:bg-transparent"
          >
            <Avatar className={cn('shrink-0', !isMe && 'grayscale')}>
              <AvatarFallback className="border-2">
                {initials(participant.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate item-name">
                {participant.name ?? 'Guest'}
                {isMe && ' (You)'}
              </span>
              {participant.isOwner && <Badge variant="neutral">Owner</Badge>}
            </span>
            <Money
              cents={totalCents}
              currency={currency}
              className="price-total"
            />
            {expandable && (
              <ChevronDownIcon className="ml-auto text-content-secondary transition-transform group-data-panel-open/button:rotate-180" />
            )}
          </Button>
        }
      />
      {expandable && (
        <CollapsibleContent>
          <ul className="flex flex-col gap-2 px-4 py-3">
            {lines.map((line) => (
              <li
                key={line.lineItemId}
                className="flex items-center justify-between gap-3 unit-meta text-content-secondary"
              >
                <span className="wrap-anywhere">
                  {line.units}x {line.name}
                </span>
                <Money
                  cents={line.totalCents}
                  currency={currency}
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
