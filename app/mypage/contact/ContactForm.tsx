"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました");
        return;
      }
      setDone(true);
      setName("");
      setEmail("");
      setSubject("");
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        className="rounded-xl border p-6 text-center"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
        <p className="mb-4 font-medium" style={{ color: "var(--fg)" }}>
          送信しました。内容を確認のうえ、ご連絡いたします。
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            background: "var(--card-hover)",
            color: "var(--fg)",
          }}
        >
          もう一度送信する
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-xl border p-5"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
      }}
    >
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div>
        <label
          htmlFor="contact-name"
          className="mb-1 block text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--fg-muted)" }}
        >
          お名前 <span className="text-red-500">*</span>
        </label>
        <input
          id="contact-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
          }}
          placeholder="山田 太郎"
        />
      </div>

      <div>
        <label
          htmlFor="contact-email"
          className="mb-1 block text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--fg-muted)" }}
        >
          メールアドレス <span className="text-red-500">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
          }}
          placeholder="example@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="contact-subject"
          className="mb-1 block text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--fg-muted)" }}
        >
          件名 <span className="text-red-500">*</span>
        </label>
        <input
          id="contact-subject"
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
          }}
          placeholder="お問い合わせの件名"
        />
      </div>

      <div>
        <label
          htmlFor="contact-body"
          className="mb-1 block text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--fg-muted)" }}
        >
          お問い合わせ内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="contact-body"
          required
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full resize-y rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
          }}
          placeholder="ご質問・ご要望などをご記入ください"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{
            background: "var(--fg)",
            color: "var(--bg)",
          }}
        >
          {submitting ? "送信中…" : "送信する"}
        </button>
      </div>
    </form>
  );
}
