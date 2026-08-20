import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';
import { getSessionQueryOptions, sessionMutationKey } from './get-session';

export const closeSession = async ({
  sessionId,
}: {
  sessionId: string;
}): Promise<Session> => {
  return api
    .sessions({ sessionId })
    .close.post()
    .then(({ data, error }) => {
      if (error) throw apiError(error.value, 'Failed to close the session');
      return data;
    });
};

type UseCloseSessionOptions = {
  sessionId: string;
  mutationConfig?: MutationConfig<typeof closeSession>;
};

export const useCloseSession = ({
  sessionId,
  mutationConfig,
}: UseCloseSessionOptions) => {
  const queryClient = useQueryClient();

  const { onSuccess, onError, ...restConfig } = mutationConfig || {};

  return useMutation({
    mutationKey: sessionMutationKey(sessionId),
    onSuccess: (session, ...args) => {
      queryClient.setQueryData(
        getSessionQueryOptions(sessionId).queryKey,
        session,
      );
      onSuccess?.(session, ...args);
    },
    onError: (error, ...args) => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions(sessionId).queryKey,
      });
      onError?.(error, ...args);
    },
    ...restConfig,
    mutationFn: closeSession,
  });
};
