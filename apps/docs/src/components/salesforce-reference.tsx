import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export interface SalesforceReferenceProps {
  readonly href: string;
  readonly title: string;
  readonly children?: ReactNode;
}

export function SalesforceReference({
  href,
  title,
  children,
}: SalesforceReferenceProps) {
  return (
    <aside className="my-6 rounded-lg border bg-fd-card p-4 text-sm">
      <div className="mb-1 font-medium text-fd-foreground">
        Salesforce reference
      </div>
      <a
        className="inline-flex items-center gap-1.5 font-medium text-fd-primary underline decoration-fd-primary/30 underline-offset-4 hover:decoration-fd-primary"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {title}
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
      {children ? (
        <div className="mt-2 text-fd-muted-foreground leading-relaxed">
          {children}
        </div>
      ) : null}
    </aside>
  );
}
