import { useForm } from '@tanstack/react-form';
import { Minus, Plus } from 'lucide-react';
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
import { Input } from 'shadcn-ui/input';

import { CurrencyInput } from '@/components/ui/form/currency-input';
import {
  addLineItemDraftInputSchema,
  useAddLineItem,
} from '@/features/session/line-item/api/add-line-item';

interface AddLineItemProps {
  sessionId: string;
  currency: string;
}

export function AddLineItem({ sessionId, currency }: AddLineItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-5 text-primary transition-colors hover:bg-primary-tint/50 active:bg-primary-tint"
          >
            <Plus size={20} />
            <span className="item-name">Add item by hand</span>
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add item</DialogTitle>
        </DialogHeader>
        <AddLineItemForm
          sessionId={sessionId}
          currency={currency}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type AddLineItemFormProps = {
  sessionId: string;
  currency: string;
  onSaved: () => void;
};

function AddLineItemForm({
  sessionId,
  currency,
  onSaved,
}: AddLineItemFormProps) {
  const addLineItem = useAddLineItem({ sessionId });
  const form = useForm({
    defaultValues: {
      name: '',
      unitPriceCents: 0,
      quantity: 1,
    },
    validators: {
      onSubmit: addLineItemDraftInputSchema,
    },
    onSubmit: async ({ value }) => {
      addLineItem.mutate({ sessionId, data: value }, { onSuccess: onSaved });
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
        <form.Field name="name">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel variant="eyebrow" htmlFor={field.name}>
                  Name
                </FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="text"
                  variant="field"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>
        <div className="flex gap-3">
          <form.Field name="unitPriceCents">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field className="flex-1" data-invalid={isInvalid}>
                  <FieldLabel variant="eyebrow" htmlFor={field.name}>
                    Unit price
                  </FieldLabel>
                  <CurrencyInput
                    id={field.name}
                    currency={currency}
                    value={field.state.value}
                    onChange={(cents) => field.handleChange(cents)}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
          <form.Field name="quantity">
            {(field) => (
              <Field className="flex-1">
                <FieldLabel variant="eyebrow">Quantity</FieldLabel>
                <div className="flex items-center justify-between rounded-xl bg-surface-alt px-4 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      field.handleChange(Math.max(1, field.state.value - 1))
                    }
                    className="text-primary"
                  >
                    <Minus size={20} />
                  </Button>
                  <span className="item-name tabular-nums">
                    {field.state.value}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Increase quantity"
                    onClick={() => field.handleChange(field.state.value + 1)}
                    className="text-primary"
                  >
                    <Plus size={20} />
                  </Button>
                </div>
              </Field>
            )}
          </form.Field>
        </div>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" size="xl" />}>
          Cancel
        </DialogClose>
        <form.Subscribe
          selector={(s) => ({
            canSubmit: s.canSubmit,
          })}
        >
          {({ canSubmit }) => (
            <Button
              type="submit"
              size="xl"
              disabled={!canSubmit || addLineItem.isPending}
            >
              Save
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
