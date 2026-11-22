import type { SVGProps } from "react"

/**
 * The app's filled symbols, drawn for the web in its own shapes: the ticked box, the
 * results' check, cross and question mark, and the camera's corner marks around a scanned
 * pill. Each takes the colour around it (currentColor) and is hidden from screen readers;
 * the words beside it say what it means.
 */
type Glyph = SVGProps<SVGSVGElement>

const base = { viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const

/** checkmark.square.fill: a ticked box. */
export function TickedBox(props: Glyph) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="4.5" fill="currentColor" />
      <path d="M7.5 12.3l3 3 6-6.3" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** checkmark.circle.fill: taken. */
export function CheckCircle(props: Glyph) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M7.5 12.3l3 3 6-6.3" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** xmark.circle.fill: "Don't take now". `ring` draws a rim in the colour behind, for a badge. */
export function CrossCircle({ ring, ...props }: Glyph & { ring?: boolean }) {
  return (
    <svg {...base} {...props}>
      {ring && <circle cx="12" cy="12" r="11.5" className="fill-card" />}
      <circle cx="12" cy="12" r={ring ? 9.5 : 10} fill="currentColor" />
      <path d="M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

/** questionmark.circle.fill: "Unknown – don't take". */
export function QuestionCircle({ ring, ...props }: Glyph & { ring?: boolean }) {
  return (
    <svg {...base} {...props}>
      {ring && <circle cx="12" cy="12" r="11.5" className="fill-card" />}
      <circle cx="12" cy="12" r={ring ? 9.5 : 10} fill="currentColor" />
      <path d="M9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.7v.3" stroke="white" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill="white" />
    </svg>
  )
}

/** exclamationmark.triangle.fill: a tablet taken only when needed (the results' "Caution"). */
export function CautionTriangle(props: Glyph) {
  return (
    <svg {...base} {...props}>
      <path d="M10.3 3.6a2 2 0 0 1 3.4 0l8 13.8A2 2 0 0 1 20 20.4H4a2 2 0 0 1-1.7-3z" fill="currentColor" />
      <path d="M12 8.8v5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.3" fill="white" />
    </svg>
  )
}

/** An empty box with a tint: a dose whose time passed with no tick. */
export function EmptyBox(props: Glyph) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="currentColor" strokeWidth="2.6" className="fill-late-fill" />
    </svg>
  )
}

/** The camera's four corner marks, around a scanned pill (the app's CornerMarks). */
export function CornerMarks(props: Glyph) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable={false} {...props}>
      <path
        d="M3 16V8a5 5 0 0 1 5-5h8M48 3h8a5 5 0 0 1 5 5v8M61 48v8a5 5 0 0 1-5 5h-8M16 61H8a5 5 0 0 1-5-5v-8"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * The tablet from the app icon (the app's TabletIcon): a round tablet seen from a little
 * above, tilted, with a score line. For medications without a picture here.
 */
export function Tablet(props: Glyph) {
  return (
    <svg viewBox="0 0 24 18" aria-hidden focusable={false} {...props}>
      <g transform="rotate(-15 12 9)">
        <ellipse cx="12" cy="10.6" rx="9.6" ry="6.1" fill="currentColor" />
        <ellipse cx="12" cy="7.6" rx="9.6" ry="6.1" fill="currentColor" stroke="var(--secondary)" strokeWidth="1.2" />
        <rect x="5.7" y="6.9" width="12.6" height="1.4" rx="0.7" fill="var(--secondary)" />
      </g>
    </svg>
  )
}

/** storefront.fill: the pharmacy. */
export function Storefront(props: Glyph) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4h16l1.6 5a2.6 2.6 0 0 1-4.9 1.4 2.6 2.6 0 0 1-4.7 0 2.6 2.6 0 0 1-4.7 0A2.6 2.6 0 0 1 2.4 9z" fill="currentColor" />
      <path d="M4.5 12.4V20h6v-5h3v5h6v-7.6a3.9 3.9 0 0 1-2.9-.5 3.9 3.9 0 0 1-4.6 0 3.9 3.9 0 0 1-4.6 0 3.9 3.9 0 0 1-2.9.5z" fill="currentColor" />
    </svg>
  )
}
