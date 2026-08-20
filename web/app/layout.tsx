import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AdminNav from "./components/AdminNav";

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
        <Suspense fallback={null}>
          <AdminNav />
        </Suspense>
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
          <a href="/private" aria-label="Private area" className="ml-2 hover:underline">
            &middot;
          </a>
        </footer>
      </body>
    </html>
  );
}
