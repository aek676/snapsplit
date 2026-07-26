import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import {
  analyzeReceiptSchema,
  useAnalyzeReceipt,
} from '@/features/analyze-receipt/api/analyze-receipt';

import { AnalyzingReceipt } from './analyzing-receipt';
import { ReceiptCapture } from './receipt-capture';

export function AnalyzeReceipt() {
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
    return <AnalyzingReceipt imageUrl={previewUrl} />;
  }

  return (
    <ReceiptCapture
      onCapture={handleCapture}
      errorMessage={
        validationError ?? (analyze.isError ? analyze.error.message : null)
      }
    />
  );
}
