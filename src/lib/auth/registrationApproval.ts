export type RegistrationApproval = 'pending' | 'approved' | 'rejected';

/** Existing accounts predate the gate, so an absent value remains approved. */
export function effectiveRegistrationApproval(value: unknown): RegistrationApproval {
  return value === 'pending' || value === 'rejected' ? value : 'approved';
}

export function registrationApprovalForSignup(invited: boolean): RegistrationApproval {
  return invited ? 'approved' : 'pending';
}

