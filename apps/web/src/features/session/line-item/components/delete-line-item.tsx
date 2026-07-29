import { Trash2 } from 'lucide-react';
import { useState } from 'react';

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
import { useDeleteLineItem } from '@/features/session/line-item/api/delete-line-item';
import type { LineItem } from '@/types/session';

interface DeleteLineItemProps {
  sessionId: string;
  lineItem: LineItem;
}

export function DeleteLineItem({ sessionId, lineItem }: DeleteLineItemProps) {
  const [open, setOpen] = useState(false);
  const deleteLineItem = useDeleteLineItem({ sessionId });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        aria-label={`Delete ${lineItem.name}`}
        render={
          <Button variant="destructive" size="icon-lg">
            <Trash2 />
          </Button>
        }
      ></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item?</AlertDialogTitle>
          <AlertDialogDescription>
            "{lineItem.name}" will be permanently removed from this receipt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" size="xl">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            size="xl"
            disabled={deleteLineItem.isPending}
            onClick={() =>
              deleteLineItem.mutate(
                { sessionId, lineItemId: lineItem.id },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
