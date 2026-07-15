import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "流动圈｜社区互助静态 Demo",
  description: "让需要、提供、互助额度和好人卡在不同社区里自然流动。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
