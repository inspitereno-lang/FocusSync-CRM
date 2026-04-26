jest.mock('./src/services/env', () => ({
  env: {
    VITE_API_URL: 'http://localhost:5001',
    VITE_AUTH_TOKEN: 'test-token'
  }
}), { virtual: true });
