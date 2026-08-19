import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getSessionQueryOptions,
  sessionMutationKey,
} from '@/features/session/api/get-session';
import { applyClaim } from '@/features/session/utils/claim-totals';
import { api, apiError } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';
import { getToken } from '@/utils/device-token';

export const setClaim = async ({
  sessionId,
  lineItemId,
  units,
}: {
  sessionId: string;
  lineItemId: string;
  units: number;
}): Promise<Session> => {
  return api
    .sessions({ sessionId })
    ['line-items']({ lineItemId })
    .claim.put({ units })
    .then(({ data, error }) => {
      if (error) throw apiError(error.value, 'Failed to claim the item');
      return data;
    });
};

type UseSetClaimOptions = {
  sessionId: string;
  mutationConfig?: MutationConfig<typeof setClaim>;
};

export const useSetClaim = ({
  sessionId,
  mutationConfig,
}: UseSetClaimOptions) => {
  const queryClient = useQueryClient();

  const { queryKey } = getSessionQueryOptions(sessionId);
  const mutationKey = sessionMutationKey(sessionId);
  const isLastInFlight = () => queryClient.isMutating({ mutationKey }) === 1;

  const { onMutate, onSuccess, onError, ...restConfig } = mutationConfig || {};

  return useMutation({
    mutationKey,
    scope: { id: `claim-${sessionId}` },
    onMutate: async (variables, ...rest) => {
      await queryClient.cancelQueries({ queryKey });

      const participantId = getToken(sessionId)?.participantId;
      const previous = queryClient.getQueryData(queryKey);
      if (previous && participantId) {
        queryClient.setQueryData(
          queryKey,
          applyClaim(
            previous,
            variables.lineItemId,
            participantId,
            variables.units,
          ),
        );
      }

      onMutate?.(variables, ...rest);
      return { previous };
    },
    onSuccess: (data, ...rest) => {
      if (isLastInFlight()) queryClient.setQueryData(queryKey, data);
      onSuccess?.(data, ...rest);
    },
    onError: (error, variables, onMutateResult, ...rest) => {
      if (isLastInFlight()) {
        if (onMutateResult?.previous)
          queryClient.setQueryData(queryKey, onMutateResult.previous);
        queryClient.invalidateQueries({ queryKey });
      }
      onError?.(error, variables, onMutateResult, ...rest);
    },
    ...restConfig,
    mutationFn: setClaim,
  });
};
