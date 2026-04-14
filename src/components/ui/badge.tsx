import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 text-xs font-medium border',
  {
    variants: {
      variant: {
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        error: 'border-red-200 bg-red-50 text-red-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        info: 'border-blue-200 bg-blue-50 text-blue-700',
        neutral: 'border-slate-200 bg-slate-50 text-slate-600',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={badgeVariants({ variant, className })} {...props} />;
}
