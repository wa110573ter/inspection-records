import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "稽查案件追蹤",
  description: "私人稽查案件與現場處理紀錄",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
