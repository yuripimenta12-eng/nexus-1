'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ScreenQuality = '720p30' | '720p60' | '1080p30' | '1080p60';
export type InputProfile = 'isolation' | 'studio' | 'custom';

interface MediaSettingsState {
  // Dispositivos ('' = padrão do sistema)
  audioInputId: string;
  audioOutputId: string;
  videoInputId: string;

  // Volumes em porcentagem
  inputVolume: number;   // 0–200 (ganho do microfone via WebAudio)
  outputVolume: number;  // 0–100 (volume global de saída)

  // Processamento de voz
  inputProfile: InputProfile;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  // Portão de ruído: silencia o mic quando não há fala (mata chiado/apito constante)
  noiseGate: boolean;

  // Compartilhamento de tela
  screenQuality: ScreenQuality;
  askScreenQuality: boolean; // perguntar qualidade antes de cada transmissão

  setAudioInputId: (id: string) => void;
  setAudioOutputId: (id: string) => void;
  setVideoInputId: (id: string) => void;
  setInputVolume: (v: number) => void;
  setOutputVolume: (v: number) => void;
  setInputProfile: (p: InputProfile) => void;
  setNoiseSuppression: (on: boolean) => void;
  setEchoCancellation: (on: boolean) => void;
  setAutoGainControl: (on: boolean) => void;
  setNoiseGate: (on: boolean) => void;
  setScreenQuality: (q: ScreenQuality) => void;
  setAskScreenQuality: (on: boolean) => void;
}

export const useMediaStore = create<MediaSettingsState>()(
  persist(
    (set) => ({
      audioInputId: '',
      audioOutputId: '',
      videoInputId: '',
      inputVolume: 100,
      outputVolume: 100,
      inputProfile: 'isolation',
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      noiseGate: true,
      screenQuality: '1080p30',
      askScreenQuality: true,

      setAudioInputId: (audioInputId) => set({ audioInputId }),
      setAudioOutputId: (audioOutputId) => set({ audioOutputId }),
      setVideoInputId: (videoInputId) => set({ videoInputId }),
      setInputVolume: (inputVolume) => set({ inputVolume }),
      setOutputVolume: (outputVolume) => set({ outputVolume }),
      // Perfis prontos: isolamento liga todo o processamento; estúdio desliga tudo
      setInputProfile: (inputProfile) => {
        if (inputProfile === 'isolation') {
          set({ inputProfile, noiseSuppression: true, echoCancellation: true, autoGainControl: true, noiseGate: true });
        } else if (inputProfile === 'studio') {
          set({ inputProfile, noiseSuppression: false, echoCancellation: false, autoGainControl: false, noiseGate: false });
        } else {
          set({ inputProfile });
        }
      },
      setNoiseSuppression: (noiseSuppression) => set({ noiseSuppression }),
      setNoiseGate: (noiseGate) => set({ noiseGate }),
      setEchoCancellation: (echoCancellation) => set({ echoCancellation }),
      setAutoGainControl: (autoGainControl) => set({ autoGainControl }),
      setScreenQuality: (screenQuality) => set({ screenQuality }),
      setAskScreenQuality: (askScreenQuality) => set({ askScreenQuality }),
    }),
    { name: 'nexus-media' },
  ),
);
