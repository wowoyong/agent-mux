declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";

  interface TerminalRendererOptions {
    code?: (...args: unknown[]) => string;
    blockquote?: (text: string) => string;
    heading?: (text: string, level: number) => string;
    firstHeading?: (text: string, level: number) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (text: string) => string;
    link?: (href: string, title: string, text: string) => string;
    width?: number;
    reflowText?: boolean;
    showSectionPrefix?: boolean;
    emoji?: boolean;
    tab?: number;
  }

  interface HighlightOptions {
    language?: string;
    ignoreIllegals?: boolean;
  }

  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: HighlightOptions
  ): MarkedExtension;
}
