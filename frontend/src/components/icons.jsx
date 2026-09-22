/* Thematic geometric icon system for Rememberly.
 * Hand-authored 24x24 stroke icons: 1.8px stroke, round caps/joins,
 * currentColor. No external icon dependency. Decorative only —
 * every usage stays aria-hidden so accessible names never change. */

function Base({ children, size = 20, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function DashboardIcon(props) {
  return <Base {...props}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></Base>
}

export function NotesIcon(props) {
  return <Base {...props}><path d="M6 3.5h9.5L19 7v13.5H6z" /><path d="M15 3.5V7.5h4.5" /><path d="M9 12h6M9 15.5h6" /></Base>
}

export function TasksIcon(props) {
  return <Base {...props}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><path d="M8.5 12.2l2.6 2.6 4.6-5" /></Base>
}

export function EventsIcon(props) {
  return <Base {...props}><rect x="3.5" y="5" width="17" height="15.5" rx="3.5" /><path d="M3.5 9.5h17" /><path d="M8 2.8V6M16 2.8V6" /><circle cx="12" cy="14.8" r="2.4" /><path d="M12 13.6v1.2l.9.9" /></Base>
}

export function ShoppingIcon(props) {
  return <Base {...props}><path d="M5 8h14l-1.2 12.5H6.2z" /><path d="M8.5 10.5V6.8a3.5 3.5 0 0 1 7 0v3.7" /></Base>
}

export function TransactionsIcon(props) {
  return <Base {...props}><path d="M4 8.5h13" /><path d="M14.5 5.8L17.5 8.5l-3 2.7" /><path d="M20 15.5H7" /><path d="M9.5 12.8l-3 2.7 3 2.7" /></Base>
}

export function PlacesIcon(props) {
  return <Base {...props}><path d="M12 21s6.5-5.6 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.4 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.3" /></Base>
}

export function SearchIcon(props) {
  return <Base {...props}><circle cx="11" cy="11" r="6.5" /><path d="M15.8 15.8L20.5 20.5" /></Base>
}

export function SettingsIcon(props) {
  return <Base {...props}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" /></Base>
}

export function StudyIcon(props) {
  return <Base {...props}><path d="M12 6.5C10 4.8 7.2 4.5 4 4.5v14c3.2 0 6 .3 8 2 2-1.7 4.8-2 8-2v-14c-3.2 0-6 .3-8 2z" /><path d="M12 6.5v14" /></Base>
}

export function PlusIcon(props) {
  return <Base {...props}><path d="M12 5v14M5 12h14" /></Base>
}

export function CloseIcon(props) {
  return <Base {...props}><path d="M6 6l12 12M18 6L6 18" /></Base>
}

export function ArrowRightIcon(props) {
  return <Base {...props}><path d="M4 12h15" /><path d="M13.5 6l6 6-6 6" /></Base>
}

export function ArrowLeftIcon(props) {
  return <Base {...props}><path d="M20 12H5" /><path d="M10.5 6l-6 6 6 6" /></Base>
}

export function MenuIcon(props) {
  return <Base {...props}><path d="M4 7h16M4 12h16M4 17h16" /></Base>
}

export function LogoutIcon(props) {
  return <Base {...props}><path d="M14 4h5.5v16H14" /><path d="M10.5 8l-3.5 4 3.5 4" /><path d="M7.5 12H19" /></Base>
}

export function CheckIcon(props) {
  return <Base {...props}><path d="M5 12.5l4.5 4.5L19 7.5" /></Base>
}

export function SparkleIcon(props) {
  return <Base {...props}><path d="M12 3.5c.7 4.8 3.7 7.8 8.5 8.5-4.8.7-7.8 3.7-8.5 8.5-.7-4.8-3.7-7.8-8.5-8.5 4.8-.7 7.8-3.7 8.5-8.5z" /></Base>
}

/* Maps a nav label to its thematic icon. Unknown labels fall back to Notes. */
const navIcons = {
  Dashboard: DashboardIcon,
  Notes: NotesIcon,
  Tasks: TasksIcon,
  Events: EventsIcon,
  Shopping: ShoppingIcon,
  Transactions: TransactionsIcon,
  Places: PlacesIcon,
  Search: SearchIcon,
  Settings: SettingsIcon,
  Study: StudyIcon,
}

export function NavIcon({ label, ...rest }) {
  const Component = navIcons[label] || NotesIcon
  return <Component {...rest} />
}
