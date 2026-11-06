import type { ReactNode } from 'react';

interface AuthPageHeaderProps {
  title: string;
  description?: ReactNode;
}

export function AuthPageHeader({ title, description }: AuthPageHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
