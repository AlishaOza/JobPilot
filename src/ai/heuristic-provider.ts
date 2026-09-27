import type { AiProvider } from "./ai-provider";

export class HeuristicAiProvider implements AiProvider {
  readonly name = "heuristic";

  async completeJson(prompt: string): Promise<unknown> {
    if (prompt.includes("Write three short drafts")) {
      return this.outreach(prompt);
    }
    return this.questionAnswer(prompt);
  }

  async completeText(prompt: string): Promise<string> {
    const json = await this.completeJson(prompt);
    if (json && typeof json === "object" && "answer" in json) {
      return String((json as { answer: string }).answer);
    }
    return "NEEDS_USER_INPUT";
  }

  private questionAnswer(prompt: string): unknown {
    const question = /QUESTION:\s*([\s\S]+)$/i.exec(prompt)?.[1] ?? "";
    if (/salary|visa|authorization|sponsor|relocat|legal/i.test(question)) {
      return { answer: "NEEDS_USER_INPUT", confidence: "LOW", needsUserInput: true };
    }
    const role = /ROLE:\s*(.+)/.exec(prompt)?.[1]?.trim() ?? "this role";
    const company = /COMPANY:\s*(.+)/.exec(prompt)?.[1]?.trim() ?? "the company";
    return {
      answer: `I am interested in the ${role} opening at ${company} because it matches the Angular, React, TypeScript and full-stack skills in my profile, and I am available to join immediately.`,
      confidence: "MEDIUM",
      needsUserInput: false,
    };
  }

  private outreach(prompt: string): unknown {
    const company = /company=([^\n]+)/.exec(prompt)?.[1] ?? "the company";
    const role = /role=([^\n]+)/.exec(prompt)?.[1] ?? "the role";
    const recruiter = /recruiter=([^\n]+)/.exec(prompt)?.[1] ?? "Hiring Team";
    const greeting = recruiter === "Hiring Team" ? "Hi" : `Hi ${recruiter}`;
    const linkedin = `${greeting}, I came across the ${role} opening at ${company}. I have hands-on experience with Angular, React, TypeScript and full-stack development and am available for immediate joining. I'd love to connect and discuss the opportunity.`;
    return {
      linkedin,
      email: `${greeting},\n\nI am applying for the ${role} role at ${company}. I work with Angular, React, TypeScript, Node.js and MongoDB and can join immediately. Please find my details in the application when you have a moment.\n\nThank you.`,
      callScript: `${greeting}, this is regarding the ${role} opening at ${company}. I wanted to introduce myself, confirm my immediate availability, and ask about the next step in the process.`,
    };
  }
}
