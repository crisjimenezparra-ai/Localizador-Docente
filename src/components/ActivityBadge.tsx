import React from 'react';
import { getActivityCategoryStyles } from '../utils/activityStyles';

interface ActivityBadgeProps {
  tipo: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showDot?: boolean;
  customLabel?: string;
}

export const ActivityBadge: React.FC<ActivityBadgeProps> = ({
  tipo,
  className = '',
  size = 'md',
  showDot = false,
  customLabel,
}) => {
  const styles = getActivityCategoryStyles(tipo);

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px] gap-1'
      : size === 'sm'
      ? 'px-2 py-0.5 text-xs gap-1.5'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold gap-2'
      : 'px-2.5 py-1 text-xs font-semibold gap-1.5';

  const displayLabel = customLabel || styles.labelUpper;

  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-full border whitespace-nowrap tracking-wide transition-colors ${sizeClasses} ${styles.badgeBgClass} ${styles.badgeBorderClass} ${styles.badgeTextClass} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${styles.dotClass} shrink-0`} />}
      <span>{displayLabel}</span>
    </span>
  );
};

