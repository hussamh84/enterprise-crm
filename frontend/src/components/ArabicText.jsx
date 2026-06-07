import { arabicTextProps } from "../utils/arabicText";

export default function ArabicText({ as: Tag = "span", children, className = "", ...rest }) {
  const text = String(children ?? "");
  const arabicProps = arabicTextProps(text);
  const mergedClassName = [className, arabicProps.className].filter(Boolean).join(" ");

  return (
    <Tag {...rest} {...arabicProps} className={mergedClassName || undefined}>
      {children}
    </Tag>
  );
}
