import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['consumer', 'engineer', 'steward'], required: true },
  },
  { timestamps: true },
);
export default mongoose.model('User', schema);
