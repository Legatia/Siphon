import { useEffect, useState } from "react";
import { getConfig, saveConfig, type KeeperConfig } from "@/hooks/useTauri";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [config, setConfig] = useState<KeeperConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch((e) => toast.error(`Failed to load config: ${e}`));
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      await saveConfig(config);
      toast.success("Configuration saved");
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center text-ghost">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-siphon-teal/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold glow-text">Settings</h1>
          <p className="text-ghost text-sm mt-1">
            Configure your keeper node and LLM provider
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-siphon-teal/20 text-siphon-teal rounded-lg border border-siphon-teal/30 hover:bg-siphon-teal/30 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-ghost uppercase tracking-wider mb-3">
            LLM Inference
          </h2>
          <div className="space-y-3">
            <Field
              label="Provider"
              value={config.inference_provider}
              onChange={(v) => setConfig({ ...config, inference_provider: v })}
              placeholder="openai, ollama, or custom"
            />
            <Field
              label="API Key"
              value={config.openai_api_key ?? ""}
              onChange={(v) => setConfig({ ...config, openai_api_key: v || null })}
              placeholder="sk-..."
              type="password"
            />
            <Field
              label="Inference URL"
              value={config.inference_url}
              onChange={(v) => setConfig({ ...config, inference_url: v })}
              placeholder="https://api.openai.com/v1/chat/completions"
            />
            <Field
              label="Model"
              value={config.inference_model}
              onChange={(v) => setConfig({ ...config, inference_model: v })}
              placeholder="gpt-4o-mini"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-ghost uppercase tracking-wider mb-3">
            Network
          </h2>
          <div className="space-y-3">
            <Field
              label="RPC URL"
              value={config.rpc_url}
              onChange={(v) => setConfig({ ...config, rpc_url: v })}
              placeholder="https://sepolia.base.org"
            />
            <Field
              label="HTTP API Port"
              value={String(config.http_port)}
              onChange={(v) => setConfig({ ...config, http_port: parseInt(v) || 3001 })}
              placeholder="3001"
            />
            <Field
              label="P2P Listen Port"
              value={String(config.listen_port)}
              onChange={(v) => setConfig({ ...config, listen_port: parseInt(v) || 9000 })}
              placeholder="9000"
            />
            <Field
              label="Keeper API Key"
              value={config.api_key ?? ""}
              onChange={(v) => setConfig({ ...config, api_key: v || null })}
              placeholder="Bearer token for keeper HTTP API"
              type="password"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-ghost uppercase tracking-wider mb-3">
            Storage &amp; Identity
          </h2>
          <div className="space-y-3">
            <Field
              label="Data Directory"
              value={config.data_dir}
              onChange={(v) => setConfig({ ...config, data_dir: v })}
              placeholder="~/.siphon/data"
            />
            <Field
              label="Private Key Path"
              value={config.private_key_path}
              onChange={(v) => setConfig({ ...config, private_key_path: v })}
              placeholder="~/.siphon/keeper.key"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-ghost uppercase tracking-wider mb-3">
            Contracts
          </h2>
          <div className="space-y-3">
            <Field
              label="ShardRegistry Address"
              value={config.shard_registry_address ?? ""}
              onChange={(v) => setConfig({ ...config, shard_registry_address: v || null })}
              placeholder="0x..."
            />
            <Field
              label="KeeperStaking Address"
              value={config.keeper_staking_address ?? ""}
              onChange={(v) => setConfig({ ...config, keeper_staking_address: v || null })}
              placeholder="0x..."
            />
            <Field
              label="ShardValuation Address"
              value={config.shard_valuation_address ?? ""}
              onChange={(v) => setConfig({ ...config, shard_valuation_address: v || null })}
              placeholder="0x..."
            />
            <Field
              label="LoanVault Address"
              value={config.loan_vault_address ?? ""}
              onChange={(v) => setConfig({ ...config, loan_vault_address: v || null })}
              placeholder="0x..."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-ghost mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-midnight/60 border border-siphon-teal/20 rounded-lg px-3 py-2 text-sm text-foam placeholder:text-ghost/40 focus:outline-none focus:border-siphon-teal/50"
      />
    </div>
  );
}
