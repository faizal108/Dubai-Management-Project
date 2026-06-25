// Tiny class-name joiner. Accepts strings, arrays, and plain objects
// (where keys whose values are truthy are emitted). Falsy values are skipped.
export function cn(...inputs) {
  const out = [];
  const walk = (value) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (typeof value === "object") {
      for (const key of Object.keys(value)) {
        if (value[key]) out.push(key);
      }
    }
  };
  for (const input of inputs) walk(input);
  return out.join(" ");
}
