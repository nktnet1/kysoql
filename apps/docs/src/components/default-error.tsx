import { useRouter } from "@tanstack/react-router";

export function DefaultErrorComponent({ error }: { error: unknown }) {
  const router = useRouter();

  const isNetworkError =
    error instanceof TypeError && /network|fetch/i.test(error.message);

  if (isNetworkError) {
    return (
      <main className="flex min-h-dvh items-center bg-fd-background px-4 py-8 text-fd-foreground sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-3xl">
          <section className="overflow-hidden rounded-2xl border border-fd-border bg-fd-card shadow-lg sm:rounded-3xl">
            <div className="p-5 sm:p-8 lg:p-10">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 sm:size-12 sm:rounded-2xl dark:text-amber-400">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="size-5 sm:size-6"
                  >
                    <path
                      d="M12 9v4m0 4h.01M10.3 4.5 3.7 16a2 2 0 0 0 1.73 3h13.14a2 2 0 0 0 1.73-3L13.7 4.5a2 2 0 0 0-3.4 0Z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-amber-600 text-sm dark:text-amber-400">
                    Connection lost
                  </p>

                  <h1 className="mt-1 text-balance font-semibold text-2xl tracking-tight sm:text-3xl lg:text-4xl">
                    Unable to reach the server
                  </h1>

                  <p className="mt-3 max-w-2xl text-pretty text-fd-muted-foreground text-sm leading-6 sm:text-base sm:leading-7">
                    The app couldn’t complete a network request. Check your
                    connection or make sure the server is running, then try
                    again.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={() => router.invalidate()}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-fd-primary px-4 py-2.5 font-medium text-fd-primary-foreground text-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
                >
                  Try again
                </button>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-fd-border bg-fd-secondary px-4 py-2.5 font-medium text-fd-secondary-foreground text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
                >
                  Reload page
                </button>
              </div>

              <div
                className={
                  import.meta.env.DEV
                    ? "mt-6 grid gap-3 sm:mt-8 md:grid-cols-2 md:gap-4"
                    : "mt-6 sm:mt-8"
                }
              >
                <InfoCard title="Things to check">
                  <ul className="space-y-3 text-fd-muted-foreground text-sm leading-6">
                    <CheckItem>Check your internet connection.</CheckItem>
                    <CheckItem>
                      Make sure the server or API is running.
                    </CheckItem>
                    <CheckItem>
                      Check the browser console for network errors.
                    </CheckItem>
                    <CheckItem>
                      Once the service is available again, click “Try again”.
                    </CheckItem>
                  </ul>
                </InfoCard>

                {import.meta.env.DEV && (
                  <InfoCard title="Development">
                    <p className="mb-3 text-fd-muted-foreground text-sm leading-6">
                      If you stopped the local dev server, restart it and retry
                      the request.
                    </p>

                    <div className="space-y-2">
                      <CodeHint command="pnpm dev" />
                    </div>
                  </InfoCard>
                )}
              </div>

              <ErrorDetails error={error} />
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center bg-fd-background px-4 py-8 text-fd-foreground sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <section className="rounded-2xl border border-fd-border bg-fd-card p-5 shadow-lg sm:rounded-3xl sm:p-8 lg:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 sm:size-12 sm:rounded-2xl dark:text-red-400">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="size-5 sm:size-6"
              >
                <path
                  d="M12 8v5m0 3h.01M5.64 5.64a9 9 0 1 0 12.72 0 9 9 0 0 0-12.72 0Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-medium text-red-600 text-sm dark:text-red-400">
                Unexpected application error
              </p>

              <h1 className="mt-1 text-balance font-semibold text-2xl tracking-tight sm:text-3xl lg:text-4xl">
                Something went wrong
              </h1>

              <p className="mt-3 max-w-2xl text-pretty text-fd-muted-foreground text-sm leading-6 sm:text-base sm:leading-7">
                The app encountered an unexpected error. Try the request again,
                or reload the page if the problem persists.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-3 sm:mt-8 sm:p-4">
            <pre className="wrap-break-word max-h-80 overflow-auto whitespace-pre-wrap font-mono text-red-700 text-xs leading-5 dark:text-red-300">
              {error instanceof Error
                ? (error.stack ?? error.message)
                : String(error)}
            </pre>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={() => router.invalidate()}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-fd-primary px-4 py-2.5 font-medium text-fd-primary-foreground text-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
            >
              Try again
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-fd-border bg-fd-secondary px-4 py-2.5 font-medium text-fd-secondary-foreground text-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
            >
              Reload page
            </button>
          </div>

          {import.meta.env.DEV && (
            <div className="mt-6">
              <ErrorDetails error={error} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-fd-border bg-fd-background/50 p-4 sm:p-5">
      <h2 className="mb-3 font-semibold text-sm">{title}</h2>
      {children}
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-fd-muted-foreground/60" />
      <span>{children}</span>
    </li>
  );
}

function CodeHint({ command }: { command: string }) {
  return (
    <code className="wrap-break-word block rounded-lg border border-fd-border bg-fd-muted px-3 py-2.5 font-mono text-fd-foreground text-xs">
      {command}
    </code>
  );
}

function ErrorDetails({ error }: { error: unknown }) {
  return (
    <div className="mt-6 rounded-xl border border-fd-border bg-fd-muted/50 p-3 sm:p-4">
      <p className="font-medium text-fd-muted-foreground text-xs uppercase tracking-[0.16em]">
        Error
      </p>

      <p className="wrap-break-word mt-2 font-mono text-fd-muted-foreground text-xs leading-5">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  );
}
