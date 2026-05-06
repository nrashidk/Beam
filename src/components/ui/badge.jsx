import React from 'react';
import { cn } from '../../lib/utils';

export const Badge = ({
  className,
  wrapperClassName,
  variant = 'default',
  ...props
}) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className={cn('w-full max-w-[110px] mx-[unset]', wrapperClassName)}>
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          variants[variant],
          className
        )}
        {...props}
      />
    </div>
  );
};
