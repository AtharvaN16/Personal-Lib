'use client';

interface SearchPillProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onEscape: () => void;
  fontSize?: number;
  autoFocus?: boolean;
}

/** Italic serif pill input that hugs its own content width, matching the hero's search styling. */
export default function SearchPill({
  id,
  value,
  onChange,
  onEnter,
  onEscape,
  fontSize = 32,
  autoFocus = false,
}: SearchPillProps) {
  const s = fontSize / 32;
  const displayText = value || 'Search';
  const pillWidth = Math.max(120 * s, displayText.length * 16 * s + 40 * s);
  const pillLeft = -20 * s;

  return (
    <span id={id} style={{
      position: 'relative',
      display: 'inline-block',
      verticalAlign: 'baseline',
    }}>
      {/* Static hidden placeholder of "Search" so surrounding content is placed correctly */}
      <span style={{
        visibility: 'hidden',
        fontStyle: 'italic',
        fontFamily: 'var(--font-newsreader), Georgia, serif',
        fontSize: `${fontSize}px`,
        fontWeight: 'normal',
        lineHeight: '1.4',
        opacity: 0.4,
        filter: 'blur(5px)',
      }}>
        Search
      </span>

      <input
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
            onEnter();
          } else if (e.key === 'Escape') {
            (e.target as HTMLInputElement).blur();
            onEscape();
          }
        }}
        placeholder="Search"
        style={{
          position: 'absolute',
          left: `${pillLeft}px`, // Offset slightly to overlap the text naturally
          top: `${-6 * s}px`,
          fontFamily: 'var(--font-newsreader), Georgia, serif',
          fontWeight: 'normal',
          fontSize: `${fontSize}px`,
          fontStyle: 'italic',
          color: 'var(--accent-primary)',
          backgroundColor: 'rgba(0, 44, 188, 0.06)', // Light blue container background
          borderRadius: `${8 * s}px`, // Clean capsule border radius
          padding: `${6 * s}px ${20 * s}px`, // More padding to the search pill
          border: 'none',
          outline: 'none',
          textDecoration: 'underline wavy var(--accent-primary)',
          textDecorationThickness: '1.5px',
          width: `${pillWidth}px`, // Dynamic width hugs content to prevent "h" cuts
          lineHeight: '1.4',
          height: `calc(100% + ${12 * s}px)`,
          margin: 0,
          boxSizing: 'border-box',
          zIndex: 10,
        }}
      />

      {value && (
        <span style={{
          position: 'absolute',
          left: `${pillWidth - 8 * s}px`, // Dynamic offset pushed by the input width
          top: '50%',
          transform: 'translateY(-55%)',
          fontSize: `${15 * s}px`,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-instrument-sans), sans-serif',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: 0.8,
          fontWeight: 'bold',
          zIndex: 20,
        }}>
          press ⏎
        </span>
      )}
    </span>
  );
}
