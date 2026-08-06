import { useNavigate } from '@tanstack/react-router';
import { Camera, Users, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from 'shadcn-ui/alert';
import { Button } from 'shadcn-ui/button';
import { Card, CardContent } from 'shadcn-ui/card';
import { Spinner } from 'shadcn-ui/spinner';
import heroIllustration from '@/assets/hero-illustration.jpg';
import { Wordmark } from '@/components/wordmark';
import {
  analyzeReceiptSchema,
  useAnalyzeReceipt,
} from '@/features/session/api/analyze-receipt';

export function ReceiptCapture() {
  const navigate = useNavigate();
  const analyze = useAnalyzeReceipt({
    mutationConfig: {
      onSuccess: (session) => {
        navigate({
          to: '/sessions/$sessionId/review',
          params: { sessionId: session.id },
        });
      },
    },
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const handleCapture = (image: File) => {
    setValidationError(null);
    const result = analyzeReceiptSchema.safeParse({ image });
    if (!result.success) {
      setValidationError(result.error.issues[0].message);
      return;
    }
    setPreviewUrl(URL.createObjectURL(image));
    analyze.mutate(result.data);
  };

  if (analyze.isPending && previewUrl) {
    return <AnalyzingView imageUrl={previewUrl} />;
  }

  return (
    <CaptureView
      inputRef={inputRef}
      onCapture={handleCapture}
      errorMessage={validationError}
    />
  );
}

function AnalyzingView({ imageUrl }: { imageUrl: string }) {
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

interface CaptureViewProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCapture: (image: File) => void;
  errorMessage: string | null;
}

function CaptureView({ inputRef, onCapture, errorMessage }: CaptureViewProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[640px] flex-col pb-12">
      <header className="sticky top-0 z-50 flex items-center justify-center bg-background px-5 py-3">
        <Wordmark />
      </header>

      <main className="flex flex-1 flex-col px-5 pt-6">
        <section className="mb-8 overflow-hidden rounded-xl bg-surface shadow-(--shadow-soft)">
          <img
            src={heroIllustration}
            alt="Friends around a cafe table sharing a receipt"
            className="h-auto w-full object-cover"
          />
          <div className="flex flex-col gap-4 p-6 text-center sm:text-left">
            <h1 className="hero-title">Split the bill, snap it</h1>
            <p className="body-text text-content-secondary">
              Effortless splitting with friends. Just take a photo and share.
            </p>
          </div>
        </section>

        <div className="flex w-full flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const image = event.target.files?.[0];
              if (image) onCapture(image);
              event.target.value = '';
            }}
          />
          <Button
            className="w-full"
            size="xl"
            onClick={() => inputRef.current?.click()}
          >
            <Camera size={20} />
            Take a photo of the receipt
          </Button>
          <p className="px-8 text-center unit-meta text-content-tertiary">
            No sign-up — just snap and share the link
          </p>
        </div>

        {errorMessage ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-center">
              {errorMessage}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-auto grid grid-cols-2 gap-4 pt-12">
          <Card>
            <CardContent className="flex flex-col gap-1">
              <Zap size={20} className="mb-1 text-primary" />
              <span className="eyebrow text-content-secondary">Speed</span>
              <span className="label-nav">Split in seconds</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1">
              <Users size={20} className="mb-1 text-primary" />
              <span className="eyebrow text-content-secondary">Social</span>
              <span className="label-nav">No app required</span>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
