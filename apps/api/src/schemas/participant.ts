import { type InferSchemaType, Schema } from 'mongoose';

export const participantSchema = new Schema(
  {
    name: { type: String },
    deviceTokenHash: { type: String, required: true, select: false },
    isOwner: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'joinedAt', updatedAt: false } },
);

export type Participant = InferSchemaType<typeof participantSchema>;
