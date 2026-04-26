
import stringify from 'json-stringify-safe';

/**
 * Safely stringifies an object, handling circular references by omitting them.
 * This implementation uses json-stringify-safe to handle circular references.
 */
export const safeStringify = (obj: any): string => {
  if (obj === undefined) return "undefined";
  if (obj === null) return "null";
  
  try {
    // Use json-stringify-safe to handle circular references
    return stringify(obj);
  } catch (e) {
    console.error("safeStringify failed:", e);
    
    // Fallback: manual shallow stringification if stringify fails
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }
        return value;
      });
    } catch (fallbackError) {
      console.error("safeStringify fallback failed:", fallbackError);
      return "{}";
    }
  }
};
