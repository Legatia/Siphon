"use client";

import { useState, useEffect, useRef } from "react";
import type { Shard } from "@siphon/core";
import { getShardTypeName, SHARD_TYPE_COLORS, SHARD_TYPE_NAMES } from "@siphon/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "shard";
  content: string;
  timestamp: number;
  xp_gained?: number;
}

export function TrainingChat({
  shard,
  onXpGain,
}: {
  shard: Shard;
  onXpGain?: (updated: Shard) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const typeName = getShardTypeName(shard.type);
  const color = SHARD_TYPE_COLORS[typeName as keyof typeof SHARD_TYPE_COLORS];

  // Load history
  useEffect(() => {
    fetch(`/api/shards/${shard.id}/train`)
      .then((r) => r.json())
      .then((msgs: any[]) => {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role === "user" ? "user" : "shard",
            content: m.content,
            timestamp: m.timestamp,
            xp_gained: m.xp_gained,
          }))
        );
      });
  }, [shard.id]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/shards/${shard.id}/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Show specific error (message cap, auth, etc.)
        const errorMsg = data.error || "Something went wrong";
        toast.error(errorMsg);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "shard",
            content: errorMsg,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      const shardMsg: Message = {
        id: crypto.randomUUID(),
        role: "shard",
        content: data.response,
        timestamp: Date.now(),
        xp_gained: data.xpGained,
      };

      setMessages((prev) => [...prev, shardMsg]);

      if (data.shard && onXpGain) {
        onXpGain(data.shard);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "shard",
          content: "Connection lost. Check your network and try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] rounded-xl border border-siphon-teal/10 bg-midnight/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-siphon-teal/10">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
          style={{
            backgroundColor: color + "20",
            color: color,
            boxShadow: `0 0 10px ${color}30`,
          }}
        >
          {["◈", "◇", "▣", "✦", "⬡", "⚖", "⛨", "◐"][shard.type] ?? "◈"}
        </div>
        <div>
          <h3 className="font-semibold text-foam text-sm">{shard.name}</h3>
          <p className="text-xs text-ghost">
            {typeName} &middot; Level {shard.level}
          </p>
        </div>
        <div className="ml-auto">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-ghost text-sm py-8">
            <p>Begin training with {shard.name}.</p>
            <p className="text-xs mt-1">
              Each interaction earns XP and strengthens your bond.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-siphon-teal/20 text-foam border border-siphon-teal/20"
                  : "bg-abyss/80 text-foam border border-siphon-teal/5"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.xp_gained ? (
                <span className="text-xs text-siphon-teal mt-1 block">
                  +{msg.xp_gained} XP
                </span>
              ) : null}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-abyss/80 rounded-xl px-4 py-2.5 text-sm border border-siphon-teal/5">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-siphon-teal animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-siphon-teal animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-siphon-teal animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-siphon-teal/10">
        <div className="flex gap-2">
          <Input
            placeholder={`Say something to ${shard.name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={sending}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={sending || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
