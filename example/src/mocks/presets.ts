import type { MockPreset } from "react-native-network-inspector-devtools";

/**
 * Pre-configured mock presets for the demo app.
 *
 * Each preset shows a different feature of the library:
 *  - Multiple variants (success / error / empty / slow)
 *  - matchType options: 'contains', 'exact', 'regex'
 *  - Artificial delays to simulate slow networks
 *  - Mocking across different HTTP methods
 */
export const DEMO_PRESETS: MockPreset[] = [
  // ─── Auth: Login ──────────────────────────────────────────────────────────
  {
    urlPattern: "/users",
    method: "POST",
    matchType: "contains",
    status: 200,
    responseBody: JSON.stringify({
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo",
      userId: 42,
      name: "John Doe",
      email: "john@example.com",
    }),
    responseHeaders: { "x-auth-source": "mocked" },
    variants: [
      {
        name: "Wrong Credentials",
        status: 401,
        responseBody: JSON.stringify({
          error: "Unauthorized",
          message: "Invalid username or password.",
        }),
      },
      {
        name: "Account Locked",
        status: 403,
        responseBody: JSON.stringify({
          error: "Forbidden",
          message: "Account has been locked after 5 failed attempts.",
        }),
      },
      {
        name: "Server Error",
        status: 503,
        responseBody: JSON.stringify({
          error: "Service Unavailable",
          message: "Auth service is temporarily down.",
        }),
        delay: 2000,
      },
    ],
  },

  // ─── Posts: GET list ─────────────────────────────────────────────────────
  {
    urlPattern: "/posts?_limit=5",
    method: "GET",
    matchType: "contains",
    status: 200,
    responseBody: JSON.stringify([
      {
        id: 1,
        title: "Mocked Post #1",
        body: "This response is mocked.",
        userId: 1,
      },
      {
        id: 2,
        title: "Mocked Post #2",
        body: "Served instantly from cache.",
        userId: 1,
      },
      {
        id: 3,
        title: "Mocked Post #3",
        body: "No real network call was made.",
        userId: 2,
      },
    ]),
    variants: [
      {
        name: "Empty List",
        status: 200,
        responseBody: JSON.stringify([]),
      },
      {
        name: "Server Error 500",
        status: 500,
        responseBody: JSON.stringify({ error: "Internal Server Error" }),
      },
      {
        name: "Slow Response (3s)",
        status: 200,
        responseBody: JSON.stringify([
          {
            id: 1,
            title: "Slow Post",
            body: "This took 3 seconds.",
            userId: 1,
          },
        ]),
        delay: 3000,
      },
    ],
  },

  // ─── Posts: Create (POST) ─────────────────────────────────────────────────
  {
    urlPattern: "/posts",
    method: "POST",
    matchType: "exact",
    status: 201,
    responseBody: JSON.stringify({
      id: 101,
      title: "Demo Post from NetworkLogger",
      body: "This POST request was captured by rn-network-logger.",
      userId: 1,
    }),
    responseHeaders: { "x-created-by": "mock-server" },
    variants: [
      {
        name: "Validation Error",
        status: 422,
        responseBody: JSON.stringify({
          error: "Unprocessable Entity",
          fields: {
            title: "Title is required",
            body: "Body must be at least 10 characters",
          },
        }),
      },
      {
        name: "Rate Limited",
        status: 429,
        responseBody: JSON.stringify({
          error: "Too Many Requests",
          retryAfter: 60,
        }),
        delay: 500,
      },
    ],
  },

  // ─── Todos: GET with regex match ─────────────────────────────────────────
  {
    urlPattern: "/todos",
    method: "GET",
    matchType: "contains",
    status: 200,
    responseBody: JSON.stringify([
      { id: 1, title: "Buy groceries", completed: false, userId: 1 },
      { id: 2, title: "Read React Native docs", completed: true, userId: 1 },
      { id: 3, title: "Build an app", completed: false, userId: 1 },
      { id: 4, title: "Record demo video", completed: false, userId: 1 },
    ]),
    variants: [
      {
        name: "All Completed",
        status: 200,
        responseBody: JSON.stringify([
          { id: 1, title: "Buy groceries", completed: true, userId: 1 },
          {
            id: 2,
            title: "Read React Native docs",
            completed: true,
            userId: 1,
          },
          { id: 3, title: "Build an app", completed: true, userId: 1 },
        ]),
      },
      {
        name: "Not Found",
        status: 404,
        responseBody: JSON.stringify({
          error: "No todos found for this user.",
        }),
      },
    ],
  },

  // ─── Pokémon: GET — showcase 'exact' matchType ───────────────────────────
  {
    urlPattern: "https://pokeapi.co/api/v2/pokemon/pikachu",
    method: "GET",
    matchType: "exact",
    status: 200,
    responseBody: JSON.stringify({
      id: 25,
      name: "pikachu",
      height: 4,
      weight: 60,
      types: [{ slot: 1, type: { name: "electric" } }],
      stats: [
        { base_stat: 35, stat: { name: "hp" } },
        { base_stat: 55, stat: { name: "attack" } },
        { base_stat: 90, stat: { name: "speed" } },
      ],
    }),
    variants: [
      {
        name: "Not Found",
        status: 404,
        responseBody: JSON.stringify({ detail: "Not Found" }),
      },
      {
        name: "Offline / Network Error",
        status: 503,
        responseBody: JSON.stringify({ error: "Pokémon service is offline." }),
        delay: 1500,
      },
    ],
  },

  // ─── Countries: GET India — showcase regex matchType ─────────────────────
  {
    urlPattern: "/alpha/(IN|US|GB)",
    method: "GET",
    matchType: "regex",
    status: 200,
    responseBody: JSON.stringify([
      {
        name: { common: "India (Mocked)", official: "Republic of India" },
        capital: ["New Delhi"],
        population: 1380000000,
        region: "Asia",
        currencies: { INR: { name: "Indian rupee", symbol: "₹" } },
        flags: { alt: "Flag of India" },
      },
    ]),
    variants: [
      {
        name: "Not Found",
        status: 404,
        responseBody: JSON.stringify({ status: 404, message: "Not Found" }),
      },
      {
        name: "Slow (2s delay)",
        status: 200,
        responseBody: JSON.stringify([
          {
            name: { common: "India (Slow)", official: "Republic of India" },
            capital: ["New Delhi"],
            population: 1380000000,
          },
        ]),
        delay: 2000,
      },
    ],
  },

  // ─── Users: DELETE — showcase DELETE mock ────────────────────────────────
  {
    urlPattern: "/users",
    method: "GET",
    matchType: "contains",
    status: 200,
    responseBody: JSON.stringify([
      {
        id: 1,
        name: "Leanne Graham",
        email: "Sincere@april.biz",
        phone: "1-770-736-0988",
      },
      {
        id: 2,
        name: "Ervin Howell",
        email: "Shanna@melissa.tv",
        phone: "010-692-6593",
      },
      {
        id: 3,
        name: "Clementine Bauch",
        email: "Nathan@yesenia.net",
        phone: "1-463-123-4447",
      },
    ]),
    variants: [
      {
        name: "Server Down",
        status: 503,
        responseBody: JSON.stringify({ error: "User service is unavailable." }),
        delay: 1000,
      },
    ],
  },
];
