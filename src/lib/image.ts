/**
 * Larguras permitidas pelo otimizador de imagens da Vercel.
 * Devem ser idênticas a `images.sizes` em vercel.json.
 */
export type ImageWidth = 64 | 128 | 640 | 1080;

/**
 * Retorna a URL da imagem redimensionada (WebP, com cache na CDN) pelo
 * otimizador de imagens da Vercel. As capas originais têm em média ~250 KB
 * (algumas passam de 1 MB), o que pesa muito em pins de mapa e cards.
 *
 * Em desenvolvimento o endpoint `/_vercel/image` não existe, então a URL
 * original é usada.
 */
export function optimizedImageUrl(url: string, width: ImageWidth, quality = 75): string {
  if (import.meta.env.DEV) return url;
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}
