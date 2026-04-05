
import stringify from 'json-stringify-safe';

/**
 * Safely stringifies an object, handling circular references by omitting them.
 * This implementation uses json-stringify-safe to handle circular references.
 */
export const safeStringify = (obj: any): string => {
  try {
    return stringify(obj);
  } catch (e) {
    console.error("safeStringify failed:", e);
    return "{}";
  }
};
