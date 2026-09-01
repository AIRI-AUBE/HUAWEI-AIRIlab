import promptData from './prompts.json';

export type PromptTemplate = { id: string; page: number; en: string; chs: string };
export const defaultPromptTemplates = promptData satisfies PromptTemplate[];
