import { BadgeCheck, Shield } from 'lucide-react'
import './ui.css'

// OP / Verified Mentor / Admin / TYMAi highlights from Module 3.
export default function RoleBadge({ role, isOp }) {
  return (
    <>
      {isOp && <span className="badge">OP</span>}
      {role === 'mentor' && <span className="badge badge-mentor"><BadgeCheck size={12} />Mentor</span>}
      {role === 'admin' && <span className="badge badge-admin"><Shield size={12} />Admin</span>}
      {role === 'bot' && <span className="badge badge-admin">AI</span>}
    </>
  )
}
