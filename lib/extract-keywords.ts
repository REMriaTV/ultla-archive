const SYSTEM_PROMPT = `あなたはスライド資料のキーワード抽出の専門家です。
与えられたタイトルとテキストから、検索・分類に有用なキーワードを5〜15個抽出してください。
- 日本語のキーワードを優先
- 固有名詞、専門用語、テーマに関連する語を含める
- カンマ区切りで、余分な説明なしにキーワードのみを返してください
- 重複や類似語は避ける`;

function parseKeywords(content: string): string[] {
  return content
    .split(/[,、，]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length < 50);
}

/**
 * PDFテキストとタイトルからキーワードを自動抽出
 * ANTHROPIC_API_KEY（Claude）または OPENAI_API_KEY のいずれかが必要
 * Claude を優先、未設定なら OpenAI を使用
 */
export async function extractKeywordsWithAI(
  title: string,
  pdfText: string
): Promise<string[] | null> {
  const textSample = pdfText.slice(0, 4000).trim();
  if (!title.trim() && !textSample) return null;

  const userContent = textSample
    ? `タイトル: ${title}\n\nテキスト（抜粋）:\n${textSample}`
    : `タイトル: ${title}\n\n（PDFにテキストが含まれていません。タイトルからキーワードを抽出してください）`;

  // Claude (Anthropic) を優先
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: anthropicKey });

      const message = await client.messages.create({
        max_tokens: 1024,
        model: "claude-sonnet-4-20250514",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      const content = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
      if (content) return parseKeywords(content);
    } catch (err) {
      console.warn("Claude keyword extraction failed:", err);
    }
  }

  // OpenAI にフォールバック
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: openaiKey });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (content) return parseKeywords(content);
    } catch (err) {
      console.warn("OpenAI keyword extraction failed:", err);
    }
  }

  return null;
}
