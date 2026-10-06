import './ui.css'

const initials = (name = '') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

// A portrait when the member added one, initials otherwise.
export default function Avatar({ user, size = 32 }) {
  const role = user.role || 'student'
  if (user.avatar) {
    return <img className={`avatar avatar-photo avatar-${role}`} src={user.avatar} alt="" width={size} height={size}
      loading="lazy" decoding="async" />
  }
  return (
    <span className={`avatar avatar-${role}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {role === 'bot' ? 'AI' : initials(user.displayName)}
    </span>
  )
}
