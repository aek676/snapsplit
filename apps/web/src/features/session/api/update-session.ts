import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';
import { getSessionQueryOptions } from './get-session';

export const receiptTotalInputSchema = z.object({
  totalCents: z.int().min(0, 'Must be at least 0'),
});

export const updateSessionInputSchema = z.union([
  receiptTotalInputSchema,
  z.object({ totalSource: z.literal('items') }),
]);

export type UpdateSessionInput = z.infer<typeof updateSessionInputSchema>;

export const updateSession = async ({
  sessionId,
  data,
}: {
  sessionId: string;
  data: UpdateSessionInput;
}): Promise<Session> => {
  return api
    .sessions({ sessionId })
    .patch(data)
    .then(({ data, error }) => {
      if (error)
        throw apiError(error.value, 'Failed to update the receipt total');
      return data;
    });
};

type UseUpdateSessionOptions = {
  sessionId: string;
  mutationConfig?: MutationConfig<typeof updateSession>;
};

export const useUpdateSession = ({
  sessionId,
  mutationConfig,
}: UseUpdateSessionOptions) => {
  const queryClient = useQueryClient();

  const { onSuccess, ...restConfig } = mutationConfig || {};

  return useMutation({
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions(sessionId).queryKey,
      });
      onSuccess?.(...args);
    },
    ...restConfig,
    mutationFn: updateSession,
  });
};
