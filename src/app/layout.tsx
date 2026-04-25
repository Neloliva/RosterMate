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
  title: "RosterMate",
  description: "The 10-minute manager — build compliant rosters in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        {children}
        <footer className="mt-8 border-t border-slate-200 bg-white px-6 py-5 text-center text-xs leading-relaxed text-slate-500">
          <p className="mx-auto max-w-3xl">
            RosterMate award calculations are indicative only. Users remain
            responsible for payroll accuracy. Consult your accountant for
            complex situations.
          </p>
        </footer>
      </body>
    </html>
  );
}
