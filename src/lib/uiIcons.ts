import {
  Boxes,
  ChevronsUpDown,
  Code,
  Download,
  Heading,
  Image as ImageIcon,
  Link,
  ListChecks,
  ListTodo,
  Play,
  Scale,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  Type,
} from "lucide-react";
import type { BlockType } from "@/engine";

/* UI icons only — brand icons for the README itself come from shields.io. */
export const BLOCK_ICONS: Record<BlockType, typeof Type> = {
  hero: Sparkles,
  heading: Heading,
  text: Type,
  features: ListChecks,
  image: ImageIcon,
  code: Code,
  table: TableIcon,
  badges: ShieldCheck,
  techstack: Boxes,
  installation: Download,
  usage: Play,
  license: Scale,
  collapsible: ChevronsUpDown,
  checklist: ListTodo,
  links: Link,
};
