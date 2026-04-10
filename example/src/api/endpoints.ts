import { jsonPlaceholderClient, pokeClient, countriesClient } from './clients';

// ─── JSONPlaceholder — Posts ───────────────────────────────────────────────────

export const getPosts = () =>
  jsonPlaceholderClient.get('/posts?_limit=5');

export const getPostById = (id: number) =>
  jsonPlaceholderClient.get(`/posts/${id}`);

export const createPost = () =>
  jsonPlaceholderClient.post('/posts', {
    title: 'Demo Post from NetworkLogger',
    body: 'This POST request was captured by rn-network-logger.',
    userId: 1,
  });

export const updatePost = (id: number) =>
  jsonPlaceholderClient.put(`/posts/${id}`, {
    id,
    title: 'Updated Post Title',
    body: 'PUT request captured by the logger.',
    userId: 1,
  });

export const patchPost = (id: number) =>
  jsonPlaceholderClient.patch(`/posts/${id}`, {
    title: 'Patched Title via PATCH',
  });

export const deletePost = (id: number) =>
  jsonPlaceholderClient.delete(`/posts/${id}`);

// ─── JSONPlaceholder — Users ────────────────────────────────────────────────

export const getUsers = () =>
  jsonPlaceholderClient.get('/users');

export const getUserById = (id: number) =>
  jsonPlaceholderClient.get(`/users/${id}`);

// ─── JSONPlaceholder — Todos ────────────────────────────────────────────────

export const getTodos = () =>
  jsonPlaceholderClient.get('/todos?_limit=10');

export const createTodo = () =>
  jsonPlaceholderClient.post('/todos', {
    title: 'Buy milk',
    completed: false,
    userId: 1,
  });

// ─── JSONPlaceholder — Auth (simulated via /users/login pattern) ────────────

export const postLogin = () =>
  jsonPlaceholderClient.post('/users', {
    username: 'john_doe',
    email: 'john@example.com',
    password: 's3cr3t',
  });

// ─── PokéAPI ────────────────────────────────────────────────────────────────

export const getPokemon = (name: string) =>
  pokeClient.get(`/pokemon/${name}`);

export const getPokemonList = () =>
  pokeClient.get('/pokemon?limit=5');

// ─── REST Countries ──────────────────────────────────────────────────────────

export const getCountry = (code: string) =>
  countriesClient.get(`/alpha/${code}`);

export const searchCountry = (name: string) =>
  countriesClient.get(`/name/${name}`);
