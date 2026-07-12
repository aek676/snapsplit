import { InferSchemaType, model, Schema } from 'mongoose';

export const participantSchema = new Schema(
  {
    name: String,
    deviceToken: String,
    isOwner: Boolean,
  },
  { timestamps: { createdAt: 'joinedAt', updatedAt: false } },
);

export type Participant = InferSchemaType<typeof participantSchema>;
export const Participant = model('Participant', participantSchema);
