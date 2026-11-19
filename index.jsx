import './ui.css'

export const Button = ({ variant = 'filled', className = '', ...p }) => (
  <button className={`btn ${variant === 'outline' ? 'outline' : ''} ${className}`} {...p} />
)
export const Card = ({ className = '', ...p }) => <div className={`card ${className}`} {...p} />
export const Chip = ({ active, className = '', ...p }) => (
  <button className={`chip ${active ? 'on' : ''} ${className}`} {...p} />
)
export const Input = (p) => <input className="input" {...p} />
export const Circle = ({ size = 48, color, children }) => (
  <span className="circle" style={{ width: size, height: size, background: color }}>{children}</span>
)
export const ProgressBar = ({ percent = 0 }) => (
  <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
    <i style={{ width: `${percent}%` }} />
  </div>
)
export const Checkbox = (p) => <input type="checkbox" className="check" {...p} />
