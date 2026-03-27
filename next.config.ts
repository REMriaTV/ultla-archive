import type { NextConfig } from "next";

const proxyClientMaxBodySize = process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE ?? "250mb";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    /**
     * 管理画面のPDFアップロード（create / extract-caption / extract-keywords）向け。
     * Next.js 16 では middlewareClientMaxBodySize は非推奨のため、proxyClientMaxBodySize を使う。
     */
    proxyClientMaxBodySize,
  } as NextConfig["experimental"] & Record<string, unknown>,
};

export default nextConfig;
