import { SUPPORTED_IMAGE_MIME_TYPES } from '@repo/api/constants';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session as AnalyzeReceipt } from '@/types/session';
import { getSessionQueryOptions } from './get-session';

export const analyzeReceiptSchema = z.object({
  image: z
    .file()
    .refine(
      (file) =>
        (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type),
      'Only JPEG, PNG, WebP, and GIF images are supported',
    )
    .max(10_000_000)
    .min(1, 'Required'),
});

export type analyzeReceiptInput = z.infer<typeof analyzeReceiptSchema>;

export const analyzeReceipt = async ({
  image,
}: analyzeReceiptInput): Promise<AnalyzeReceipt> => {
  return api.sessions.analyze.post({ image }).then(({ data, error }) => {
    if (error) throw apiError(error.value, 'Receipt analysis failed');
    const { auth, ...session } = data;
    return session;
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
