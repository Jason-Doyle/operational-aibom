import OpenAI from "openai";

const client = new OpenAI();
const model = "gpt-4.1";

export async function answerSupportQuestion(question: string): Promise<string> {
  const response = await client.responses.create({
    model,
    input: question
  });

  return response.output_text;
}
