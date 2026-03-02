import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { Sidebar } from "@/components/nav/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Polymarket Bot",
  description: "Autonomous AI trading bot for Polymarket",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ConvexClientProvider>
          <Sidebar />
          <main className="min-h-screen pl-0 lg:pl-64">
            <div className="p-4 pt-16 lg:pt-4">
              {children}
            </div>
          </main>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
