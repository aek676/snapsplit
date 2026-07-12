import { InferSchemaType, model, Schema } from 'mongoose';

export const claimSchema = new Schema({
  participantId: {
    type: Schema.Types.ObjectId,
    ref: 'Participant',
    required: true,
  },
  units: Number,
});

export type Claim = InferSchemaType<typeof claimSchema>;
export const Claim = model('Claim', claimSchema);
