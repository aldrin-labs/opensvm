import { NextResponse } from "next/server";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import Together from "together-ai";

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// Check if required environment variables are present
if (!process.env.TOGETHER_API_KEY) {
  console.warn('Warning: Missing required environment variables. The similar questions feature will be disabled.');
}

const together = process.env.TOGETHER_API_KEY ? new Together({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
  // defaultHeaders: process.env.HELICONE_API_KEY ? {
  //   "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  // } : {},
}) : null;

interface ChatCompletion {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function POST(request: Request) {
  if (!together) {
    return NextResponse.json({ error: "Similar questions feature is not configured" }, { status: 503 });
  }

  try {
    const { question } = await request.json();

    const schema = z.array(z.string()).length(3);
    const jsonSchema = zodToJsonSchema(schema, "mySchema");

    const similarQuestions = await together.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `
            You are a helpful assistant that helps the user to ask related questions, based on user's original question. Please identify worthwhile topics that can be follow-ups, and write 3 questions no longer than 20 words each. Please make sure that specifics, like events, names, locations, are included in follow up questions so they can be asked standalone. For example, if the original question asks about "the Manhattan project", in the follow up question, do not just say "the project", but use the full name "the Manhattan project". Your related questions must be in the same language as the original question.

            Please provide these 3 related questions as a JSON array of 3 strings. Do NOT repeat the original question. ONLY return the JSON array, I will get fired if you don't return JSON. Here is the user's original question:`,
        },
        {
          role: "user",
          content: question,
        },
      ],
      // @ts-ignore
      response_format: { type: "json_object", schema: jsonSchema },
      model: "openai/gpt-oss-120b",
    }) as ChatCompletion;

    // Safely access the response with proper null checks
    const content = similarQuestions?.choices?.[0]?.message?.content;
    if (!content) {
      console.error('No content in response:', similarQuestions);
      return NextResponse.json([], { status: 200 });
    }

    try {
      const parsedQuestions = JSON.parse(content);
      if (!Array.isArray(parsedQuestions) || parsedQuestions.length !== 3) {
        console.error('Invalid response format:', parsedQuestions);
        return NextResponse.json([], { status: 200 });
      }
      return NextResponse.json(parsedQuestions);
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      return NextResponse.json([], { status: 200 });
    }
  } catch (error) {
    console.error("Error in POST function:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
