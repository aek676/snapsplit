import { Elysia, status, t } from 'elysia';
import { AuthModel } from '../modules/auth/model';
import { hashToken } from '../modules/auth/service';
import { Session } from '../schemas';

function bearerFrom(authorization?: string) {
  const [scheme, token] = authorization?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

const DEVICE_TOKEN_PROJECTION = '+participants.deviceTokenHash';

export function findSessionByDeviceTokenHash(deviceTokenHash: string) {
  return Session.findOne({
    'participants.deviceTokenHash': deviceTokenHash,
  }).select(DEVICE_TOKEN_PROJECTION);
}

export const authPlugin = new Elysia({ name: 'auth' })
  .macro('auth', {
    params: t.Object({ sessionId: t.String() }),
    async resolve({ headers, params }) {
      const token = bearerFrom(headers.authorization);
      if (!token) return status(401, AuthModel.unauthorized.const);

      const deviceTokenHash = hashToken(token);
      const session = await findSessionByDeviceTokenHash(deviceTokenHash);
      if (!session) return status(401, AuthModel.unauthorized.const);

      if (params.sessionId !== String(session._id))
        return status(403, AuthModel.forbidden.const);

      const participant = session.participants.find(
        (candidate) => candidate.deviceTokenHash === deviceTokenHash,
      );
      if (!participant) return status(401, AuthModel.unauthorized.const);

      return { session, participant };
    },
  })
  .macro('owner', {
    auth: true,
    beforeHandle({ participant }) {
      if (participant.isOwner) return;
      return status(403, AuthModel.forbidden.const);
    },
  });
