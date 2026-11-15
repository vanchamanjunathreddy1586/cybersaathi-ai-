import { useState } from 'react'
import { Camera, FileUp, Fingerprint, Mic, Bell, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

type CaptureKind = 'camera' | 'microphone'

export function DevicePermissionsPage() {
  const [status, setStatus] = useState('')
  const [checking, setChecking] = useState<CaptureKind | null>(null)

  const checkCapture = async (kind: CaptureKind) => {
    setChecking(kind)
    setStatus('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus(`${kind === 'camera' ? 'Camera' : 'Microphone'} access is not available in this browser or context.`)
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: kind === 'microphone',
        video: kind === 'camera',
      })
      stream.getTracks().forEach((track) => track.stop())
      setStatus(`${kind === 'camera' ? 'Camera' : 'Microphone'} access was granted for this check. The media stream was stopped immediately.`)
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      setStatus(name === 'NotAllowedError'
        ? `Access to the ${kind} was denied. You can change this in your browser’s site settings.`
        : name === 'NotFoundError'
          ? `No ${kind} was found on this device.`
          : `The ${kind} could not be checked. ${error instanceof Error ? error.message : 'Try again from a secure HTTPS page.'}`)
    } finally {
      setChecking(null)
    }
  }

  return (
    <section className="permission-center">
      <header>
        <p className="eyebrow">DEVICE CAPABILITIES</p>
        <h1>Permission center</h1>
        <p>CyberSaathi asks only when you choose a feature that needs a browser permission. Nothing is accessed in the background.</p>
      </header>
      {status && <p className="permission-status" role="status">{status}</p>}
      <div className="permission-card-grid">
        <article className="permission-card">
          <Camera size={19} /><div><h2>Camera</h2><p>Needed only when you explicitly start a camera-based call or check. The check below stops its stream immediately.</p></div>
          <button disabled={checking !== null} onClick={() => void checkCapture('camera')} type="button">{checking === 'camera' ? 'Checking…' : 'Check camera access'}</button>
        </article>
        <article className="permission-card">
          <Mic size={19} /><div><h2>Microphone</h2><p>Needed only when you explicitly start a voice or video call. The check below stops its stream immediately.</p></div>
          <button disabled={checking !== null} onClick={() => void checkCapture('microphone')} type="button">{checking === 'microphone' ? 'Checking…' : 'Check microphone access'}</button>
        </article>
        <article className="permission-card">
          <Bell size={19} /><div><h2>Notifications</h2><p>Browser permission is requested only when you enable alerts from your account settings. Push delivery needs server configuration.</p></div>
          <Link to="/security/account">Notification settings</Link>
        </article>
        <article className="permission-card">
          <FileUp size={19} /><div><h2>File uploads</h2><p>Files are selected through the browser’s file picker. CyberSaathi cannot browse your device or read files you have not selected.</p></div>
          <span>Browser-controlled</span>
        </article>
        <article className="permission-card">
          <Fingerprint size={19} /><div><h2>Passkeys</h2><p>Passkey sign-in is not implemented. Use your configured Supabase authentication and account recovery options.</p></div>
          <span>Not available</span>
        </article>
        <article className="permission-card">
          <ShieldCheck size={19} /><div><h2>Device access</h2><p>The app cannot inspect installed apps, messages, device files, or other activity outside the browser permissions you grant.</p></div>
          <span>Not accessed</span>
        </article>
      </div>
    </section>
  )
}
