interface Props {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

export function Badge({ children, variant = 'default' }: Props) {
  const variantClasses = {
    default: 'bg-surface-alt text-text-secondary border-border',
    primary: 'bg-neon/10 text-neon border-neon/25',
    success: 'bg-grade-a/10 text-grade-a border-grade-a/25',
    warning: 'bg-grade-c/10 text-grade-c border-grade-c/25',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
