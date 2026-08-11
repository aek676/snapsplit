import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import { clearToken } from '@/utils/device-token';
import { getSessionQueryOptions } from './get-session';

export const deleteSession = async ({
  sessionId,
}: {
  sessionId: string;
}): Promise<void> => {
  return api
    .sessions({ sessionId })
    .delete()
    .then(({ error }) => {
      if (error) throw apiError(error.value, 'Failed to discard the session');
    });
};

type UseDeleteSessionOptions = {
  sessionId: string;
  mutationConfig?: MutationConfig<typeof deleteSession>;
};

export const useDeleteSession = ({
  sessionId,
  mutationConfig,
}: UseDeleteSessionOptions) => {
  const queryClient = useQueryClient();

  const { onSettled, ...restConfig } = mutationConfig || {};

  return useMutation({
    onSettled: (...args) => {
      clearToken(sessionId);
      queryClient.removeQueries({
        queryKey: getSessionQueryOptions(sessionId).queryKey,
      });
      onSettled?.(...args);
    },
    ...restConfig,
    mutationFn: deleteSession,
  });
};
