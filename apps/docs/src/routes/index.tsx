import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="max-w-2xl">
          <p className="mb-3 font-medium text-fd-muted-foreground text-sm">Kysoql</p>
          <h1 className="mb-5 font-semibold text-4xl tracking-tight sm:text-5xl">
            Salesforce queries, checked by TypeScript.
          </h1>
          <p className="text-fd-muted-foreground text-lg leading-relaxed">
            Generate types from your org, compose SOQL with an immutable builder,
            and execute through native REST or compile for Apex.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/docs/$"
            params={{ _splat: "getting-started/quickstart" }}
            className="rounded-lg bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground text-sm"
          >
            Follow the quickstart
          </Link>
          <Link
            to="/docs/$"
            params={{ _splat: "reference/api" }}
            className="rounded-lg border px-4 py-2 font-medium text-sm"
          >
            Browse the API reference
          </Link>
          <Link
            to="/docs/$"
            params={{ _splat: "" }}
            className="rounded-lg px-4 py-2 font-medium text-sm underline underline-offset-4"
          >
            Documentation overview
          </Link>
        </div>
        <pre className="overflow-x-auto rounded-xl border bg-fd-card p-5 text-sm leading-relaxed">
          <code>{`const query = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "like", "Acme%")
  .limit(25);

const { soql } = query.compile();`}</code>
        </pre>
        <p className="max-w-2xl text-fd-muted-foreground text-sm leading-relaxed">
          Use your generated Salesforce schema. Compile without a connection;
          add an executor when you are ready to query your org.
        </p>
      </main>
    </HomeLayout>
  );
}
