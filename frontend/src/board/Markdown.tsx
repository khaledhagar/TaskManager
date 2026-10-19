import ReactMarkdown from 'react-markdown'
import css from './board.module.css'

/**
 * Markdown without raw HTML. react-markdown escapes HTML and its default URL transform
 * drops unsafe schemes such as `javascript:`; links open in a new tab without an opener.
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className={css.markdown}>
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
