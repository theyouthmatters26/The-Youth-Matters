import { Clock, Flame, TrendingUp } from 'lucide-react'
import './ui.css'

const SORTS = [
  { key: 'hot', label: 'Hot', Icon: Flame },
  { key: 'top', label: 'Top', Icon: TrendingUp },
  { key: 'new', label: 'New', Icon: Clock },
]

export default function SortTabs({ value, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Sort posts">
      {SORTS.map(({ key, label, Icon }) => (
        <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  )
}
