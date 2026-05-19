/**
 * Fetch-based endpoints — demonstrate that the NetworkLogger captures and
 * mocks `fetch` requests with all the same features as axios:
 *  - URL / method / headers / body capture
 *  - Mock matching (contains / exact / regex)
 *  - Per-variant delays
 *  - Error status flagged as "error" in the panel even when mocked
 *
 * These intentionally call public APIs that none of the axios clients touch,
 * so the panel clearly attributes each row to the fetch interceptor.
 */

// ─── Simple GET ──────────────────────────────────────────────────────────────

export const fetchProducts = async () => {
  const res = await fetch('https://dummyjson.com/products?limit=5');
  return res.json();
};

export const fetchProductById = async (id: number) => {
  const res = await fetch(`https://dummyjson.com/products/${id}`);
  return res.json();
};

// ─── POST with JSON body ─────────────────────────────────────────────────────

export const fetchCreateProduct = async () => {
  const res = await fetch('https://dummyjson.com/products/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Source': 'fetch-interceptor',
    },
    body: JSON.stringify({
      title: 'Fetch Demo Product',
      description: 'Created via global fetch + logged by the panel.',
      price: 99,
    }),
  });
  return res.json();
};

// ─── POST with URLSearchParams body (form-encoded) ───────────────────────────

export const fetchFormEncoded = async () => {
  const body = new URLSearchParams({
    grant_type: 'password',
    username: 'demo',
    password: 'demo',
  });
  const res = await fetch('https://dummyjson.com/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return res.json();
};

// ─── Request object input (covers the `input instanceof Request` branch) ────

export const fetchViaRequestObject = async () => {
  const request = new Request('https://dummyjson.com/users/1', {
    method: 'GET',
    headers: { 'X-Demo-Variant': 'request-object' },
  });
  const res = await fetch(request);
  return res.json();
};

// ─── 404 error case — surfaces as state: 'error' in the panel ───────────────

export const fetchNotFound = async () => {
  const res = await fetch('https://dummyjson.com/http/404/Not-Found');
  // Caller's own `if (!res.ok)` branch fires just like with a real server.
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
};

// ─── Network failure — invalid host, surfaces as state: 'error' ─────────────

export const fetchNetworkError = async () => {
  const res = await fetch('https://this-host-does-not-exist.invalid/ping');
  return res.json();
};
