import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';

import { getSessionQueryOptions } from './get-session';

export const deleteLineItem = async ({
  sessionId,
  lineItemId,
}: {
  sessionId: string;
  lineItemId: string;
}): Promise<Session> => {
  return api
    .sessions({ sessionId })
    ['line-items']({ lineItemId })
    .delete()
    .then(({ data, error }) => {
      if (error) throw apiError(error.value, 'Failed to delete the item');
      return data;
    });
};

type UseDeleteLineItemOptions = {
  sessionId: string;
  mutationConfig?: MutationConfig<typeof deleteLineItem>;
};

export const useDeleteLineItem = ({
  sessionId,
  mutationConfig,
}: UseDeleteLineItemOptions) => {
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
    mutationFn: deleteLineItem,
  });
};
