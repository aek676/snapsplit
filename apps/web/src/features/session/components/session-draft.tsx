import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Link as LinkIcon,
} from 'lucide-react';
import { Button, buttonVariants } from 'shadcn-ui/button';
import { cn } from 'shadcn-ui-utils/cn';
import { LOW_CONFIDENCE_THRESHOLD } from '@/features/session/line-item/components/line-item-row';
import { receiptTotals } from '@/features/session/utils/receipt-totals';
import type { Session } from '@/types/session';
import { formatCents } from '@/utils/money';

interface ReviewLayoutProps {
  session: Session;
  children?: React.ReactNode;
}

export function ReviewLayout({ session, children }: ReviewLayoutProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-160 flex-col pb-32">
      <ReviewHeader session={session} />
      <main className="flex flex-col gap-8 px-5 pt-6">
        {children}
        <ReceiptSummary session={session} />
      </main>
      <ReviewFooter session={session} />
    </div>
  );
}

function ReviewHeader({ session }: { session: Session }) {
  const subtitle = [session.merchant, formatSessionDate(session.date)]
    .filter(Boolean)
    .join(' · ');

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background px-5">
      <Link
        to="/"
        aria-label="Back to home"
        className="flex h-11 w-11 items-center justify-center rounded-full text-content-secondary transition-colors hover:bg-primary-tint"
      >
        <ChevronLeft size={24} />
      </Link>
      <div>
        <h1 className="screen-title">Review receipt</h1>
        {subtitle && (
          <p className="unit-meta text-content-secondary">{subtitle}</p>
        )}
      </div>
    </header>
  );
}

function ReceiptSummary({ session }: { session: Session }) {
  const totals = receiptTotals(session);

  return (
    <div className="flex flex-col gap-2 px-2">
      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="screen-title">Total</span>
        <span className="screen-title tabular-nums">
          {formatCents(session.totalCents, session.currency)}
        </span>
      </div>
      {totals.matches ? (
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 size={16} />
          <span className="unit-meta">Items sum to total</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle size={16} />
          <span className="unit-meta">
            Items add up to{' '}
            {formatCents(totals.itemsTotalCents, session.currency)},{' '}
            {formatCents(Math.abs(totals.discrepancyCents), session.currency)}{' '}
            {totals.discrepancyCents > 0 ? 'over' : 'under'} the receipt total
          </span>
        </div>
      )}
    </div>
  );
}

function ConfirmButton({ session }: { session: Session }) {
  const totals = receiptTotals(session);
  const hasItems = session.lineItems.length > 0;
  const hasLowConfidence = session.lineItems.some(
    (item) => item.aiConfidence < LOW_CONFIDENCE_THRESHOLD,
  );

  const canConfirm = totals.matches && hasItems && !hasLowConfidence;

  const form = useForm({
    defaultValues: {},
    onSubmit: async () => {
      // TODO: Implement backend endpoint and mutation
      console.log('Confirm session:', session.id);
    },
  });

  return (
    <form.Field name="confirm">
      {() => (
        <Button
          size="xl"
          className="flex-1"
          disabled={!canConfirm}
          onClick={() => form.handleSubmit()}
        >
          Confirm & create link
          <LinkIcon size={20} />
        </Button>
      )}
    </form.Field>
  );
}

function ReviewFooter({ session }: { session: Session }) {
  return (
    <div className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-surface shadow-[0_-8px_24px_rgba(42,37,48,0.08)]">
      <div className="mx-auto flex min-h-20 w-full max-w-160 items-center gap-3 px-5 py-4">
        <Link
          to="/"
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'xl' }),
            'w-[40%] flex-none',
          )}
        >
          <Camera size={20} />
          Retake photo
        </Link>
        <ConfirmButton session={session} />
      </div>
    </div>
  );
}

function formatSessionDate(date: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}
