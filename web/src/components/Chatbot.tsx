import { useState } from "react";
import BentoCard from "./ui/BentoCard";

export default function Chatbot({ userId }: { userId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAnswer("");

    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, question }),
    });

    const data = await response.json();
    setAnswer(data.answer);
    setLoading(false);
  };

  return (
    <BentoCard className="mx-auto mt-8 max-w-5xl">
      <div className="mb-4 border-b border-violet-100/80 pb-4">
        <h2 className="text-lg font-semibold text-stone-900">
          Mirror Memory Chatbot
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Ask a question about your saved memories.
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What LA cafes did we save?"
          className="w-full rounded-lg border border-stone-300 p-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !question}
          className="mt-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
      {answer && (
        <div className="mt-4 rounded-xl bg-stone-50/90 px-3 py-2 text-sm text-stone-700">
          <p className="whitespace-pre-wrap font-medium text-stone-800">
            Answer
          </p>
          <p className="mt-1 leading-relaxed text-stone-600">{answer}</p>
        </div>
      )}
    </BentoCard>
  );
}
