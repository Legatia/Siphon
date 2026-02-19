import { useState, useRef, useEffect } from "react";
import {
  runAgentLoop,
  listShards,
  type AgentLoopResult,
  type ShardInfo,
} from "@/hooks/useTauri";
import { Send, Loader2, ChevronDown } from "lucide-react";

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
}

export default function Factory() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [shards, setShards] = useState<ShardInfo[]>([]);
  const [selectedShard, setSelectedShard] = useState<string>("desktop");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listShards().then(setShards).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const result: AgentLoopResult = await runAgentLoop(text, selectedShard);
      const response =
        result.final_response ??
        `Agent completed with ${result.total_tool_calls} tool calls (${result.stop_reason})`;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: String(e) },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-siphon-teal/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold glow-text">Workspace</h1>
          <p className="text-ghost text-sm mt-1">
            Your shard agent executes tasks locally
          </p>
        </div>

        <div className="relative">
          <select
            value={selectedShard}
            onChange={(e) => setSelectedShard(e.target.value)}
            className="appearance-none bg-midnight/60 border border-siphon-teal/20 rounded-lg pl-3 pr-8 py-1.5 text-sm text-foam focus:outline-none focus:border-siphon-teal/50"
          >
            <option value="desktop">Desktop (default)</option>
            {shards.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.shard_type})
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ghost pointer-events-none"
          />
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-6 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-ghost text-sm">
            <p>Send a message to start the agent loop.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] ${
              msg.role === "user" ? "ml-auto" : "mr-auto"
            }`}
          >
            <div
              className={`rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-siphon-teal/20 text-foam"
                  : msg.role === "error"
                    ? "bg-red-900/30 text-red-300 border border-red-500/30"
                    : "bg-midnight/80 text-foam border border-siphon-teal/10"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-ghost text-sm mr-auto">
            <Loader2 size={14} className="animate-spin" />
            Agent is working...
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-siphon-teal/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a task for the agent..."
            disabled={loading}
            className="flex-1 bg-midnight/60 border border-siphon-teal/20 rounded-lg px-4 py-2 text-sm text-foam placeholder:text-ghost/50 focus:outline-none focus:border-siphon-teal/50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-siphon-teal/20 text-siphon-teal rounded-lg border border-siphon-teal/30 hover:bg-siphon-teal/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
