import { ContactForm } from "./ContactForm";

export default function MypageContactPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1
        className="mb-6 text-xl font-semibold"
        style={{ color: "var(--fg)" }}
      >
        お問い合わせ
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--fg-muted)" }}>
        ご質問・ご要望は以下のフォームからお送りください。内容を確認のうえ、ご登録のメールアドレスへ返信いたします。
      </p>
      <ContactForm />
    </div>
  );
}
