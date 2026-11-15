import { useEffect, useState } from 'react'
import { Download, Info, WifiOff, X } from 'lucide-react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true)
}

function isIosSafari() {
  const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iosDevice &&
    /safari/i.test(navigator.userAgent) &&
    !/(crios|fxios|edgios)/i.test(navigator.userAgent) &&
    !('MSStream' in window) &&
    !('standalone' in navigator && navigator.standalone === true)
}

export function PwaExperience() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [installed, setInstalled] = useState(isStandalone)
  const [iosInstructions, setIosInstructions] = useState(false)
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [installError, setInstallError] = useState('')
  const [dismissed, setDismissed] = useState(() => {
    const until = Number(localStorage.getItem('cybersaathi-install-dismissed-until') ?? 0)
    return Number.isFinite(until) && until > Date.now()
  })

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
      setIosInstructions(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const dismiss = () => {
    const until = Date.now() + 30 * 24 * 60 * 60 * 1000
    localStorage.setItem('cybersaathi-install-dismissed-until', String(until))
    setDismissed(true)
    setIosInstructions(false)
  }

  const install = async () => {
    if (!promptEvent) return
    setInstallError('')
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') setPromptEvent(null)
      else dismiss()
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : 'The installation prompt could not be opened.')
    }
  }

  const showInstall = !installed && !dismissed && (promptEvent !== null || isIosSafari())
  return (
    <>
      {!online && (
        <div className="pwa-offline-banner" role="status">
          <WifiOff size={16} />
          <span>Offline. Scans, AI, chat, calls, and saved progress need a connection.</span>
        </div>
      )}
      {showInstall && (
        <aside className="pwa-install-card" aria-label="Install CyberSaathi">
          <span className="pwa-install-icon"><Download size={17} /></span>
          <div className="pwa-install-copy">
            <strong>{iosInstructions ? 'Add CyberSaathi to your Home Screen' : 'Take CyberSaathi with you'}</strong>
            <small>
              {iosInstructions
                ? 'In Safari, tap Share, then “Add to Home Screen”.'
                : 'Install the app for a focused, standalone experience.'}
            </small>
            {installError && <small role="alert">{installError}</small>}
          </div>
          {promptEvent && <button className="pwa-install-action" onClick={() => void install()} type="button">Install</button>}
          {isIosSafari() && <button className="pwa-install-action" onClick={() => setIosInstructions((open) => !open)} type="button"><Info size={15} />{iosInstructions ? 'Hide' : 'How?'}</button>}
          <button aria-label="Dismiss install suggestion" className="pwa-dismiss" onClick={dismiss} type="button"><X size={15} /></button>
        </aside>
      )}
    </>
  )
}
