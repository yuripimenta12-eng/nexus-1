'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Palette, X } from 'lucide-react';
import { cn, getInitials, STATUS_COLORS } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

const BANNER_SWATCHES: [string, string][] = [
  ['#ff6a00', '#7c5af0'], // Nexus
  ['#ff9345', '#ff4f79'], // Brasa
  ['#b142f5', '#7a2cff'], // Violeta
  ['#22d3ee', '#3b82f6'], // Oceano
  ['#42e6a4', '#17a9cf'], // Esmeralda
  ['#f5c542', '#f56342'], // Dourado
];

const STATUS_LABEL: Record<string, string> = {
  ONLINE: 'Online', AWAY: 'Ausente', BUSY: 'Ocupado', OFFLINE: 'Offline',
};

/**
 * Card de perfil estilo "Discord" — banner com avatar circular sobreposto.
 * Usado tanto no topo de "Minha Conta" (editável) quanto como prévia
 * de como outros usuários veem o perfil.
 */
export function ProfileCard() {
  const { user, setUser } = useAuthStore();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [error, setError] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const profile = user?.profile;
  const displayName = profile?.displayName || user?.username || 'Usuário';
  const [bFrom, bTo] = (profile?.bannerColor || '').split(',');
  const bannerGradient = bFrom && bTo ? [bFrom, bTo] : BANNER_SWATCHES[0];

  const handleAvatarPick = () => avatarInputRef.current?.click();
  const handleBannerPick = () => bannerInputRef.current?.click();

  const uploadAvatar = async (file: File) => {
    setError('');
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/upload/avatar', form);
      setUser({ ...user!, profile: { ...user!.profile!, avatarUrl: data.avatarUrl } });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao enviar a imagem');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const uploadBanner = async (file: File) => {
    setError('');
    setUploadingBanner(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/upload/banner', form);
      setUser({ ...user!, profile: { ...user!.profile!, bannerUrl: data.bannerUrl, bannerColor: null } });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao enviar o banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  const pickBannerColor = async ([from, to]: [string, string]) => {
    setShowPalette(false);
    try {
      const { data } = await api.patch('/users/@me/profile', { bannerColor: `${from},${to}` });
      setUser({ ...user!, profile: { ...user!.profile!, bannerColor: data.bannerColor, bannerUrl: null } });
    } catch { /* ok */ }
  };

  const removeBanner = async () => {
    setShowPalette(false);
    try {
      await api.delete('/users/@me/banner');
      setUser({ ...user!, profile: { ...user!.profile!, bannerUrl: null, bannerColor: null } });
    } catch { /* ok */ }
  };

  const removeAvatar = async () => {
    try {
      await api.delete('/users/@me/avatar');
      setUser({ ...user!, profile: { ...user!.profile!, avatarUrl: null } });
    } catch { /* ok */ }
  };

  return (
    <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] overflow-visible">
      {/* ── Banner ─────────────────────────────────────────── */}
      <div
        className="relative h-32 sm:h-36 rounded-t-2xl overflow-hidden group/banner"
        style={{
          background: profile?.bannerUrl
            ? undefined
            : `linear-gradient(120deg, ${bannerGradient[0]}, ${bannerGradient[1]})`,
        }}
      >
        {profile?.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover/banner:bg-black/40 transition-colors" />

        {/* Ações do banner (aparecem no hover) */}
        <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover/banner:opacity-100 transition-opacity">
          <button
            onClick={() => setShowPalette(v => !v)}
            title="Escolher cor do banner"
            className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <Palette className="w-4 h-4" />
          </button>
          <button
            onClick={handleBannerPick}
            title="Enviar imagem de banner"
            disabled={uploadingBanner}
            className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            {uploadingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          {(profile?.bannerUrl || profile?.bannerColor) && (
            <button
              onClick={removeBanner}
              title="Remover banner"
              className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur text-white flex items-center justify-center hover:bg-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Paleta de cores */}
        {showPalette && (
          <div className="absolute top-14 right-3 bg-[var(--th-panel-2)] border border-[var(--th-line-2)] rounded-xl p-2.5 shadow-2xl z-10 grid grid-cols-3 gap-2">
            {BANNER_SWATCHES.map(([from, to]) => (
              <button
                key={from}
                onClick={() => pickBannerColor([from, to])}
                className="w-9 h-9 rounded-lg border border-white/10 hover:scale-110 transition-transform"
                style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
              />
            ))}
          </div>
        )}

        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.target.value = ''; }} />
      </div>

      {/* ── Avatar sobreposto + identidade ────────────────────── */}
      <div className="px-5 sm:px-6 pb-5">
        <div className="flex items-end gap-4 -mt-10">
          <div className="relative shrink-0 group/avatar">
            <div className="w-20 h-20 rounded-full border-[5px] border-[var(--th-panel)] overflow-hidden
                            bg-gradient-to-br from-orange to-accent grid place-items-center">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl font-black">{getInitials(displayName)}</span>
              )}
            </div>
            <span
              className={cn(
                'absolute bottom-1 right-1 w-4 h-4 rounded-full border-[3px] border-[var(--th-panel)]',
                STATUS_COLORS[profile?.status || 'ONLINE'],
              )}
              title={STATUS_LABEL[profile?.status || 'ONLINE']}
            />
            <button
              onClick={handleAvatarPick}
              disabled={uploadingAvatar}
              title="Alterar foto de perfil"
              className="absolute inset-0 rounded-full bg-black/0 group-hover/avatar:bg-black/55
                         flex items-center justify-center gap-1 opacity-0 group-hover/avatar:opacity-100 transition-all"
            >
              {uploadingAvatar ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </button>
            {profile?.avatarUrl && !uploadingAvatar && (
              <button
                onClick={(e) => { e.stopPropagation(); removeAvatar(); }}
                title="Remover foto de perfil"
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white
                           flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all shadow-lg"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} />
          </div>

          <div className="min-w-0 pb-1">
            <h3 className="text-white font-bold text-lg leading-tight truncate">{displayName}</h3>
            <p className="text-[#92879f] text-sm truncate">@{user?.username}</p>
          </div>
        </div>

        {profile?.customStatus && (
          <p className="text-[#cfc6dd] text-sm mt-3 italic">"{profile.customStatus}"</p>
        )}
        {profile?.bio && (
          <p className="text-[#92879f] text-sm mt-2 leading-relaxed">{profile.bio}</p>
        )}

        {error && <p className="text-destructive text-xs mt-3">{error}</p>}
      </div>
    </div>
  );
}
