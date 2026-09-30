// O app de PC (Electron, apps/desktop) acrescenta "NexusDesktop/<versão>" ao user agent
export function isDesktopApp(): boolean {
  return typeof navigator !== 'undefined' && /NexusDesktop\//.test(navigator.userAgent);
}
