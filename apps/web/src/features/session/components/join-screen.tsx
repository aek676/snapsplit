import { Wordmark } from '@/components/wordmark';

export function JoinScreen({ children }: { children: React.ReactNode }) {
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

export function JoinHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2 text-center">
      <h1 className="screen-title">{title}</h1>
      <p className="body-text text-content-secondary">{subtitle}</p>
    </div>
  );
}
