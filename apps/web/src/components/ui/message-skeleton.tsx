'use client';

// Silhuetas brilhantes no lugar das mensagens enquanto carregam
// (mostra o "formato" da conversa em vez de uma tela parada)
const ROWS = [
  { name: 28, lines: [82, 46] },
  { name: 20, lines: [60] },
  { name: 34, lines: [74, 88, 30] },
  { name: 24, lines: [52] },
  { name: 30, lines: [68, 40] },
];

export function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-5 py-2" aria-label="Carregando mensagens" role="status">
      {ROWS.map((r, i) => (
        <div key={i} className="flex gap-3" style={{ opacity: 1 - i * 0.14 }}>
          <div className="nx-skeleton w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 pt-1">
            <div className="nx-skeleton h-3 rounded-md mb-2.5" style={{ width: `${r.name}%` }} />
            {r.lines.map((w, j) => (
              <div key={j} className="nx-skeleton h-2.5 rounded-md mb-2" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
