'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { motion, Variants } from 'framer-motion';
import { ElementType, ComponentType } from 'react';

type AnimationType = 'blurIn' | 'fadeIn' | 'slideUp';

export interface Highlight {
  match: string;
  onClick?: () => void;
  /** Renders a small dot immediately before this word, e.g. to indicate an active/applied state. */
  badge?: boolean;
}

interface TextAnimateProps {
  children: string;
  animation?: AnimationType;
  by?: 'word' | 'character' | 'line' | 'text';
  as?: ElementType;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
  delay?: number;
  highlights?: Highlight[];
  disableAnimation?: boolean;
}

// Static lookup mapping to prevent dynamic component creation during render
const motionElements: Record<string, ComponentType<any>> = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  p: motion.p,
  span: motion.span,
  div: motion.div,
};

const normalizeWord = (s: string) =>
  s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').trim().toLowerCase();

interface RenderNode {
  text: string;
  isSpace: boolean;
  onClick?: () => void;
  isHighlight?: boolean;
  badge?: boolean;
}

/** Groups raw word/space segments into plain nodes and multi-word highlight matches. */
function buildRenderNodes(segments: string[], highlights: Highlight[]): RenderNode[] {
  // Prefer longer (more specific) phrases first so a 3-word match isn't shadowed by a 1-word one.
  const sortedHighlights = [...highlights].sort(
    (a, b) => b.match.trim().split(/\s+/).length - a.match.trim().split(/\s+/).length
  );

  const nodes: RenderNode[] = [];
  let i = 0;

  while (i < segments.length) {
    const segment = segments[i];

    if (/^\s+$/.test(segment)) {
      nodes.push({ text: segment, isSpace: true });
      i++;
      continue;
    }

    let matchedNode: RenderNode | null = null;
    let consumedSegments = 0;

    for (const highlight of sortedHighlights) {
      const targetWords = highlight.match.trim().split(/\s+/).map(normalizeWord);
      const collectedWords: string[] = [];
      let segIdx = i;
      let consumed = 0;

      while (collectedWords.length < targetWords.length && segIdx < segments.length) {
        const s = segments[segIdx];
        if (!/^\s+$/.test(s)) collectedWords.push(normalizeWord(s));
        consumed++;
        segIdx++;
      }

      if (
        collectedWords.length === targetWords.length &&
        collectedWords.every((w, idx) => w === targetWords[idx])
      ) {
        matchedNode = {
          text: segments.slice(i, i + consumed).join(''),
          isSpace: false,
          onClick: highlight.onClick,
          isHighlight: true,
          badge: highlight.badge,
        };
        consumedSegments = consumed;
        break;
      }
    }

    if (matchedNode) {
      nodes.push(matchedNode);
      i += consumedSegments;
    } else {
      nodes.push({ text: segment, isSpace: false });
      i++;
    }
  }

  return nodes;
}

export function TextAnimate({
  children,
  animation = 'fadeIn',
  by = 'word',
  as = 'p',
  className = '',
  style = {},
  duration = 0.5,
  delay = 0,
  highlights = [],
  disableAnimation = false,
}: TextAnimateProps) {
  const ContainerComponent = motionElements[as as string] || motion.p;

  // Segment splitter
  let segments: string[] = [];
  if (by === 'word') {
    segments = children.split(/(\s+)/); // Preserve space intervals
  } else if (by === 'character') {
    segments = children.split('');
  } else {
    segments = [children];
  }

  const nodes: RenderNode[] =
    by === 'word' && highlights.length > 0
      ? buildRenderNodes(segments, highlights)
      : segments.map(text => ({ text, isSpace: /^\s+$/.test(text) }));

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: by === 'character' ? 0.03 : 0.08,
        delayChildren: delay,
      },
    },
  };

  const itemVariants: Record<AnimationType, Variants> = {
    blurIn: {
      hidden: { opacity: 0, y: 8, filter: 'blur(8px)' },
      visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration, ease: 'easeOut' },
      },
    },
    fadeIn: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { duration },
      },
    },
    slideUp: {
      hidden: { opacity: 0, y: 15 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration, ease: 'easeOut' },
      },
    },
  };

  const selectedVariants = itemVariants[animation] || itemVariants.fadeIn;
  const initialValue = disableAnimation ? 'visible' : 'hidden';

  return (
    <ContainerComponent
      variants={containerVariants}
      initial={initialValue}
      animate="visible"
      className={className}
      style={style}
    >
      {nodes.map((node, idx) => {
        if (node.isSpace) {
          // A literal newline in the source string becomes a real line break, so a caller
          // can force multi-line layout while it's still one continuous animated sentence.
          if (node.text.includes('\n')) {
            return <br key={idx} />;
          }
          return <span key={idx}>{node.text}</span>;
        }

        if (node.isHighlight) {
          const isClickable = !!node.onClick;
          return (
            <motion.span
              key={idx}
              variants={selectedVariants}
              style={{ display: 'inline-block' }}
            >
              {node.badge && (
                <span
                  className="text-animate-badge"
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary)',
                    marginRight: '12px',
                    verticalAlign: 'middle',
                  }}
                />
              )}
              <span
                onClick={node.onClick}
                style={{
                  display: 'inline-block',
                  fontStyle: 'italic',
                  color: 'var(--accent-primary)',
                  position: 'relative',
                  ...(isClickable ? {
                    cursor: 'pointer',
                    // Expand click target footprint
                    padding: '10px 14px',
                    margin: '-10px -14px',
                    zIndex: 10,
                  } : {})
                }}
              >
                {node.text}
              </span>
            </motion.span>
          );
        }

        return (
          <motion.span
            key={idx}
            variants={selectedVariants}
            style={{ display: 'inline-block' }}
          >
            {node.text}
          </motion.span>
        );
      })}
    </ContainerComponent>
  );
}
