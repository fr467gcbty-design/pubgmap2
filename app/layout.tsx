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
  title: "낙하산 도우미",
  description: "비행기 경로와 도착지점을 찍어 낙하 지점을 계산합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}

        {/* ✅ Flaticon 출처 표기 (공통 푸터) */}
        <footer
          style={{
            padding: "12px 16px",
            fontSize: 12,
            opacity: 0.8,
            textAlign: "center",
          }}
        >
          <a
            href="https://www.flaticon.com/kr/free-icons/"
            title="낙하산 아이콘"
            target="_blank"
            rel="noreferrer"
          >
            낙하산 아이콘 제작자: Freepik - Flaticon
          </a>
        </footer>
      </body>
    </html>
  );
}
