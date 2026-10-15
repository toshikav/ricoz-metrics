import mongoose from 'mongoose';
const schema = new mongoose.Schema({ _id: String });
export default mongoose.model('AuthState', schema);
