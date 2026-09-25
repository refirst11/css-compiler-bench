import fs from "fs";
import path from "path";
import { parse } from "parse5";
import { selectedLanes } from "./lanes.ts";

const IGNORED_ELEMENTS = new Set(["script", "style", "link", "template"]);
const IGNORED_ATTRIBUTES = [/^class$/, /^style$/, /^data-/];

type Node = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
};

function serialize(node: Node): string {
  if (node.nodeName === "#text") return node.value!.trim();
  if (!node.tagName || IGNORED_ELEMENTS.has(node.tagName)) return "";

  const attrs = node
    .attrs!.filter((attr) => !IGNORED_ATTRIBUTES.some((pattern) => pattern.test(attr.name)))
    .map((attr) => ` ${attr.name}="${attr.value}"`)
    .sort()
    .join("");
  const children = (node.childNodes ?? []).map(serialize).join("");
  return `<${node.tagName}${attrs}>${children}</${node.tagName}>`;
}

function normalize(html: string): string {
  const document = parse(html) as unknown as Node;
  const root = document.childNodes!.find((node) => node.tagName === "html")!;
  const body = root.childNodes!.find((node) => node.tagName === "body")!;
  return serialize(body);
}

function readPage(dir: string): string | null {
  const file = path.join(dir, ".next", "server", "app", "index.html");
  return fs.existsSync(file) ? normalize(fs.readFileSync(file, "utf8")) : null;
}

const lanes = selectedLanes();
const control = readPage(lanes[0].dir);
if (!control) {
  console.error(`No build output for ${lanes[0].name}; run \`pnpm bench\` first.`);
  process.exit(1);
}

let failed = false;
for (const lane of lanes.slice(1)) {
  const page = readPage(lane.dir);
  if (page === null) {
    console.log(`? ${lane.name}: no build output`);
    failed = true;
    continue;
  }
  if (page === control) {
    console.log(`✓ ${lane.name}`);
    continue;
  }
  let at = 0;
  while (page[at] === control[at]) at++;
  console.log(`✗ ${lane.name}: differs from ${lanes[0].name} at character ${at}`);
  console.log(`    ${lanes[0].name}: …${control.slice(Math.max(0, at - 60), at + 80)}`);
  console.log(`    ${lane.name}: …${page.slice(Math.max(0, at - 60), at + 80)}`);
  failed = true;
}

if (failed) process.exitCode = 1;
