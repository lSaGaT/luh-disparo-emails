import type { NextConfig } from "next";

// O painel é intencionalmente embeddável em iframe (link de preview servido
// em contexto cross-site). Para restringir quem pode emoldurá-lo, defina
// PREVIEW_ORIGINS="https://a.exemplo.com,https://b.exemplo.com" — sem a
// variável, nenhum frame-ancestors é emitido (comportamento permissivo atual).
const previewOrigins = (process.env.PREVIEW_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

if (previewOrigins.length > 0) {
  securityHeaders.push({
    key: "Content-Security-Policy",
    value: `frame-ancestors 'self' ${previewOrigins.join(" ")}`,
  });
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
