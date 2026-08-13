import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';
import { getSessionQueryOptions } from './get-session';

export const joinSessionInputSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(50),
});

export type JoinSessionInput = z.infer<typeof joinSessionInputSchema>;

export const joinSession = async ({
  code,
  data,
}: {
  code: string;
  data: JoinSessionInput;
}): Promise<Session> => {
  return api.sessions
    .join({ code })
    .post(data)
    .then(({ data: joined, error }) => {
      if (error) throw apiError(error.value, 'Failed to join the session');
      const { auth, ...session } = joined;
      return session;
    });
};

type UseJoinSessionOptions = {
  mutationConfig?: MutationConfig<typeof joinSession>;
};

export const useJoinSession = ({
  mutationConfig,
}: UseJoinSessionOptions = {}) => {
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
    mutationFn: joinSession,
  });
};
