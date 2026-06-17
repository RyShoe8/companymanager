import {
  encryptActionButtonPassword,
  decryptActionButtonPassword,
  isEncryptedActionButtonPassword,
} from './actionButtonCrypto';

export interface PlatformCredentialItem {
  login?: string;
  password?: string;
}

/** Encrypts platform credential passwords before saving to database. */
export function encryptPlatformCredentials<T extends Record<string, any>>(items: T[]): T[] {
  return items.map((item) => {
    if (!item.password) return item;
    if (isEncryptedActionButtonPassword(item.password)) return item;
    return {
      ...item,
      password: encryptActionButtonPassword(item.password),
    };
  });
}

/** Decrypts platform credential passwords for admins/managers. */
export function decryptPlatformCredentials<T extends Record<string, any>>(items: T[]): T[] {
  return items.map((item) => {
    if (!item.password) return item;
    return {
      ...item,
      password: decryptActionButtonPassword(item.password),
    };
  });
}

/** Removes platform credential passwords from items before returning via generic APIs. */
export function stripPlatformCredentialPasswords<T extends Record<string, any>>(items: T[]): T[] {
  return items.map((item) => {
    if (item.password === undefined) return item;
    const { password: _password, ...rest } = item;
    return rest as T;
  });
}

/** Serializes platform credentials with optional password decryption for admins/managers. */
export function serializePlatformCredentials<T extends Record<string, any>>(
  items: T[] | undefined,
  includePasswords: boolean
): T[] {
  if (!items) return [];
  return items.map((item) => {
    const base: T = { ...item };
    if (includePasswords && item.password) {
      (base as any).password = decryptActionButtonPassword(item.password);
    } else {
      delete (base as any).password;
    }
    return base;
  });
}
