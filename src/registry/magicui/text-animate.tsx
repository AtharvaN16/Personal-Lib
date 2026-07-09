'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { motion, Variants } from 'framer-motion';
import { ElementType, ComponentType } from 'react';

type AnimationType = 'blurIn' | 'fadeIn' | 'slideUp';

interface Highlight {
  /** Phrase to match (case/punctuation-insensitive), can be one or several words. */
  match: string;
  onClick?: () => void;
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
  /** Phrases within the sentence that render italic/underlined/clickable, same animation as the rest. */
  highlights?: Highlight[];
  disableAnimation?: boolean;
  scrollOpacity1?: any;
  scrollOpacity2?: any;
  scrollY2?: any;
  scrollFilter2?: any;
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
}

/** Groups raw word/space tokens into plain segments and multi-word highlight matches. */
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
  scrollOpacity1,
  scrollOpacity2,
  scrollY2,
  scrollFilter2,
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
      {(() => {
        let hasSeenNewline = false;
        return nodes.map((node, idx) => {
          if (node.isSpace) {
            // A literal newline in the source string becomes a real line break, so a caller
            // can force multi-line layout while it's still one continuous animated sentence.
            if (node.text.includes('\n')) {
              hasSeenNewline = true;
              return <br key={idx} />;
            }
            return <span key={idx}>{node.text}</span>;
          }

          const isLine2 = hasSeenNewline;
          const opacityValue = isLine2 ? (scrollOpacity2 ?? 1) : (scrollOpacity1 ?? 1);
          const yValue = isLine2 ? (scrollY2 ?? 0) : 0;
          const filterValue = isLine2 ? scrollFilter2 : undefined;

          if (node.isHighlight) {
            return (
              <motion.span
                key={idx}
                variants={selectedVariants}
                onClick={node.onClick}
                style={{
                  display: 'inline-block',
                  cursor: 'pointer',
                  fontStyle: 'italic',
                  color: 'var(--accent-primary)',
                  textDecoration: 'underline wavy var(--accent-primary)',
                  textDecorationThickness: '1.5px',
                  // Expand click target footprint
                  padding: '10px 14px',
                  margin: '-10px -14px',
                  position: 'relative',
                  zIndex: 10,
                  opacity: opacityValue,
                  y: yValue,
                  filter: filterValue,
                  pointerEvents: 'auto',
                }}
              >
                {node.text}
              </motion.span>
            );
          }

          return (
            <motion.span
              key={idx}
              variants={selectedVariants}
              style={{
                display: 'inline-block',
                opacity: opacityValue,
                y: yValue,
                filter: filterValue,
              }}
            >
              {node.text}
            </motion.span>
          );
        });
      })()}
    </ContainerComponent>
  );
}
