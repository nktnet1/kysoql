import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import IconAsset from "@/assets/icon.svg";
import { appName, repositoryUrl } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img
            alt=""
            aria-hidden="true"
            className="size-8 rounded-lg"
            loading="eager"
            src={IconAsset}
          />
          {appName}
        </>
      ),
    },
    githubUrl: repositoryUrl,
  };
}
