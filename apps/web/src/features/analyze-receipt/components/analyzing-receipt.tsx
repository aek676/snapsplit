import { Spinner } from 'shadcn-ui/spinner';

interface AnalyzingReceiptProps {
  imageUrl: string;
}

export function AnalyzingReceipt({ imageUrl }: AnalyzingReceiptProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[640px] flex-col">
      <header className="sticky top-0 z-50 bg-background/80 px-5 py-4 backdrop-blur-md">
        <h1 className="screen-title text-primary-pressed">
          Reading your receipt
        </h1>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8">
        <div className="relative aspect-3/4 w-full max-w-[320px] overflow-hidden rounded-lg border border-border bg-surface shadow-(--shadow-soft)">
          <img
            src={imageUrl}
            alt="Your receipt"
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-content-primary/10 p-4 backdrop-blur-[2px]">
            <Spinner className="size-16 text-primary" />
            <p className="mt-4 text-center item-name">Analyzing…</p>
          </div>
        </div>
      </main>
    </div>
  );
}
