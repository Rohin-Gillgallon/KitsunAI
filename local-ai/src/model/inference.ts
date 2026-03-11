import { getModel } from './llm';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export async function generateReply(
  history: Message[],
  systemPrompt: string,
  onToken?: (token: string) => void
): Promise<string> {
  try {
    const model = await getModel();

    const context = history
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = systemPrompt
      ? `${systemPrompt}\n\n${context}\nAssistant:`
      : `${context}\nAssistant:`;

    const result = await model.completion(
      { prompt, n_predict: 512, stop: ['User:', '\n\n'] },
      (data) => onToken?.(data.token)
    );

    return result.text;
  } catch (e) {
    console.error('Inference error:', e);
    throw e;
  }
}
