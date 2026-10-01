import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { DefaultErrorComponent } from "@/components/default-error";
import { NotFound } from "@/components/not-found";
import { getBasePath } from "@/lib/basePath";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    basepath: getBasePath(),
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: DefaultErrorComponent,
  });
}
