import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMessageDate(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return `Hoje às ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Ontem às ${format(d, 'HH:mm')}`;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export const STATUS_LABELS: Record<string, string> = {
  ONLINE: 'Online',
  AWAY: 'Ausente',
  BUSY: 'Ocupado',
  OFFLINE: 'Offline',
};

export const STATUS_COLORS: Record<string, string> = {
  ONLINE: 'bg-online',
  AWAY: 'bg-away',
  BUSY: 'bg-busy',
  OFFLINE: 'bg-offline',
};
