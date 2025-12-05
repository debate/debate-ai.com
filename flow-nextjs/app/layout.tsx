import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLOW Research Manager",
  description: "Modern citation card management for academic research and debate",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
