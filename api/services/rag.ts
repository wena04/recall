import { supabase } from "../lib/supabase.js";
import { callMiniMaxTextCompletion } from "./llm.js";

const RAG_MODEL = process.env.MINIMAX_RAG_MODEL || "M2-her";
const userStyleCache = new Map<string, string>();

async function getUserTextingStyle(userId: string): Promise<string> {
  if (userStyleCache.has(userId)) {
    return userStyleCache.get(userId)!;
  }

  const { data: items, error } = await supabase
    .from("knowledge_items")
    .select("recall_enrichment")
    .eq("user_id", userId)
    .limit(50);

  if (error) {
    console.error("Error fetching user texting style:", error);
    return ""; // Default to empty string if there's an error
  }

  // For now, we'll just use the first texting style we find.
  // In the future, we could do something more sophisticated here, like averaging them.
  for (const item of items) {
    const style = (item.recall_enrichment as any)?.texting_style;
    if (style) {
      userStyleCache.set(userId, style);
      return style;
    }
  }

  return "";
}

export async function handleQuery(
  userId: string,
  question: string,
): Promise<string> {
  // 1. Retrieve relevant knowledge items from Supabase
  const { data: items, error } = await supabase
    .from("knowledge_items")
    .select("summary, source_context")
    .eq("user_id", userId)
    .textSearch("summary", question, { type: "websearch" })
    .limit(5);

  if (error) {
    console.error("Error searching for knowledge items:", error);
    throw error;
  }

  // 2. Get the user's texting style
  const textingStyle = await getUserTextingStyle(userId);

  // 3. Construct the prompt for MiniMax
  const context = items
    .map((item) => `Summary: ${item.summary}\nSource: ${item.source_context}`)
    .join("\n\n");
  const systemPrompt = `You are a digital clone of a person. Your goal is to answer questions based on their saved memories, using their own voice and style. Do not act like a generic AI assistant.

Here is the person's texting style: "${textingStyle}"

Here are some of their saved memories:
${context}

Now, answer the following question as if you were them:
${question}`;

  const userContent = `Question: "${question}"`;

  // 4. Call MiniMax to get the answer
  const answer = await callMiniMaxTextCompletion(
    userContent,
    systemPrompt,
    RAG_MODEL,
  );

  return answer;
}
