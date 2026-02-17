import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Siphon Protocol" }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
