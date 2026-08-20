import { queryOptions, useQuery } from '@tanstack/react-query';

import { api, apiError } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';
import type { SessionAvailability } from '@/types/session';

export const getSessionAvailability = async ({
  code,
}: {
  code: string;
}): Promise<SessionAvailability> => {
  return api.sessions
    .join({ code })
    .get()
    .then(({ data, error }) => {
      if (error) throw apiError(error.value, 'Failed to check the session');
      return data;
    });
};

export const getSessionAvailabilityQueryOptions = (code: string) => {
  return queryOptions({
    queryKey: ['session-availability', code],
    queryFn: () => getSessionAvailability({ code }),
  });
};

type UseSessionAvailabilityOptions = {
  code: string;
  queryConfig?: QueryConfig<typeof getSessionAvailabilityQueryOptions>;
};

export const useSessionAvailability = ({
  code,
  queryConfig,
}: UseSessionAvailabilityOptions) => {
  return useQuery({
    ...getSessionAvailabilityQueryOptions(code),
    ...queryConfig,
  });
};
