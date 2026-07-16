import { type InferSchemaType, model, Schema } from 'mongoose';

export const participantSchema = new Schema(
  {
    name: { type: String, required: true },
    deviceToken: { type: String, required: true },
    isOwner: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'joinedAt', updatedAt: false } },
);

export type Participant = InferSchemaType<typeof participantSchema>;
export const Participant = model('Participant', participantSchema);
