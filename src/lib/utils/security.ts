/**
 * Security utility functions
 */

/**
 * Escape special regex characters to prevent NoSQL injection
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Validate MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  return filename
    .replace(/[\/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255); // Limit length
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate and sanitize string input
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim().substring(0, maxLength);
}

/**
 * Validate URL scheme for outbound links
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validate file type by checking magic bytes
 */
export async function validateImageFile(file: File): Promise<boolean> {
  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validImageTypes.includes(file.type)) {
    return false;
  }

  // Check magic bytes for additional security
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 4));
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  // WebP: Check for RIFF...WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const webpHeader = new Uint8Array(buffer.slice(8, 12));
    const webpStr = String.fromCharCode(...webpHeader);
    return webpStr === 'WEBP';
  }
  
  return false;
}
