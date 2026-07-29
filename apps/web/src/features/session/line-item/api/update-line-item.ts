import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { api, apiError } from '@/lib/api-client';
import { getSessionQueryOptions } from '@/features/session/api/get-session';
import type { MutationConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';

export const updateLineItemDraftInputSchema = z.object({
  name: z.string().min(1, 'Required'),
  quantity: z.int().min(1, 'Must be at least 1'),
  unitPriceCents: z.int().min(0, 'Must be at least 0'),
});

export type UpdateLineItemDraftInput = z.infer<
  typeof updateLineItemDraftInputSchema
>;

export const updateLineItem = async ({
  sessionId,
  lineItemId,
  data,
}: {
  sessionId: string;
  lineItemId: string;
  data: UpdateLineItemDraftInput;
}): Promise<Session> => {
  return api
    .sessions({ sessionId })
    ['line-items']({ lineItemId })
    .patch(data)
    .then(({ data, error }) => {
      if (error) throw apiError(error.value, 'Failed to update the item');
      return data;
    });
};

type UseUpdateLineItemOptions = {
  sessionId: string;
  mutationConfig?: MutationConfig<typeof updateLineItem>;
};

export const useUpdateLineItem = ({
  sessionId,
  mutationConfig,
}: UseUpdateLineItemOptions) => {
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
    mutationFn: updateLineItem,
  });
};
