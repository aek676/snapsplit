import { Lock } from 'lucide-react';
import { memo, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'shadcn-ui/alert-dialog';
import { Button } from 'shadcn-ui/button';
import { useCloseSession } from '@/features/session/api/close-session';

type CloseSessionButtonProps = {
  sessionId: string;
  unclaimed: number;
};

function CloseSessionButtonImpl({
  sessionId,
  unclaimed,
}: CloseSessionButtonProps) {
  const [open, setOpen] = useState(false);
  const closeSession = useCloseSession({ sessionId });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button size="xl">
            <Lock size={20} />
            Close
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {unclaimed > 0 ? 'Not everything is claimed' : 'Close the session?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {unclaimed > 0
              ? `${unclaimed} ${unclaimed === 1 ? 'unit is' : 'units are'} still unclaimed. Everything must be claimed before you can close.`
              : "This freezes everyone's claims and shows the final summary."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" size="xl">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            size="xl"
            disabled={unclaimed > 0 || closeSession.isPending}
            onClick={() =>
              closeSession.mutate(
                { sessionId },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Close session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const CloseSessionButton = memo(CloseSessionButtonImpl);
