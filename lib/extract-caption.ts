const SYSTEM_PROMPT = `あなたはスライド資料の要約の専門家です。
与えられたタイトルとテキストから、2行以内の簡潔なキャプションを作成してください。
- 日本語で、50文字以内
- スライドの内容を一言で伝える
- 余分な説明や改行は不要。1〜2文で返してください`;

/**
 * PDFテキストとタイトルからキャプションを自動作成
 * ANTHROPIC_API_KEY（Claude）または OPENAI_API_KEY のいずれかが必要
 */
export async function extractCaptionWithAI(
  title: string,
  pdfText: string
): Promise<string | null> {
  const textSample = pdfText.slice(0, 4000).trim();
  if (!title.trim() && !textSample) return null;

  const userContent = textSample
    ? `タイトル: ${title}\n\nテキスト（抜粋）:\n${textSample}`
    : `タイトル: ${title}\n\n（PDFにテキストが含まれていません。タイトルからキャプションを作成してください）`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: anthropicKey });

      const message = await client.messages.create({
        max_tokens: 256,
        model: "claude-sonnet-4-20250514",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      const content = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
      if (content) return content.replace(/\n+/g, " ").slice(0, 100);
    } catch (err) {
      console.warn("Claude caption extraction failed:", err);
    }
  }

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
      if (content) return content.replace(/\n+/g, " ").slice(0, 100);
    } catch (err) {
      console.warn("OpenAI caption extraction failed:", err);
    }
  }

  return null;
}
