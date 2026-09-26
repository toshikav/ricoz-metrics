import mongoose from 'mongoose';
export default mongoose.model(
  'CatalogState',
  new mongoose.Schema({
    _id: String,
    sequence: { type: Number, default: 0 },
    hash: { type: String, default: '0' },
  }),
);
