import mongoose from 'mongoose';

export function blogApiErrorResponse(error: unknown): { message: string; status: number } {
  if (error instanceof mongoose.Error.ValidationError) {
    const first = Object.values(error.errors)[0];
    const msg = first?.message || 'Validation failed';
    return { message: msg, status: 400 };
  }

  if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) {
    return { message: 'Slug already in use', status: 400 };
  }

  return { message: 'Internal server error', status: 500 };
}
