'use client';

// Tela vazia com o mascote flutuando + convite (no lugar de um texto cinza solto)
export function EmptyState({
  image = '/mascote-conta.webp',
  title,
  text,
  actionLabel,
  onAction,
}: {
  image?: string;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-center sm:text-left px-4 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        draggable={false}
        className="h-[150px] sm:h-[180px] w-auto select-none"
        style={{
          filter: 'drop-shadow(0 12px 30px rgba(122,44,255,0.45))',
          animation: 'nx-flutua 3s ease-in-out infinite',
        }}
      />
      <div className="max-w-[300px]">
        <h3 className="text-white font-bold text-xl mb-1.5 leading-snug">{title}</h3>
        <p className="text-[#afa4bb] text-sm leading-relaxed mb-4">{text}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff]
                       hover:-translate-y-0.5 active:scale-95 transition-transform shadow-[0_8px_24px_rgba(122,44,255,0.3)]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
