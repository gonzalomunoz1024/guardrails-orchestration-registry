import { Clock } from 'lucide-react';
import { cn } from '@/utils';

interface ComingSoonBannerProps {
  message: string;
  variant?: 'info' | 'warning';
  className?: string;
}

export function ComingSoonBanner({
  message,
  variant = 'info',
  className,
}: ComingSoonBannerProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] p-4 border',
        variant === 'info'
          ? 'bg-[var(--color-info-bg)] border-[var(--color-info)]/20'
          : 'bg-[var(--color-warning-bg)] border-[var(--color-warning)]/20',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Clock
          className={cn(
            'w-5 h-5 flex-shrink-0 mt-0.5',
            variant === 'info' ? 'text-[var(--color-info)]' : 'text-[var(--color-warning)]'
          )}
        />
        <div>
          <p
            className={cn(
              'font-medium text-sm',
              variant === 'info' ? 'text-[var(--color-info)]' : 'text-[var(--color-warning)]'
            )}
          >
            Coming Soon
          </p>
          <p
            className={cn(
              'text-sm mt-1',
              variant === 'info'
                ? 'text-[var(--color-text-secondary)]'
                : 'text-[var(--color-text-secondary)]'
            )}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
