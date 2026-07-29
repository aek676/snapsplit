import { createFileRoute } from '@tanstack/react-router';

import { Alert, AlertDescription } from 'shadcn-ui/alert';
import { Button } from 'shadcn-ui/button';
import { Spinner } from 'shadcn-ui/spinner';
import { useSession } from '@/features/session/api/get-session';
import { ReviewLayout } from '@/features/session/components/session-draft';
import { LineItemList } from '@/features/session/line-item/components/line-item-list';

export const Route = createFileRoute('/sessions/$sessionId/review')({
  component: ReviewPage,
});

function ReviewPage() {
  const { sessionId } = Route.useParams();
  const sessionQuery = useSession({ sessionId });

  if (sessionQuery.isPending) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-160 items-center justify-center">
        <Spinner className="size-12" />
      </main>
    );
  }

  if (sessionQuery.isError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-160 flex-col items-center justify-center gap-4 px-5 text-center">
        <Alert variant="destructive">
          <AlertDescription>{sessionQuery.error.message}</AlertDescription>
        </Alert>
        <Button variant="secondary" onClick={() => sessionQuery.refetch()}>
          Try again
        </Button>
      </main>
    );
  }

  const session = sessionQuery.data;

  return (
    <ReviewLayout session={session}>
      <LineItemList session={session} />
    </ReviewLayout>
  );
}
