import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    /** 管理画面のPDFアップロード（キャプション・キーワード抽出）で 10MB 超のファイルを通す */
    middlewareClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
