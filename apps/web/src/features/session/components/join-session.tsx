import { useForm } from '@tanstack/react-form';
import { Alert, AlertDescription } from 'shadcn-ui/alert';
import { Button } from 'shadcn-ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from 'shadcn-ui/field';
import { Input } from 'shadcn-ui/input';

import {
  joinSessionInputSchema,
  useJoinSession,
} from '@/features/session/api/join-session';
import type { Session } from '@/types/session';

type JoinSessionFormProps = {
  code: string;
  onJoined: (session: Session) => void;
};

export function JoinSessionForm({ code, onJoined }: JoinSessionFormProps) {
  const joinSession = useJoinSession();
  const form = useForm({
    defaultValues: { name: '' },
    validators: {
      onSubmit: joinSessionInputSchema,
    },
    onSubmit: async ({ value }) => {
      joinSession.mutate(
        { code, data: { name: value.name.trim() } },
        { onSuccess: onJoined },
      );
    },
  });

  return (
    <form
      className="flex w-full flex-col gap-4"
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
                <FieldLabel className="sr-only" htmlFor={field.name}>
                  Your name
                </FieldLabel>
                <Input
                  id={field.name}
                  variant="field"
                  autoComplete="given-name"
                  autoFocus
                  maxLength={50}
                  placeholder="e.g., Julian"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>
      {joinSession.isError && (
        <Alert variant="destructive">
          <AlertDescription className="text-center">
            {joinSession.error.message}
          </AlertDescription>
        </Alert>
      )}
      <form.Subscribe selector={(s) => s.canSubmit}>
        {(canSubmit) => (
          <Button
            type="submit"
            size="xl"
            className="w-full"
            disabled={!canSubmit || joinSession.isPending}
          >
            {joinSession.isPending ? 'Joining…' : 'Join session'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
