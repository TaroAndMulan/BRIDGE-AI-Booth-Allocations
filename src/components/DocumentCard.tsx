import { Download, type LucideIcon } from 'lucide-react';
import type { PdfDocument } from '../documents';

type DocumentCardProps = {
  doc: PdfDocument;
  Icon: LucideIcon;
  eyebrow: string;
  /** Thai leads: it is the document's own title and the readers' first language. */
  title: string;
  subtitle: string;
};

/**
 * A whole-card link to a PDF. Everything inside is decoration, so there is one
 * click target and no ambiguity about what is clickable.
 */
export default function DocumentCard({ doc, Icon, eyebrow, title, subtitle }: DocumentCardProps) {
  return (
    <a className="doc-card" href={doc.url} download={doc.filename}>
      <span className="doc-card-icon" aria-hidden>
        <Icon size={22} />
      </span>

      <span className="doc-card-text">
        <span className="doc-card-eyebrow">{eyebrow}</span>
        <span className="doc-card-title">{title}</span>
        <span className="doc-card-sub">{subtitle}</span>
      </span>

      <span className="doc-card-action">
        <span className="btn-download">
          <Download size={16} aria-hidden />
          Download PDF
        </span>
        <span className="doc-card-meta">
          PDF · {doc.size} · {doc.pages} หน้า
        </span>
      </span>
    </a>
  );
}
