import type { Metadata } from "next";
import "./globals.css";
import AppNav from "@/components/AppNav";

export const metadata: Metadata = {
  title: "Pitch Planner",
  description: "Design custom training pitch shapes with live RPA feedback for women's football",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        <AppNav />
        {children}
      </body>
    </html>
  );
}
