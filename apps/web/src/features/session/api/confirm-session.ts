import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';
import { getSessionQueryOptions } from './get-session';

export const confirmSession = async ({
  sessionId,
}: {
  sessionId: string;
}): Promise<Session> => {
  return api
    .sessions({ sessionId })
    .confirm.post()
    .then(({ data, error }) => {
      if (error) throw apiError(error.value, 'Failed to confirm the session');
      return data;
    });
};

type UseConfirmSessionOptions = {
  sessionId: string;
  mutationConfig?: MutationConfig<typeof confirmSession>;
};

export const useConfirmSession = ({
  sessionId,
  mutationConfig,
}: UseConfirmSessionOptions) => {
  const queryClient = useQueryClient();

  const { onSuccess, onError, ...restConfig } = mutationConfig || {};

  return useMutation({
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
    mutationFn: confirmSession,
  });
};
