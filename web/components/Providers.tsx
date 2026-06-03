"use client";

import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi";

import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [wasmReady, setWasmReady] = useState(false);

  useEffect(() => {
    // initWasm() must run exactly once before any CDR encrypt/decrypt in the browser.
    // Dynamic import keeps it out of the SSR bundle entirely.
    import("@piplabs/cdr-sdk")
      .then(({ initWasm }) => initWasm())
      .then(() => setWasmReady(true))
      .catch((err) => {
        console.error("CDR WASM init failed:", err);
        // Allow the app to render even if WASM fails; CDR features will show an error at use time.
        setWasmReady(true);
      });
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#3b82f6",
            accentColorForeground: "white",
            borderRadius: "large",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
