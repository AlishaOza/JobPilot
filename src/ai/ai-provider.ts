export interface AiProvider {
  readonly name: string;
  completeJson(prompt: string): Promise<unknown>;
  completeText(prompt: string): Promise<string>;
}
