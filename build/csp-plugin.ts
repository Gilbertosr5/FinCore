import { createHash } from 'node:crypto';

import type { Plugin } from 'vite';

/**
 * Content Security Policy do build de produção (ADR 0014), injetada como
 * <meta http-equiv> no index.html. Não é aplicada no servidor de
 * desenvolvimento (o HMR do Vite usa scripts inline).
 *
 * - Scripts: só da própria origem + o script inline de tema, liberado por hash
 *   SHA-256 calculado aqui (nunca 'unsafe-inline' para scripts).
 * - Estilos: 'unsafe-inline' é necessário para atributos style (barras de
 *   progresso, gráficos do Recharts, posicionamento do Radix).
 * - connect-src: a própria origem e, se a API estiver em outra origem, a de
 *   VITE_API_BASE_URL.
 * - frame-ancestors, HSTS e upgrade para HTTPS não funcionam (ou não convêm) via <meta>: devem vir como headers
 *   do servidor que hospedar o build (ver docs/seguranca.md).
 */
export function contentSecurityPolicy(options: { apiBaseUrl?: string }): Plugin {
  return {
    name: 'fincore-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        (match) => match[1] ?? '',
      );
      const hashes = inlineScripts.map(
        (content) => `'sha256-${createHash('sha256').update(content).digest('base64')}'`,
      );
      const connect = ["'self'"];
      const api = options.apiBaseUrl ? safeOrigin(options.apiBaseUrl) : null;
      if (api) connect.push(api);

      const policy = [
        "default-src 'self'",
        `script-src 'self' ${hashes.join(' ')}`.trim(),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        `connect-src ${connect.join(' ')}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "worker-src 'none'",
      ].join('; ');

      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
            injectTo: 'head-prepend',
          },
          {
            tag: 'meta',
            attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' },
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

/** Origem absoluta (http/https) da URL; null para caminhos relativos ("/api/v1"). */
function safeOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
  } catch {
    return null;
  }
}
