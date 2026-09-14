/**
 * Local app configuration.
 * Edit this file or use Settings UI to change at runtime.
 *
 * Proxy server: run `node apps/local/proxy-server.js` first.
 * AI (axposervices): fill in baseUrl and apiKey below, then enable in UI.
 */
export const config = {
  /** URL of the local proxy / dev server (proxy-server.js) */
  proxyBaseUrl: 'http://localhost:3001',

  /**
   * OpenAI-compatible AI endpoint.
   * Point to axposervices or any Azure OpenAI / OpenAI-compatible URL.
   * Example: 'https://axposervices.azure-api.net/openai/deployments/gpt-4o-mini'
   */
  ai: {
    enabled: false,
    baseUrl: '',   // ← set your axposervices endpoint here
    apiKey:  '',   // ← your API key
    model:   'gpt-4o-mini',
  },
};
