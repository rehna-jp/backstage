"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useAccount } from "wagmi";

export function NavBar() {
  const { isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-40 border-b border-[--color-border] bg-[--color-background]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-[--color-text-primary]"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Backstage
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/verify"
            className="text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
          >
            Verify License
          </Link>
          {isConnected && (
            <Link
              href="/dashboard"
              className="text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
            >
              Dashboard
            </Link>
          )}
          <ConnectButton
            showBalance={false}
            chainStatus="none"
            accountStatus="avatar"
          />
        </nav>
      </div>
    </header>
  );
}
