"use client";
import { useDocsSearch } from "fumadocs-core/search/client";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { docsSections, type DocsSectionSlug } from "@/lib/docs-packages";

const sectionFilters: ReadonlyArray<{
  readonly name: string;
  readonly description: string;
  readonly value: DocsSectionSlug | undefined;
}> = [
  {
    name: "All",
    description: "Search all Kysoql documentation.",
    value: undefined,
  },
  ...docsSections.map((entry) => ({
    name: entry.label,
    description: entry.description,
    value: entry.slug,
  })),
];

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n();
  const [filterOpen, setFilterOpen] = useState(false);
  const [tag, setTag] = useState<DocsSectionSlug | undefined>("framework");
  const { search, setSearch, query } = useDocsSearch({
    client: staticClient({
      locale,
      tag,
    }),
  });
  const selectedFilter = sectionFilters.find((item) => item.value === tag);

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== "empty" ? query.data : null} />
        <SearchDialogFooter
          className="flex flex-row flex-wrap items-center gap-2"
        >
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              className={buttonVariants({
                size: "sm",
                variant: "ghost",
                className: "-m-1.5 me-auto",
              })}
            >
              <span className="me-2 text-fd-muted-foreground/80">Filter</span>
              {selectedFilter?.name ?? "All"}
              <ChevronDown className="size-3.5 text-fd-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="flex flex-col gap-1 p-1" align="start">
              {sectionFilters.map((item) => {
                const isSelected = item.value === tag;

                return (
                  <button
                    key={item.value ?? "all"}
                    type="button"
                    onClick={() => {
                      setTag(item.value);
                      setFilterOpen(false);
                    }}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-start",
                      isSelected
                        ? "bg-fd-primary/10 text-fd-primary"
                        : "hover:bg-fd-accent hover:text-fd-accent-foreground",
                    )}
                  >
                    <p className="mb-0.5 font-medium">{item.name}</p>
                    <p className="text-xs opacity-70">{item.description}</p>
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
