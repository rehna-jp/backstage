"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import Image from "next/image";
import { useAccount } from "wagmi";

export function NavBar() {
  const { isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-40 border-b border-[--color-border-subtle] bg-[--color-background]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Image src="/logo.png" alt="Backstage" width={36} height={36} className="rounded-lg" />
          <span
            className="text-lg font-bold tracking-tight text-[--color-text-primary] hidden sm:block"
            style={{ fontFamily: "var(--font-space-grotesk)", letterSpacing: "0.06em" }}
          >
            BACKSTAGE
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/verify"
            className="hidden sm:block text-sm text-[--color-text-muted] hover:text-[--color-text-primary] px-3 py-2 rounded-lg hover:bg-[--color-surface-2] transition-all"
          >
            Verify License
          </Link>

          {isConnected && (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:block text-sm text-[--color-text-muted] hover:text-[--color-text-primary] px-3 py-2 rounded-lg hover:bg-[--color-surface-2] transition-all"
              >
                Dashboard
              </Link>
              <Link
                href="/upload"
                className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all"
                style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", boxShadow: "0 0 16px rgb(59 130 246 / 0.3)" }}
              >
                + Publish
              </Link>
            </>
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
