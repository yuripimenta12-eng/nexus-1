// O otimizador de imagens do Next só aceita o nosso armazenamento (ver
// next.config.mjs). Imagem de qualquer outro endereço aparece direto, sem
// passar por ele — assim ninguém usa o Nexus para baixar imagens alheias, e
// uma URL inesperada não quebra a tela.
export function imagemOtimizavel(src: string | null | undefined) {
  if (!src) return false;
  return src.startsWith('/') || src.startsWith('https://arquivos.nexuslink.art/') || /^http:\/\/localhost[:/]/.test(src);
}
