import { queryOptions, useQuery } from '@tanstack/react-query';

import { api, apiError } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';
import type { Session } from '@/types/session';

export const getSession = ({
  sessionId,
}: {
  sessionId: string;
}): Promise<Session> => {
  return api
    .sessions({ sessionId })
    .get()
    .then(({ data, error }) => {
      if (error) throw apiError(error.value, 'Failed to load the session');
      return data;
    });
};

export const getSessionQueryOptions = (sessionId: string) => {
  return queryOptions({
    queryKey: ['session', sessionId],
    queryFn: () => getSession({ sessionId }),
  });
};

type UseSessionOptions = {
  sessionId: string;
  queryConfig?: QueryConfig<typeof getSessionQueryOptions>;
};

export const useSession = ({ sessionId, queryConfig }: UseSessionOptions) => {
  return useQuery({
    ...getSessionQueryOptions(sessionId),
    ...queryConfig,
  });
};
