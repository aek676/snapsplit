import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getSessionQueryOptions } from '@/features/receipt-review/api/get-session';
import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session as AnalyzeReceipt } from '@/types/session';

export const analyzeReceiptSchema = z.object({
  image: z.file().mime('image/*').max(10_000_000).min(1, 'Required'),
});

export type analyzeReceiptInput = z.infer<typeof analyzeReceiptSchema>;

export const analyzeReceipt = async ({
  image,
}: analyzeReceiptInput): Promise<AnalyzeReceipt> => {
  return api.sessions.analyze.post({ image }).then(({ data, error }) => {
    if (error) throw apiError(error.value, 'Receipt analysis failed');
    return data;
  });
};

type UseAnalyzeReceiptOptions = {
  mutationConfig?: MutationConfig<typeof analyzeReceipt>;
};

export function useAnalyzeReceipt({
  mutationConfig,
}: UseAnalyzeReceiptOptions = {}) {
  const queryClient = useQueryClient();

  const { onSuccess, ...restConfig } = mutationConfig || {};

  return useMutation({
    onSuccess: (session, ...args) => {
      queryClient.setQueryData(
        getSessionQueryOptions(session.id).queryKey,
        session,
      );
      onSuccess?.(session, ...args);
    },
    ...restConfig,
    mutationFn: analyzeReceipt,
  });
}
