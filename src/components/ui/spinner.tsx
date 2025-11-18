import { Loader2Icon } from 'lucide-react';
import { cn } from '~/lib/utils';

import type { LucideProps } from 'lucide-react';
type SpinnerVariantProps = Omit<SpinnerProps, 'variant'>;

const Ring = ({ size = 24, className, ...props }: SpinnerVariantProps) => (
  <svg
    height={size}
    stroke="currentColor"
    viewBox="0 0 44 44"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <title>Loading...</title>
    <g fill="none" fillRule="evenodd" strokeWidth="2">
      <circle cx="22" cy="22" r="1">
        <animate
          attributeName="r"
          begin="0s"
          calcMode="spline"
          dur="1.8s"
          keySplines="0.165, 0.84, 0.44, 1"
          keyTimes="0; 1"
          repeatCount="indefinite"
          values="1; 20"
        />
        <animate
          attributeName="stroke-opacity"
          begin="0s"
          calcMode="spline"
          dur="1.8s"
          keySplines="0.3, 0.61, 0.355, 1"
          keyTimes="0; 1"
          repeatCount="indefinite"
          values="1; 0"
        />
      </circle>
      <circle cx="22" cy="22" r="1">
        <animate
          attributeName="r"
          begin="-0.9s"
          calcMode="spline"
          dur="1.8s"
          keySplines="0.165, 0.84, 0.44, 1"
          keyTimes="0; 1"
          repeatCount="indefinite"
          values="1; 20"
        />
        <animate
          attributeName="stroke-opacity"
          begin="-0.9s"
          calcMode="spline"
          dur="1.8s"
          keySplines="0.3, 0.61, 0.355, 1"
          keyTimes="0; 1"
          repeatCount="indefinite"
          values="1; 0"
        />
      </circle>
    </g>
  </svg>
);

const Default = ({ className, ...props }: SpinnerVariantProps) => (
  <Loader2Icon
    role="status"
    aria-label="Loading"
    className={cn("size-4 animate-spin", className)}
    {...props}
  />
);

export type SpinnerProps = LucideProps & {
  variant?: 'default' | 'ring';
  size?: number;
};

export function Spinner({ variant = 'default', size, className, ...props }: SpinnerProps) {
  switch (variant) {
    case 'ring':
      return <Ring size={size} className={className} {...props} />;
    default:
      return <Default className={className} {...props} />;
  }
}
