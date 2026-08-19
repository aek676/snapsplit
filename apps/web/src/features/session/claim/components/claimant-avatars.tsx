import { Avatar, AvatarBadge, AvatarFallback } from 'shadcn-ui/avatar';
import { cn } from 'shadcn-ui-utils';
import { initials } from '@/features/session/utils/claim-totals';
import type { Claim, Participant } from '@/types/session';

type ClaimantAvatarsProps = {
  claims: Claim[];
  participants: Participant[];
  participantId: string | null;
};

export function ClaimantAvatars({
  claims,
  participants,
  participantId,
}: ClaimantAvatarsProps) {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const mine = claims.filter((claim) => claim.participantId === participantId);
  const others = claims.filter(
    (claim) => claim.participantId !== participantId,
  );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      {[...mine, ...others].map((claim) => {
        const isMe = claim.participantId === participantId;
        const participant = byId.get(claim.participantId);
        return (
          <Avatar key={claim.participantId} className="size-6">
            <AvatarFallback
              className={cn(
                'label-nav border',
                isMe
                  ? 'bg-gold/15 text-gold-deep'
                  : 'bg-primary-tint text-primary',
              )}
            >
              {initials(participant?.name ?? null)}
            </AvatarFallback>
            <AvatarBadge
              className={cn(
                '-top-1.5 -right-1.5 bottom-auto h-3.5! w-auto! min-w-3.5 px-1 text-[10px] leading-none',
                isMe ? 'bg-gold text-white' : 'bg-primary text-white',
              )}
            >
              {claim.units}
            </AvatarBadge>
          </Avatar>
        );
      })}
    </div>
  );
}
