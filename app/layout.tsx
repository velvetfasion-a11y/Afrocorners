import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin", "latin-ext"], variable: "--font-outfit" });
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext"], style: ["normal", "italic"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "AfroCorner – Afrikanska varor, hårvård, mat och skönhet",
  description: "Hårvård, skönhet, mat och ting för hemmet från Afrika. Butik i Fittja och Märsta, leverans i hela Sverige.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className={`${outfit.variable} ${playfair.variable} antialiased`}>{children}</body>
    </html>
  );
}
