import Link from "next/link";

type Item = {
  invite_code_id: string;
  name: string;
  code: string;
  expires_at: string;
  created_at: string;
};

export function InviteCodeList(props: { items: Item[] }) {
  const { items } = props;
  if (items.length === 0) {
    return (
      <p
        className="rounded-xl border border-dashed p-6 text-center text-sm"
        style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
      >
        まだ招待コードは登録されていません。上で追加できます。
      </p>
    );
  }

  return (
    <ul
      className="rounded-xl border"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {items.map((item, i) => (
        <li
          key={item.invite_code_id}
          className="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <Link
              href={`/invite-series/${encodeURIComponent(item.code)}`}
              className="font-medium hover:opacity-90"
              style={{ color: "var(--fg)" }}
            >
              {item.name}
            </Link>
            <span
              className="ml-2 text-xs"
              style={{ color: "var(--fg-muted)" }}
            >
              {item.code}
            </span>
          </div>
          <span
            className="text-xs"
            style={{ color: "var(--fg-muted)" }}
            title={new Date(item.expires_at).toLocaleString("ja-JP")}
          >
            有効期限: {new Date(item.expires_at).toLocaleDateString("ja-JP")}
          </span>
        </li>
      ))}
    </ul>
  );
}
