// Follow-up draft seam (OpenAI-compatible, mock by default).
// Mirrors the offline-first-ai-demo pattern: tests + demo run keyless on the
// mock; setting OPENAI_BASE_URL + OPENAI_API_KEY switches to a real call.
// No SDK: one fetch to /chat/completions with a strict JSON contract.

export interface DraftInput {
  customerName: string;
  jobTitle: string | null;
  jobStatus: string | null;
  followupTitle: string;
  tone?: string;
}

export interface DraftResult {
  draft: string;
  provider: "mock" | "live";
  model: string;
}

const SYSTEM = [
  "You write short follow-up SMS drafts for a window-cleaning company.",
  "Rules: under 320 chars, one clear next step, no invented prices or dates,",
  "plain text only, sign as the company. Return JSON: {\"draft\": \"...\"}.",
].join(" ");

export function mockDraft(input: DraftInput): string {
  const job = input.jobTitle ? ` about "${input.jobTitle}"` : "";
  return (
    `Hi ${input.customerName}, this is Blue Ridge Window Cleaning following up${job}: ` +
    `${input.followupTitle}. Reply YES and we will schedule you this week. ` +
    `Questions? Call us back at this number.`
  ).slice(0, 320);
}

export async function generateDraft(input: DraftInput): Promise<DraftResult> {
  const baseUrl = (process.env.OPENAI_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!baseUrl || !apiKey) {
    return { draft: mockDraft(input), provider: "mock", model: "mock-v1" };
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            customer: input.customerName,
            job: input.jobTitle,
            status: input.jobStatus,
            followup: input.followupTitle,
            tone: input.tone || "friendly",
          }),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM provider HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content) as { draft?: string };
  if (!parsed.draft || typeof parsed.draft !== "string")
    throw new Error("LLM returned no draft");
  return { draft: parsed.draft.slice(0, 320), provider: "live", model };
}
