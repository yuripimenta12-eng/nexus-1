'use client';

import Image from 'next/image';
import { imagemOtimizavel } from '@/lib/imagem';
import { cn, getInitials } from '@/lib/utils';
import { Moldura } from '@/components/nex/itens-visuais';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, { wrapper: string; text: string; anel: number }> = {
  xs: { wrapper: 'w-6 h-6', text: 'text-[10px]', anel: 2 },
  sm: { wrapper: 'w-8 h-8', text: 'text-xs', anel: 2 },
  md: { wrapper: 'w-10 h-10', text: 'text-sm', anel: 3 },
  lg: { wrapper: 'w-12 h-12', text: 'text-base', anel: 3 },
  xl: { wrapper: 'w-16 h-16', text: 'text-xl', anel: 4 },
};

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
  /** Moldura da loja Nex equipada pela pessoa (id do catálogo) */
  moldura?: string | null;
}

export function Avatar({ src, name, size = 'md', className, moldura }: AvatarProps) {
  const { wrapper: tamanho, text, anel } = SIZES[size];
  // Com moldura, o tamanho (e um className que o mude) fica no contêiner; a foto o preenche
  const wrapper = moldura ? 'w-full h-full' : tamanho;

  const foto = src ? (
    <div className={cn('rounded-full overflow-hidden shrink-0', wrapper, !moldura && className)}>
      <Image src={src} alt={name} width={64} height={64} className="w-full h-full object-cover" unoptimized={!imagemOtimizavel(src)} />
    </div>
  ) : (
    <div
      className={cn(
        'rounded-full shrink-0 flex items-center justify-center font-semibold bg-accent text-white',
        wrapper,
        text,
        !moldura && className,
      )}
    >
      {getInitials(name)}
    </div>
  );

  if (!moldura) return foto;
  return (
    <div className={cn('relative shrink-0', tamanho, className)}>
      {foto}
      <Moldura id={moldura} espessura={anel} />
    </div>
  );
}
