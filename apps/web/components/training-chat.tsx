"use client";

import { useState, useEffect, useRef } from "react";
import type { Shard } from "@siphon/core";
import { getShardTypeName, SHARD_TYPE_COLORS } from "@siphon/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { playSfx, triggerCelebration, updateOnboardingProgress } from "@/lib/game-feedback";

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
      playSfx("xp_gain");
      if (shard.ownerId) {
        updateOnboardingProgress(shard.ownerId, { trained: true });
      }

      if (data.shard && onXpGain) {
        if (data.shard.level > shard.level) {
          playSfx("level_up");
          triggerCelebration("level_up");
        }
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
    <div className="relative flex h-[500px] flex-col overflow-hidden border border-siphon-teal/30 bg-[#071123]/90">
      <div className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(106,245,214,0.06) 1px, transparent 1px), linear-gradient(0deg, rgba(106,245,214,0.06) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      {/* Header */}
      <div className="relative flex items-center gap-3 border-b border-siphon-teal/20 p-4">
        <div
          className="h-8 w-8 flex items-center justify-center text-lg border"
          style={{
            backgroundColor: color + "20",
            color: color,
            boxShadow: `0 0 10px ${color}30`,
            borderColor: `${color}70`,
          }}
        >
          {["◈", "◇", "▣", "✦", "⬡", "⚖", "⛨", "◐"][shard.type] ?? "◈"}
        </div>
        <div>
          <h3 className="font-semibold text-foam">{shard.name}</h3>
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
      <div ref={scrollRef} className="relative flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-8 text-center text-ghost">
            <p>Begin training with {shard.name}.</p>
            <p className="text-xs mt-1">
              Each interaction earns XP and strengthens your bond.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={`flex reveal-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animationDelay: `${Math.min(idx * 28, 220)}ms` }}
          >
            <div
              className={`max-w-[80%] border px-4 py-2.5 ${
                msg.role === "user"
                  ? "border-siphon-teal/35 bg-siphon-teal/14 text-foam"
                  : "border-ghost/15 bg-[#061020] text-foam"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.xp_gained ? (
                <span className="mt-1 inline-block border border-siphon-teal/35 bg-siphon-teal/12 px-2 py-0.5 text-xs text-siphon-teal animate-[hud-flicker_2.5s_steps(1)_infinite]">
                  +{msg.xp_gained} XP
                </span>
              ) : null}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="border border-ghost/15 bg-[#061020] px-4 py-2.5">
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
      <div className="relative border-t border-siphon-teal/20 p-4">
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
