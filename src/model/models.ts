export type PromptFormat = 'phi3' | 'llama3' | 'gemma' | 'chatml';

export type ModelDef = {
    id: string;
    name: string;
    description: string;
    sizeGB: number;
    url: string;
    filename: string;
    format: PromptFormat;
    speed: 'fast' | 'medium' | 'slow';
    tag?: string;
};

export const MODELS: ModelDef[] = [
    {
        id: 'gemma3-1b',
        name: 'Gemma 3 1B',
        description: 'Google. Best for voice mode.',
        sizeGB: 0.85,
        url: 'https://huggingface.co/bartowski/google_gemma-3-1b-it-GGUF/resolve/main/google_gemma-3-1b-it-Q5_K_L.gguf',
        filename: 'gemma3-1b-q5l.gguf',
        format: 'gemma',
        speed: 'fast',
        tag: 'DEFAULT',
    },
    {
        id: 'llama32-3b',
        name: 'Llama 3.2 3B',
        description: 'Meta. Built for edge devices.',
        sizeGB: 2.42,
        url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q5_K_L.gguf',
        filename: 'llama32-3b-q5l.gguf',
        format: 'llama3',
        speed: 'fast',
    },
    {
        id: 'qwen25-3b',
        name: 'Qwen 2.5 3B',
        description: 'Alibaba. Strong reasoning.',
        sizeGB: 2.30,
        url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q5_K_L.gguf',
        filename: 'qwen25-3b-q5l.gguf',
        format: 'chatml',
        speed: 'fast',
    },
    {
        id: 'phi4-mini',
        name: 'Phi-4 Mini 3.8B',
        description: 'Microsoft 2025. Math & logic.',
        sizeGB: 3.00,
        url: 'https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/microsoft_Phi-4-mini-instruct-Q5_K_L.gguf',
        filename: 'phi4-mini-q5l.gguf',
        format: 'phi3',
        speed: 'medium',
    },
    {
        id: 'gemma3-4b',
        name: 'Gemma 3 4B',
        description: 'Google 2025. Best quality.',
        sizeGB: 2.99,
        url: 'https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q5_K_L.gguf',
        filename: 'gemma3-4b-q5l.gguf',
        format: 'gemma',
        speed: 'medium',
        tag: 'BEST',
    },
    {
        id: 'qwen3-4b',
        name: 'Qwen 3 4B',
        description: 'Apr 2025. Top benchmarks.',
        sizeGB: 2.98,
        url: 'https://huggingface.co/bartowski/Qwen_Qwen3-4B-GGUF/resolve/main/Qwen_Qwen3-4B-Q5_K_L.gguf',
        filename: 'qwen3-4b-q5l.gguf',
        format: 'chatml',
        speed: 'medium',
        tag: 'LATEST',
    },
];

export const DEFAULT_MODEL_ID = 'gemma3-1b';