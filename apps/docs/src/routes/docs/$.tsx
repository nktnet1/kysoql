import {
  createFileRoute,
  Link,
  notFound,
  redirect,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { Suspense, use } from "react";
import { useMDXComponents } from "@/components/mdx";
import { baseOptions } from "@/lib/layout.shared";
import {
  appDescription,
  appName,
  getPageMarkdownUrl,
  getPageSourceUrl,
} from "@/lib/shared";
import { docs, source } from "@/lib/source";
import { staticFunctionMiddleware } from "@/lib/staticMiddlewareFunction";

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/").filter(Boolean) ?? [];
    if (slugs.length === 0) {
      throw redirect({
        to: "/docs/$",
        params: { _splat: "framework" },
      });
    }
    const data = await loader({ data: slugs });
    await docs.getPage(data.path)?.preload();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} | ${appName}` : appName },
      {
        name: "description",
        content: loaderData?.description ?? appDescription,
      },
    ],
  }),
});

const loader = createServerFn({
  method: "GET",
})
  .validator((slugs: string[]) => slugs)
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) {
      throw notFound();
    }

    return {
      title: page.data.title,
      description: page.data.description,
      path: page.path,
      markdownUrl: getPageMarkdownUrl(page).url,
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });

function Content({ path, markdownUrl }: { path: string; markdownUrl: string }) {
  const page = docs.getPage(path);
  if (!page) {
    throw new Error(`unknown page: ${path}`);
  }

  const { toc } = use(page.load());
  const docsToc = toc.filter(
    (item) =>
      item.depth <= 4 &&
      !["#properties", "#parameters", "#returns"].some((p) =>
        item.url.startsWith(p),
      ),
  );
  const MDX = page.body;
  const sourceUrl = getPageSourceUrl(path);

  return (
    <DocsPage toc={docsToc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <div className="-mt-4 flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={sourceUrl} />
      </div>
      <DocsBody>
        <MDX components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

function Page() {
  const { pageTree, path, markdownUrl } = useFumadocsLoader(
    Route.useLoaderData(),
  );

  return (
    <DocsLayout
      {...baseOptions()}
      tree={pageTree}
      tabs={{
        transform(option, node) {
          if (!node.icon) {
            return option;
          }

          return {
            ...option,
            icon: (
              <div className="size-full rounded-lg max-md:border max-md:p-1.5 [&_svg]:size-full">
                {node.icon}
              </div>
            ),
          };
        },
      }}
    >
      <Link to={markdownUrl} hidden />
      <Suspense>
        <Content path={path} markdownUrl={markdownUrl} />
      </Suspense>
    </DocsLayout>
  );
}
