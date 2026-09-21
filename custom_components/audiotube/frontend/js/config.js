/**
 * Local app configuration.
 * Edit this file or use Settings UI to change at runtime.
 *
 * AI: optional, OpenAI-compatible endpoint. Fill in baseUrl and apiKey below, then enable in UI.
 */
export const config = {
  /**
   * OpenAI-compatible AI endpoint.
   * Point to Azure OpenAI, OpenAI, or any OpenAI-compatible URL.
   * Example: 'https://your-endpoint.example.com/openai/deployments/gpt-4o-mini'
   */
  ai: {
    enabled: false,
    baseUrl: '',   // ← set your OpenAI-compatible endpoint here
    apiKey:  '',   // ← your API key
    model:   'gpt-4o-mini',
  },
};
