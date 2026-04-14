import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-mono text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600',
        primary: 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600',
        ghost: 'text-slate-500 hover:text-blue-600 hover:bg-slate-50',
        danger: 'border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-500',
        'danger-fill': 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3',
        lg: 'h-10 px-5',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
