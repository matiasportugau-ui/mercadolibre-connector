import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';

const client = new Anthropic({
  apiKey: config.anthropicApiKey,
});

export async function ask({ systemPrompt, userMessage, maxTokens = 1024 }) {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  return message.content[0].type === 'text' ? message.content[0].text : null;
}
