import mongoose from 'mongoose';

export function isValidObjectIdString(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}
