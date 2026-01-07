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
  title: "배그 낙하산 도우미",
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

        {/* ✅ Flaticon 출처: 좌측 하단 고정 + 아주 작은 글씨 */}
        <div
          style={{
            position: "fixed",
            left: 8,
            bottom: 8,
            zIndex: 9999,
            fontSize: "10px",
            lineHeight: 1.2,
            opacity: 0.55,
            pointerEvents: "none", // 아래 UI 클릭 방해 최소화
          }}
        >
          <a
            href="https://www.flaticon.com/kr/free-icons/"
            title="낙하산 아이콘"
            target="_blank"
            rel="noreferrer"
            style={{
              pointerEvents: "auto", // 링크는 클릭 가능하게
              textDecoration: "none",
            }}
          >
            icons made by Freepik from Flaticon~
          </a>
        </div>
      </body>
    </html>
  );
}
