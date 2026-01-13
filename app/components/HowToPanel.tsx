"use client";

import React, { useEffect } from "react";

export default function HowToPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // ESC로 닫기 + 바디 스크롤 잠금
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const onOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 바깥 클릭으로 닫기
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="pubg-howto-overlay is-open" onMouseDown={onOverlayMouseDown}>
      <div className="pubg-howto-panel is-open" role="dialog" aria-modal="true" aria-label="사용법">
        <div className="pubg-howto-head">
          <div className="pubg-howto-title">사용법</div>
          <button className="pubg-icon-btn" type="button" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="pubg-howto-content">
          <div className="pubg-howto-videoWrap">
            <video
              className="pubg-howto-video"
              controls
              playsInline
              preload="metadata"
            >
              {/* ✅ public/howto/howto.mp4 -> /howto/howto.mp4 */}
              <source src="/howto/howto.mp4" type="video/mp4" />
              브라우저가 video 태그를 지원하지 않습니다.
            </video>
          </div>

          <div className="pubg-howto-desc">
            <div className="pubg-howto-desc-title"></div>
            <ul className="pubg-howto-list">
              <li>인게임 맵을 켜놓고 전체화면 후 alt+tab</li>
              <li>비행기 시작/끝 지점, 낙하지점에 커서를 올려놓고 창을 바꾸면 동일한 위치에 찍을 수 있음</li>
              
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
