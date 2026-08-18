'use client';

import Image from 'next/image';
import { cn, getInitials } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, { wrapper: string; text: string }> = {
  xs: { wrapper: 'w-6 h-6', text: 'text-[10px]' },
  sm: { wrapper: 'w-8 h-8', text: 'text-xs' },
  md: { wrapper: 'w-10 h-10', text: 'text-sm' },
  lg: { wrapper: 'w-12 h-12', text: 'text-base' },
  xl: { wrapper: 'w-16 h-16', text: 'text-xl' },
};

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const { wrapper, text } = SIZES[size];

  if (src) {
    return (
      <div className={cn('rounded-full overflow-hidden shrink-0', wrapper, className)}>
        <Image src={src} alt={name} width={64} height={64} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full shrink-0 flex items-center justify-center font-semibold bg-accent text-white',
        wrapper,
        text,
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
