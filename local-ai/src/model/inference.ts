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

    const allButLast = history.slice(0, -1);
    const lastMessage = history[history.length - 1];

    const context = allButLast
      .map(m => `<|${m.role}|>\n${m.content}<|end|>\n`)
      .join('');

    const prompt = `${systemPrompt ? `<|system|>\n${systemPrompt}<|end|>\n` : ''}${context}<|user|>\n${lastMessage.content}<|end|>\n<|assistant|>\n`;

    const result = await model.completion(
      {
        prompt,
        n_predict: 1024,
        stop: ['<|end|>', '<|user|>', '<|system|>'],
      },
      (data) => onToken?.(data.token)
    );
    console.log('Full reply length:', result.text.length);
    console.log('Full reply end:', result.text.slice(-100));
    return result.text;
  } catch (e) {
    console.error('Inference error:', e);
    throw e;
  }
}