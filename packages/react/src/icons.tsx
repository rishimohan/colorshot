import type { SVGProps } from "react";

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

type P = SVGProps<SVGSVGElement>;

export const SolidIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const LinearIcon = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="cs-i-lin" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="currentColor" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.1" />
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="10" height="10" rx="2.5" fill="url(#cs-i-lin)" stroke="currentColor" strokeOpacity="0.35" />
  </svg>
);

export const RadialIcon = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <radialGradient id="cs-i-rad">
        <stop offset="0" stopColor="currentColor" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.1" />
      </radialGradient>
    </defs>
    <rect x="3" y="3" width="10" height="10" rx="2.5" fill="url(#cs-i-rad)" stroke="currentColor" strokeOpacity="0.35" />
  </svg>
);

export const ConicIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="10" height="10" rx="2.5" stroke="currentColor" strokeOpacity="0.35" />
    <path d="M8 8V3a5 5 0 0 1 5 5z" fill="currentColor" stroke="none" />
    <path d="M8 8h5a5 5 0 0 1-5 5z" fill="currentColor" fillOpacity="0.55" stroke="none" />
    <path d="M8 8v5a5 5 0 0 1-5-5z" fill="currentColor" fillOpacity="0.25" stroke="none" />
  </svg>
);

export const EyeDropperIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10.2 2.8a1.9 1.9 0 0 1 2.7 2.7l-1.3 1.3.6.6-1.1 1.1-3.6-3.6 1.1-1.1.6.6z" />
    <path d="M7.6 4.9 3.2 9.3a1.5 1.5 0 0 0-.4.8l-.3 2.4 2.4-.3a1.5 1.5 0 0 0 .8-.4l4.4-4.4" />
  </svg>
);

export const SwapIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13" />
  </svg>
);

export const TrashIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </svg>
);

export const ChevronIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 6.5l3 3 3-3" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

export const CopyIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5" />
    <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.2 10.2l3.3 3.3" />
  </svg>
);

export const UndoIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5.5 4L3 6.5 5.5 9" />
    <path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7" />
  </svg>
);

export const MoreIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const RepeatIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 6.5V6a2.5 2.5 0 0 1 2.5-2.5h7M10.5 1.5l2 2-2 2M13 9.5v.5a2.5 2.5 0 0 1-2.5 2.5h-7M5.5 14.5l-2-2 2-2" />
  </svg>
);

export const TargetIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="5" />
    <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
  </svg>
);
