import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

function MarkdownContent({ children, className = "" }) {
  if (!children) return null;

  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{children}</ReactMarkdown>
    </div>
  );
}

export default MarkdownContent;
