import axios from 'axios';

/**
 * Primary API client — JSONPlaceholder
 * Used for: Posts, Users, Todos (CRUD demo)
 */
export const jsonPlaceholderClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Secondary API client — PokéAPI
 * Used for: Pokémon lookups (showcase multiple axios instances)
 */
export const pokeClient = axios.create({
  baseURL: 'https://pokeapi.co/api/v2',
  timeout: 10000,
  headers: {
    Accept: 'application/json',
  },
});

/**
 * Tertiary API client — REST Countries
 * Used for: Country info (showcase mocking + variants)
 */
export const countriesClient = axios.create({
  baseURL: 'https://restcountries.com/v3.1',
  timeout: 10000,
  headers: {
    Accept: 'application/json',
  },
});
