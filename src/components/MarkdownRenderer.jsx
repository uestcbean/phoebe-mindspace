import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

/**
 * Markdown renderer with syntax highlighting and GFM support.
 * Supports: tables, strikethrough, task lists, code blocks with highlighting.
 */
const MarkdownRenderer = ({ content }) => {
  return (
    <div className="markdown-body" style={styles.container}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom code block rendering
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline ? (
              <div style={styles.codeBlockWrapper}>
                {match && <span style={styles.languageTag}>{match[1]}</span>}
                <pre style={styles.pre}>
                  <code className={className} style={styles.code} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code style={styles.inlineCode} {...props}>
                {children}
              </code>
            );
          },
          // Custom table rendering
          table({ children }) {
            return (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th style={styles.th}>{children}</th>;
          },
          td({ children }) {
            return <td style={styles.td}>{children}</td>;
          },
          // Custom link rendering
          a({ href, children }) {
            return (
              <a href={href} style={styles.link} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          // Custom list rendering
          ul({ children }) {
            return <ul style={styles.ul}>{children}</ul>;
          },
          ol({ children }) {
            return <ol style={styles.ol}>{children}</ol>;
          },
          li({ children }) {
            return <li style={styles.li}>{children}</li>;
          },
          // Headings
          h1({ children }) {
            return <h1 style={styles.h1}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 style={styles.h2}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 style={styles.h3}>{children}</h3>;
          },
          // Blockquote
          blockquote({ children }) {
            return <blockquote style={styles.blockquote}>{children}</blockquote>;
          },
          // Paragraph
          p({ children }) {
            return <p style={styles.p}>{children}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

const styles = {
  container: {
    lineHeight: '1.7',
    fontSize: '15px',
    color: '#e5e5e5',
  },
  codeBlockWrapper: {
    position: 'relative',
    marginTop: '8px',
    marginBottom: '8px',
  },
  languageTag: {
    position: 'absolute',
    top: '4px',
    right: '8px',
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
  },
  pre: {
    background: '#0d0d0d',
    borderRadius: '8px',
    padding: '16px',
    overflowX: 'auto',
    margin: 0,
  },
  code: {
    fontFamily: '"Fira Code", "JetBrains Mono", Menlo, Monaco, monospace',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  inlineCode: {
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: '"Fira Code", Menlo, Monaco, monospace',
    fontSize: '0.9em',
    color: '#f0abfc',
  },
  tableWrapper: {
    overflowX: 'auto',
    marginTop: '12px',
    marginBottom: '12px',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '14px',
  },
  th: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '10px 14px',
    textAlign: 'left',
    borderBottom: '1px solid #333',
    fontWeight: '600',
  },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #2a2a2a',
  },
  link: {
    color: '#a78bfa',
    textDecoration: 'none',
  },
  ul: {
    paddingLeft: '24px',
    margin: '8px 0',
  },
  ol: {
    paddingLeft: '24px',
    margin: '8px 0',
  },
  li: {
    marginBottom: '4px',
  },
  h1: {
    fontSize: '1.5em',
    fontWeight: '600',
    marginTop: '20px',
    marginBottom: '12px',
    color: '#fff',
  },
  h2: {
    fontSize: '1.3em',
    fontWeight: '600',
    marginTop: '16px',
    marginBottom: '10px',
    color: '#fff',
  },
  h3: {
    fontSize: '1.1em',
    fontWeight: '600',
    marginTop: '14px',
    marginBottom: '8px',
    color: '#fff',
  },
  blockquote: {
    borderLeft: '3px solid #a78bfa',
    paddingLeft: '16px',
    margin: '12px 0',
    color: '#aaa',
    fontStyle: 'italic',
  },
  p: {
    margin: '8px 0',
  },
};

export default MarkdownRenderer;


