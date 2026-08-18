import type { Session } from '@/types/session';
import { getToken } from '@/utils/device-token';

export function needsName(session: Session) {
  const participantId = getToken(session.id)?.participantId;
  const me = session.participants.find(
    (participant) => participant.id === participantId,
  );
  return session.status === 'open' && me !== undefined && !me.name;
}