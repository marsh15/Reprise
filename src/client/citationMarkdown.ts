// A small remark transform keeps citation pills out of links and code spans.
type Node = { type: string; value?: string; children?: Node[]; url?: string };
export function citationMarkdown() {
  return (tree: Node) => {
    function visit(node: Node) {
      if (['link', 'code', 'inlineCode', 'html'].includes(node.type) || !node.children) return;
      node.children = node.children.flatMap(child => {
        if (child.type !== 'text' || !child.value) { visit(child); return [child]; }
        const parts: Node[] = []; let offset = 0;
        for (const match of child.value.matchAll(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g)) {
          parts.push({ type: 'text', value: child.value.slice(offset, match.index) });
          for (const n of match[1].split(',').map(Number)) parts.push({ type: 'link', url: `#citation-${n}`, children: [{ type: 'text', value: `[${n}]` }] });
          offset = match.index + match[0].length;
        }
        parts.push({ type: 'text', value: child.value.slice(offset) });
        return parts;
      });
    }
    visit(tree);
  };
}
