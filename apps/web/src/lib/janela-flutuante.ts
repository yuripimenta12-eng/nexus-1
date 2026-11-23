import type { Track } from 'livekit-client';

// Janela flutuante (Picture-in-Picture do navegador): a live sai do site e fica
// por cima de qualquer programa, inclusive do jogo. Usa um <video> próprio, fora
// do React, para não fechar quando a pessoa troca de canal dentro do Nexus.
let atual: { video: HTMLVideoElement; track: Track } | null = null;

export function suportaJanelaFlutuante(): boolean {
  return typeof document !== 'undefined' && !!(document as any).pictureInPictureEnabled;
}

export function janelaFlutuanteAberta(track?: Track | null): boolean {
  return !!atual && !!document.pictureInPictureElement && (!track || atual.track === track);
}

export function fecharJanelaFlutuante() {
  if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
}

export async function abrirJanelaFlutuante(track: Track) {
  if (janelaFlutuanteAberta(track)) return fecharJanelaFlutuante(); // clicou de novo: fecha

  const video = document.createElement('video');
  video.muted = true; // o som da live continua saindo pelo áudio da chamada
  video.playsInline = true;
  video.autoplay = true;
  video.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.appendChild(video);
  track.attach(video);

  const limpar = () => {
    track.detach(video);
    video.remove();
    if (atual?.video === video) atual = null;
  };
  video.addEventListener('leavepictureinpicture', limpar, { once: true });
  // A live acabou ou a pessoa saiu da chamada: o LiveKit solta o vídeo (srcObject = null)
  video.addEventListener('emptied', () => {
    if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
    else limpar();
  }, { once: true });

  const anterior = atual;
  atual = { video, track };
  try {
    if (video.readyState < 1) {
      await new Promise<void>((ok, falha) => {
        video.addEventListener('loadedmetadata', () => ok(), { once: true });
        setTimeout(() => falha(new Error('O vídeo da live não carregou.')), 5000);
      });
    }
    // Se já havia outra live flutuando, ela recebe 'leavepictureinpicture' e se limpa sozinha
    await video.requestPictureInPicture();
  } catch (e) {
    limpar();
    if (anterior) atual = anterior;
    throw e;
  }
}
