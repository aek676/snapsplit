import { isSessionCode } from '@repo/shared-types';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Alert, AlertDescription } from 'shadcn-ui/alert';
import { Button } from 'shadcn-ui/button';
import { Card, CardContent } from 'shadcn-ui/card';
import { Spinner } from 'shadcn-ui/spinner';

import { HeroIllustration } from '@/components/hero-illustration';
import { useSession } from '@/features/session/api/get-session';
import {
    JoinHeading,
    JoinScreen,
} from '@/features/session/components/join-screen';
import { JoinSessionForm } from '@/features/session/components/join-session';
import { LiveSession } from '@/features/session/components/live-session';
import { needsName } from '@/features/session/utils/needs-name';
import { getToken, sessionIdForCode } from '@/utils/device-token';

export const Route = createFileRoute('/s/$code')({
  component: GuestJoinPage,
});

function GuestJoinPage() {
  const { code } = Route.useParams();
  const [joinedId, setJoinedId] = useState<string | null>(() => {
    const rememberedId = sessionIdForCode(code);
    return rememberedId && getToken(rememberedId) ? rememberedId : null;
  });

  const sessionQuery = useSession({
    sessionId: joinedId ?? '',
    queryConfig: { enabled: Boolean(joinedId) },
  });

  if (!isSessionCode(code)) {
    return (
      <JoinScreen>
        <JoinHeading
          title="This link looks broken"
          subtitle="Ask whoever paid to share the link again."
        />
      </JoinScreen>
    );
  }

  if (joinedId && sessionQuery.isPending) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-160 items-center justify-center">
        <Spinner className="size-12" />
      </main>
    );
  }

  if (joinedId && sessionQuery.isError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-160 flex-col items-center justify-center gap-4 px-5 text-center">
        <Alert variant="destructive">
          <AlertDescription>Couldn't load this session</AlertDescription>
        </Alert>
        <Button variant="secondary" onClick={() => sessionQuery.refetch()}>
          Try again
        </Button>
      </main>
    );
  }

  const session = joinedId ? sessionQuery.data : undefined;

  if (session?.status === 'draft') {
    return (
      <Navigate
        to="/sessions/$sessionId/review"
        params={{ sessionId: session.id }}
        replace
      />
    );
  }

  if (!session || needsName(session)) {
    return (
      <JoinScreen>
        <Card className="w-full rounded-2xl shadow-soft ring-0">
          <CardContent>
            <HeroIllustration className="rounded-xl" />
          </CardContent>
        </Card>
        <JoinHeading
          title="Join the session"
          subtitle="Enter your name to start claiming items."
        />
        <JoinSessionForm
          code={code}
          onJoined={(joined) => setJoinedId(joined.id)}
        />
      </JoinScreen>
    );
  }

  return <LiveSession session={session} />;
}
