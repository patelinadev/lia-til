import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lia · Today I Learn",
  description: "Lia's daily learning progress — publicly visible.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Discreet private-area entry: click → /private → GitHub auth if not signed in. */}
        <a
          href="/private"
          aria-label="Private area"
          title="Private area"
          className="fixed right-4 top-3 z-50 text-sm opacity-30 transition-opacity hover:opacity-100"
        >
          🔒
        </a>
        {children}
        <footer className="px-6 py-6 text-center text-[11px] text-neutral-300 dark:text-neutral-700">
          Developed by{" "}
          <a
            href="https://github.com/patelinadev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Lia
          </a>
        </footer>
      </body>
    </html>
  );
}
