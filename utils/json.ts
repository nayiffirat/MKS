
/**
 * Safely stringifies an object, handling circular references by omitting them.
 * This implementation manually decycles the object before calling JSON.stringify
 * to avoid issues in browsers like Safari that throw before calling the replacer.
 */
export const safeStringify = (obj: any): string => {
  const cache = new WeakSet();
  
  const decycle = (value: any): any => {
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (value instanceof RegExp) {
      return value.toString();
    }
    
    if (cache.has(value)) {
      return "[Circular]";
    }
    
    cache.add(value);
    
    if (Array.isArray(value)) {
      return value.map(decycle);
    }
    
    const result: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = decycle(value[key]);
      }
    }
    return result;
  };

  try {
    return JSON.stringify(decycle(obj));
  } catch (e) {
    console.error("safeStringify failed:", e);
    return "{}";
  }
};
