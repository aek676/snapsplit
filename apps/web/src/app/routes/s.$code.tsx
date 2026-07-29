import { createFileRoute } from '@tanstack/react-router';
import { Wordmark } from '@/components/wordmark';

export const Route = createFileRoute('/s/$code')({
  component: GuestJoinPage,
});

function GuestJoinPage() {
  const { code } = Route.useParams();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-160 flex-col items-center justify-center gap-3 px-5 text-center">
      <Wordmark />
      <h1 className="screen-title">Join session</h1>
      <p className="body-text text-content-secondary">
        The guest flow for session {code} is coming soon.
      </p>
    </main>
  );
}
