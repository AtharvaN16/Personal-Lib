'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { motion, Variants } from 'framer-motion';
import { ElementType, ComponentType } from 'react';

type AnimationType = 'blurIn' | 'fadeIn' | 'slideUp';

export interface Highlight {
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
      {segments.map((segment, idx) => {
        // Render pure spaces normally to maintain natural typography flow
        if (/^\s+$/.test(segment)) {
          return <span key={idx}>{segment}</span>;
        }

        // Clean punctuation to match keywords exactly
        const cleanWord = segment.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim().toLowerCase();
        
        // Find if this word matches any highlight entry
        const highlight = highlights.find(
          h => h.match.toLowerCase() === cleanWord
        );

        if (highlight) {
          const isClickable = !!highlight.onClick;
          return (
            <motion.span
              key={idx}
              variants={selectedVariants}
              onClick={highlight.onClick}
              style={{ 
                display: 'inline-block',
                fontStyle: 'italic',
                color: 'var(--accent-primary)',
                textDecoration: 'underline wavy var(--accent-primary)',
                textDecorationThickness: '1.5px',
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
              {segment}
            </motion.span>
          );
        }

        return (
          <motion.span
            key={idx}
            variants={selectedVariants}
            style={{ display: 'inline-block' }}
          >
            {segment}
          </motion.span>
        );
      })}
    </ContainerComponent>
  );
}
