import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Camera } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'shadcn-ui/alert-dialog';
import { Button } from 'shadcn-ui/button';
import { useDeleteSession } from '@/features/session/api/delete-session';
import { useUpdateSession } from '@/features/session/api/update-session';
import { ConfirmSessionButton } from '@/features/session/components/confirm-session-button';
import { EditReceiptTotal } from '@/features/session/components/edit-receipt-total';
import { formatSessionDate } from '@/features/session/utils/format-session-date';
import { receiptTotals } from '@/features/session/utils/receipt-totals';
import type { Session } from '@/types/session';
import { formatCents, formatCentsBare } from '@/utils/money';

type ReviewLayoutProps = {
  session: Session;
  children?: React.ReactNode;
};

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
  const updateSession = useUpdateSession({ sessionId: session.id });

  return (
    <div className="flex flex-col gap-2 border-t border-border px-2 pt-4">
      <div className="flex items-center justify-between">
        <span className="screen-title">Total</span>
        <div className="flex items-center gap-1">
          <span className="screen-title tabular-nums">
            {!totals.matches && (
              <>
                <span className="text-warning">
                  {formatCentsBare(totals.itemsTotalCents, session.currency)}
                </span>
                {' / '}
              </>
            )}
            {formatCents(session.totalCents, session.currency)}
          </span>
          <EditReceiptTotal session={session} />
        </div>
      </div>
      {session.totalSource === 'items' && (
        <span className="unit-meta text-content-secondary">
          Kept in sync with the items
        </span>
      )}
      {!totals.matches && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle size={16} />
            <span className="unit-meta">
              {formatCents(Math.abs(totals.discrepancyCents), session.currency)}{' '}
              {totals.discrepancyCents > 0 ? 'over' : 'under'} the receipt total
            </span>
          </div>
          {session.lineItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={updateSession.isPending}
              onClick={() =>
                updateSession.mutate({
                  sessionId: session.id,
                  data: { totalSource: 'items' },
                })
              }
            >
              Use the items total from now on
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function RetakePhotoButton({ session }: { session: Session }) {
  const navigate = useNavigate();
  const deleteSession = useDeleteSession({ sessionId: session.id });

  return (
    <AlertDialog>
      <AlertDialogTrigger
        aria-label="Retake photo"
        render={
          <Button variant="secondary" size="xl" className="w-11 flex-none px-0">
            <Camera size={20} />
          </Button>
        }
      ></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retake photo?</AlertDialogTitle>
          <AlertDialogDescription>
            This receipt and its items will be discarded so you can take a new
            photo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            variant="ghost"
            size="xl"
            disabled={deleteSession.isPending}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            size="xl"
            disabled={deleteSession.isPending}
            onClick={() =>
              deleteSession.mutate(
                { sessionId: session.id },
                { onSettled: () => navigate({ to: '/' }) },
              )
            }
          >
            Retake
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReviewFooter({ session }: { session: Session }) {
  return (
    <div className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-surface shadow-[0_-8px_24px_rgba(42,37,48,0.08)]">
      <div className="mx-auto flex min-h-20 w-full max-w-160 items-center gap-3 px-5 py-4">
        <RetakePhotoButton session={session} />
        <ConfirmSessionButton session={session} />
      </div>
    </div>
  );
}
