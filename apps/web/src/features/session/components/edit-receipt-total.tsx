import { useForm } from '@tanstack/react-form';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { Button } from 'shadcn-ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from 'shadcn-ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from 'shadcn-ui/field';

import { CurrencyInput } from '@/components/ui/form/currency-input';
import {
  receiptTotalInputSchema,
  useUpdateSession,
} from '@/features/session/api/update-session';
import type { Session } from '@/types/session';

interface EditReceiptTotalProps {
  session: Session;
}

export function EditReceiptTotal({ session }: EditReceiptTotalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Edit receipt total"
        render={
          <Button variant="ghost" size="icon-sm">
            <Pencil />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit receipt total</DialogTitle>
        </DialogHeader>
        <EditReceiptTotalForm
          session={session}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type EditReceiptTotalFormProps = {
  session: Session;
  onSaved: () => void;
};

function EditReceiptTotalForm({ session, onSaved }: EditReceiptTotalFormProps) {
  const updateSession = useUpdateSession({ sessionId: session.id });
  const form = useForm({
    defaultValues: {
      totalCents: session.totalCents,
    },
    validators: {
      onSubmit: receiptTotalInputSchema,
    },
    onSubmit: async ({ value }) => {
      updateSession.mutate(
        { sessionId: session.id, data: value },
        { onSuccess: onSaved },
      );
    },
  });

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="totalCents">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel variant="eyebrow" htmlFor={field.name}>
                  Total
                </FieldLabel>
                <CurrencyInput
                  id={field.name}
                  currency={session.currency}
                  value={field.state.value}
                  onChange={(cents) => field.handleChange(cents)}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" size="xl" />}>
          Cancel
        </DialogClose>
        <form.Subscribe
          selector={(s) => ({
            canSubmit: s.canSubmit,
            isDirty: s.isDirty,
          })}
        >
          {({ canSubmit, isDirty }) => (
            <Button
              type="submit"
              size="xl"
              disabled={!canSubmit || !isDirty || updateSession.isPending}
            >
              Save
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
