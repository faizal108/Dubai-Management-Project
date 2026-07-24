import { useEffect, useState } from "react";

// Returns a debounced copy of `value` that only updates after `delay` ms of
// quiet. Handy for search boxes / filters that drive network requests.
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

export default useDebounced;
