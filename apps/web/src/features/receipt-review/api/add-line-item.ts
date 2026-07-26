import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';

import { getSessionQueryOptions } from './get-session';

export const addLineItemDraftInputSchema = z.object({
  name: z.string().min(1, 'Required'),
  quantity: z.int().min(1, 'Must be at least 1'),
  unitPriceCents: z.int().min(0, 'Must be at least 0'),
});

export type AddLineItemDraftInputSchema = z.infer<
  typeof addLineItemDraftInputSchema
>;

export const addLineItem = async ({
  sessionId,
  data,
}: {
  sessionId: string;
  data: AddLineItemDraftInputSchema;
}): Promise<Session> => {
  return api
    .sessions({ sessionId })
    ['line-items'].post(data)
    .then(({ data, error }) => {
      if (error) throw apiError(error.value, 'Failed to add the item');
      return data;
    });
};

type UseAddLineItemOptions = {
  sessionId: string;
  mutationConfig?: MutationConfig<typeof addLineItem>;
};

export const useAddLineItem = ({
  sessionId,
  mutationConfig,
}: UseAddLineItemOptions) => {
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
    mutationFn: addLineItem,
  });
};
