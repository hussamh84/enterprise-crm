import { arabicPdfTextProps } from "../utils/arabicText";

export default function PdfArabicText({ as: Tag = "span", children, className = "", ...rest }) {
  const text = String(children ?? "");
  const arabicProps = arabicPdfTextProps(text);
  const mergedClassName = [className, arabicProps.className].filter(Boolean).join(" ");

  return (
    <Tag {...rest} {...arabicProps} className={mergedClassName || undefined}>
      {children}
    </Tag>
  );
}
