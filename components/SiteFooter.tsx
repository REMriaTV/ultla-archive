"use client";

import { useEffect, useState } from "react";

const DEFAULT_FOOTER_TEXT = "SPACE ARCHIVE — いつでも、どこでも、学びのレシピ";

export function SiteFooter() {
  const [footerText, setFooterText] = useState(DEFAULT_FOOTER_TEXT);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.footer_text === "string") {
          setFooterText(data.footer_text);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <footer
      className="mt-auto border-t py-8"
      style={{ borderColor: "var(--border)" }}
    >
      <div
        className="mx-auto max-w-4xl px-6 text-center text-sm"
        style={{ color: "var(--fg-muted)" }}
      >
        {footerText}
      </div>
    </footer>
  );
}
