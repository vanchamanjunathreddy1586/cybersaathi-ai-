import { ArrowDown, ArrowRight, LockKeyhole, ScanSearch, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  { title: 'AI-Powered Protection', icon: ShieldCheck },
  { title: 'Smart Threat Detection', icon: ScanSearch },
  { title: 'Real-Time Cyber Community', icon: Users },
]

export function WelcomePage() {
  return (
    <main className="intro-page cyber-home">
      <div aria-hidden="true" className="cyber-home-artwork" />
      <header className="cyber-home-header">
        <Link aria-label="CyberSaathi AI home" className="cyber-home-brand" to="/">
          <span aria-hidden="true" className="cyber-home-brand-mark">
            <ShieldCheck size={31} strokeWidth={1.8} />
            <LockKeyhole className="cyber-home-brand-lock" size={13} strokeWidth={2} />
          </span>
          <span>CyberSaathi <strong>AI</strong></span>
        </Link>
        <p className="cyber-home-motto">Be Aware <span>·</span> Be Safe <span>·</span> Be CyberSmart</p>
        <Link className="intro-sign-in" to="/login">Sign In</Link>
      </header>

      <section aria-labelledby="cyber-home-title" className="cyber-home-content">
        <div aria-hidden="true" className="cyber-home-emblem">
          <span className="cyber-home-shield">
            <ShieldCheck size={94} strokeWidth={1.25} />
            <LockKeyhole className="cyber-home-shield-lock" size={34} strokeWidth={1.8} />
          </span>
          <span className="cyber-home-orbit cyber-home-orbit-blue" />
          <span className="cyber-home-orbit cyber-home-orbit-purple" />
        </div>
        <h1 id="cyber-home-title">CyberSaathi <span>AI</span></h1>
        <p className="cyber-home-tagline">Your Digital World. <span>Our Protection.</span></p>
        <p className="cyber-home-description">
          Experience smarter cybersecurity powered by intelligent AI agents.
          Detect threats, prevent scams, and stay protected online.
        </p>
        <div aria-label="CyberSaathi AI features" className="cyber-home-features" id="explore">
          {features.map(({ title, icon: Icon }) => (
            <article className="cyber-home-feature" key={title}>
              <span className="cyber-home-feature-icon"><Icon aria-hidden="true" size={26} /></span>
              <span>{title}</span>
            </article>
          ))}
        </div>
        <Link className="intro-get-started" to="/register">
          Get Started <ArrowRight aria-hidden="true" size={18} />
        </Link>
        <a className="cyber-home-scroll" href="#explore">
          Scroll to Explore <ArrowDown aria-hidden="true" size={16} />
        </a>
      </section>
    </main>
  )
}
