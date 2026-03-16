import { getModel } from './llm';
import { MODELS, PromptFormat } from './models';
import { Settings } from '../store/settings';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

function buildPrompt(
  history: Message[],
  systemPrompt: string,
  format: PromptFormat,
): { prompt: string; stop: string[] } {
  const allButLast = history.slice(0, -1);
  const last = history[history.length - 1];

  switch (format) {

    case 'phi3': {
      const ctx = allButLast
        .map(m => `<|${m.role}|>\n${m.content}<|end|>\n`)
        .join('');
      const prompt =
        (systemPrompt ? `<|system|>\n${systemPrompt}<|end|>\n` : '') +
        ctx +
        `<|user|>\n${last.content}<|end|>\n<|assistant|>\n`;
      return { prompt, stop: ['<|end|>', '<|user|>', '<|system|>'] };
    }

    case 'llama3': {
      const sys = systemPrompt
        ? `<|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>\n`
        : '';
      const ctx = allButLast.map(m =>
        `<|start_header_id|>${m.role}<|end_header_id|>\n\n${m.content}<|eot_id|>\n`
      ).join('');
      const prompt =
        `<|begin_of_text|>${sys}` +
        ctx +
        `<|start_header_id|>user<|end_header_id|>\n\n${last.content}<|eot_id|>\n` +
        `<|start_header_id|>assistant<|end_header_id|>\n\n`;
      return { prompt, stop: ['<|eot_id|>', '<|end_of_text|>'] };
    }

    case 'gemma': {
      // Gemma has no system token — prepend system to first user turn
      let firstUser = true;
      const ctx = allButLast.map(m => {
        if (m.role === 'user') {
          const prefix = (firstUser && systemPrompt)
            ? `${systemPrompt}\n\n` : '';
          firstUser = false;
          return `<start_of_turn>user\n${prefix}${m.content}<end_of_turn>\n`;
        }
        return `<start_of_turn>model\n${m.content}<end_of_turn>\n`;
      }).join('');
      const lastPrefix = (firstUser && systemPrompt)
        ? `${systemPrompt}\n\n` : '';
      const prompt =
        ctx +
        `<start_of_turn>user\n${lastPrefix}${last.content}<end_of_turn>\n` +
        `<start_of_turn>model\n`;
      return { prompt, stop: ['<end_of_turn>', '<start_of_turn>'] };
    }

    case 'chatml': {
      const ctx = allButLast
        .map(m => `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`)
        .join('');
      const prompt =
        (systemPrompt ? `<|im_start|>system\n${systemPrompt}<|im_end|>\n` : '') +
        ctx +
        `<|im_start|>user\n${last.content}<|im_end|>\n` +
        `<|im_start|>assistant\n`;
      return { prompt, stop: ['<|im_end|>', '<|im_start|>'] };
    }
  }
}

export async function generateReply(
  history: Message[],
  systemPrompt: string,
  onToken?: (token: string) => void,
): Promise<string> {
  try {
    const model = await getModel();
    const modelId = Settings.getSelectedModelId();
    const modelDef = MODELS.find(m => m.id === modelId);
    const format: PromptFormat = modelDef?.format ?? 'phi3';

    const { prompt, stop } = buildPrompt(history, systemPrompt, format);

    const result = await model.completion(
      { prompt, n_predict: 1024, stop },
      (data) => onToken?.(data.token),
    );

    const trimmed = result.text.trim();
    console.log('Reply length:', trimmed.length);
    return trimmed;
  } catch (e) {
    console.error('Inference error:', e);
    throw e;
  }
}