import type { ReactNode } from 'react';
import { parseMarkdown, type Block, type Inline } from './markdown';

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case 'text':
        return n.text;
      case 'code':
        return <code key={i}>{n.text}</code>;
      case 'strong':
        return <strong key={i}>{renderInline(n.children)}</strong>;
      case 'em':
        return <em key={i}>{renderInline(n.children)}</em>;
      case 'del':
        return <del key={i}>{renderInline(n.children)}</del>;
    }
  });
}

function renderBlock(b: Block, i: number): ReactNode {
  switch (b.kind) {
    case 'heading':
      return (
        <h4 key={i} className={`upd-md__h upd-md__h--${String(b.level)}`}>
          {renderInline(b.children)}
        </h4>
      );
    case 'paragraph':
      return <p key={i}>{renderInline(b.children)}</p>;
    case 'quote':
      return <blockquote key={i}>{renderInline(b.children)}</blockquote>;
    case 'code':
      return (
        <pre key={i}>
          <code>{b.text}</code>
        </pre>
      );
    case 'rule':
      return <hr key={i} />;
    case 'list': {
      const List = b.ordered ? 'ol' : 'ul';
      return (
        <List key={i}>
          {b.items.map((item, j) => (
            <li key={j} className={`upd-md__li--${String(item.depth)}`}>
              {renderInline(item.children)}
            </li>
          ))}
        </List>
      );
    }
  }
}

/** Notes de version : Markdown rendu en éléments React (tout le texte est échappé, aucun HTML brut). */
export function Markdown({ source }: { source: string }) {
  return <div className="upd-md">{parseMarkdown(source).map(renderBlock)}</div>;
}
