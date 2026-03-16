
/**
 * Safely stringifies an object, handling circular references by omitting them.
 */
export const safeStringify = (obj: any): string => {
  const cache = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return "[Circular]";
      }
      cache.add(value);
    }
    return value;
  });
};
