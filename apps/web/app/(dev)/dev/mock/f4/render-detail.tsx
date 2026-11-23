"use client";
// 詳細まわりの下絵の描き分け（K-452・K-458）。持っていない id は null を返す。
//   部品は features/F4/<区画>/views.tsx。ここは決めた値を渡して並べるだけ（口は呼ばない）。
//   MOCKS にまだ無い id（f4-links-empty・f4-link-remove）も描ける。f4-links-variants＝派生先と見えない相手
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { LinkAddDialog, LinksSection, UnlinkConfirm } from "@/features/F4/links/views";
import { MoreMenu } from "@/features/F4/detail-more/views";
import { DetailFrame, TICKET } from "./frame";
import { CANDIDATES, CHILDREN, LINKS, LINKS_VARIANTS } from "./detail-samples";

const noop = (): void => undefined;

function linksDetail(theme: Theme, empty: boolean, dialog?: ReactNode, variants = false, collapsed = false): ReactNode {
  return (
    <DetailFrame
      theme={theme}
      links={
        <LinksSection
          collapsed={collapsed}
          counts={{ children: 2, links: 3 }}
          childTickets={empty ? [] : CHILDREN}
          links={empty ? [] : variants ? LINKS_VARIANTS : LINKS}
        />
      }
      dialog={dialog}
    />
  );
}

const linkDialog = (
  <LinkAddDialog
    open
    ticket={{ number: TICKET.number, title: TICKET.title }}
    kind="related"
    query="保守"
    candidates={CANDIDATES}
    selected="EG-097"
  />
);

export function renderDetail(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "f4-more-menu":
      return <DetailFrame theme={theme} more={<MoreMenu defaultOpen />} />;
    case "f4-links-collapsed":
      return linksDetail(theme, false, undefined, false, true);
    case "f4-links":
      return linksDetail(theme, false);
    case "f4-links-variants":
      return linksDetail(theme, false, undefined, true);
    case "f4-links-empty":
      return linksDetail(theme, true);
    case "f4-link-add":
      return linksDetail(theme, false, linkDialog);
    case "f4-link-remove": {
      const link = LINKS[1];
      return link ? linksDetail(theme, false, <UnlinkConfirm open link={link} onOpenChange={noop} />) : null;
    }
    default:
      return null;
  }
}
