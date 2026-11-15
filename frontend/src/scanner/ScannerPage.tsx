import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowUpRight,
  Camera,
  Check,
  Copy,
  FileImage,
  Link2,
  Mail,
  MessageSquareText,
  QrCode,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ScanReportView } from './ScanReportView'
import { analyzeContent, ScannerApiError, type ScanReport, type ScanType } from './scannerApi'
import './scanner.css'

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}
type BarcodeWindow = Window & {
  BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike
}

const scanOptions: Array<{
  type: ScanType
  label: string
  description: string
  icon: typeof Link2
}> = [
  { type: 'url', label: 'URL Scanner', description: 'Inspect a suspicious link', icon: Link2 },
  { type: 'sms', label: 'SMS Scanner', description: 'Analyze a text message', icon: MessageSquareText },
  { type: 'email', label: 'Email Scanner', description: 'Review email content and headers', icon: Mail },
  { type: 'qr', label: 'QR Code Scanner', description: 'Decode locally before review', icon: QrCode },
]

const scanLabels: Record<ScanType, string> = {
  url: 'URL',
  sms: 'SMS',
  email: 'Email',
  qr: 'QR code',
}

export function ScannerPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [type, setType] = useState<ScanType>('url')
  const [content, setContent] = useState('')
  const [sender, setSender] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [subject, setSubject] = useState('')
  const [headers, setHeaders] = useState('')
  const [allowExternalChecks, setAllowExternalChecks] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<ScanReport | null>(null)
  const [historySaved, setHistorySaved] = useState<boolean | undefined>()
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraMessage, setCameraMessage] = useState('')
  const [decoded, setDecoded] = useState('')
  const [copied, setCopied] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectingRef = useRef(false)

  useEffect(() => {
    if (!cameraActive) return
    let active = true
    let timer: number | undefined
    const videoElement = videoRef.current
    const barcode = (window as BarcodeWindow).BarcodeDetector
    if (!barcode) {
      return
    }

    detectorRef.current = new barcode({ formats: ['qr_code'] })
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoElement) {
          videoElement.srcObject = stream
          void videoElement.play()
        }
        setCameraMessage('Camera is active. Hold a QR code in view to decode it on this device.')
        timer = window.setInterval(() => {
          const detector = detectorRef.current
          if (!videoElement || !detector || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || detectingRef.current) return
          detectingRef.current = true
          void detector.detect(videoElement).then((codes) => {
            const value = codes[0]?.rawValue
            if (active && value) {
              setDecoded(value)
              setContent(value)
              setCameraMessage('QR content decoded locally. Review it before choosing Analyze.')
              setCameraActive(false)
            }
          }).catch(() => {
            if (active) setCameraMessage('The camera frame could not be decoded. Adjust the image and try again.')
          }).finally(() => {
            detectingRef.current = false
          })
        }, 500)
      })
      .catch((cameraError: unknown) => {
        if (!active) return
        setCameraActive(false)
        const denied = cameraError instanceof DOMException &&
          (cameraError.name === 'NotAllowedError' || cameraError.name === 'SecurityError')
        setCameraMessage(denied
          ? 'Camera permission was denied. Allow camera access in browser settings or upload a QR image instead.'
          : 'Camera access is unavailable. Use the image upload option instead.')
      })

    return () => {
      active = false
      if (timer !== undefined) window.clearInterval(timer)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      if (videoElement) videoElement.srcObject = null
    }
  }, [cameraActive])

  const resetReport = () => {
    setError('')
    setReport(null)
    setHistorySaved(undefined)
  }

  const handleScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    if (!session?.access_token) {
      setError('Your secure session is not ready. Sign in again and retry.')
      return
    }

    if (!content.trim()) {
      setError(type === 'qr' ? 'Decode a QR image or use the camera before analyzing.' : 'Enter content to analyze.')
      return
    }

    setBusy(true)
    setError('')
    setReport(null)
    try {
      const result = await analyzeContent(session.access_token, {
        type,
        content: content.trim(),
        ...(type === 'email'
          ? {
              metadata: {
                ...(sender.trim() ? { sender: sender.trim() } : {}),
                ...(replyTo.trim() ? { replyTo: replyTo.trim() } : {}),
                ...(subject.trim() ? { subject: subject.trim() } : {}),
                ...(headers.trim() ? { headers: headers.trim() } : {}),
              },
            }
          : {}),
        allowExternalChecks,
      })
      setReport(result.report)
      setHistorySaved(result.historySaved)
    } catch (scanError) {
      setError(scanError instanceof ScannerApiError
        ? scanError.message
        : 'The scan could not be completed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleImage = async (file: File | undefined) => {
    if (!file) return
    resetReport()
    setDecoded('')
    setContent('')
    const barcode = (window as BarcodeWindow).BarcodeDetector
    if (!barcode) {
      setCameraMessage('This browser does not support local QR detection. Use a supported Chromium browser.')
      return
    }
    try {
      const detector = new barcode({ formats: ['qr_code'] })
      const bitmap = await createImageBitmap(file)
      try {
        const codes = await detector.detect(bitmap)
        const value = codes[0]?.rawValue
        if (!value) {
          setCameraMessage('No readable QR code was found in that image.')
          return
        }
        setDecoded(value)
        setContent(value)
        setCameraMessage('QR content decoded locally. Review it before choosing Analyze.')
      } finally {
        bitmap.close()
      }
    } catch {
      setCameraMessage('The image could not be decoded locally. Try a clear image with the QR code in focus.')
    }
  }

  const startCamera = () => {
    resetReport()
    setCameraMessage('')
    if (!(window as BarcodeWindow).BarcodeDetector) {
      setCameraMessage('This browser does not support local QR detection. Try a supported Chromium browser or upload an image.')
      return
    }
    setCameraActive(true)
  }

  const copyDecoded = async () => {
    try {
      await navigator.clipboard.writeText(decoded)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCameraMessage('Copy was blocked by the browser. Select and copy the decoded text manually.')
    }
  }

  return (
    <div className="scanner-page">
      <header className="scanner-page-heading">
        <div>
          <p className="eyebrow">CYBERSAATHI AI / THREAT ANALYSIS</p>
          <h1>Scam scanner</h1>
          <p>Analyze content you choose to submit. Nothing is collected from your device automatically.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => navigate('/history')}>
          View scan history <ArrowUpRight aria-hidden="true" size={16} />
        </button>
      </header>

      <div className="scanner-layout">
        <section className="scanner-composer panel" aria-labelledby="scanner-tools-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ANALYSIS TOOLS</p>
              <h2 id="scanner-tools-title">Choose what to scan</h2>
            </div>
            <span className="scanner-pulse" aria-hidden="true"><ScanSearch size={19} /></span>
          </div>

          <div className="scan-type-grid" role="tablist" aria-label="Scanner type">
            {scanOptions.map(({ type: optionType, label, description, icon: Icon }) => (
              <button
                aria-selected={type === optionType}
                className={`scan-type-option${type === optionType ? ' scan-type-selected' : ''}`}
                key={optionType}
                onClick={() => {
                  setType(optionType)
                  setAllowExternalChecks(false)
                  setCameraActive(false)
                  setCameraMessage('')
                  resetReport()
                }}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" size={19} />
                <span><strong>{label}</strong><small>{description}</small></span>
              </button>
            ))}
          </div>

          <form className="scan-form" onSubmit={(event) => void handleScan(event)}>
            {type === 'url' && (
              <label className="scanner-field">
                <span>Suspicious URL</span>
                <input
                  autoComplete="url"
                  onChange={(event) => { setContent(event.target.value); resetReport() }}
                  placeholder="https://example.com"
                  required
                  type="url"
                  value={content}
                />
              </label>
            )}
            {type === 'sms' && (
              <label className="scanner-field">
                <span>SMS message</span>
                <textarea
                  onChange={(event) => { setContent(event.target.value); resetReport() }}
                  placeholder="Paste the message you want to check…"
                  required
                  rows={7}
                  value={content}
                />
              </label>
            )}
            {type === 'email' && (
              <div className="email-scan-fields">
                <div className="scanner-field-row">
                  <label className="scanner-field">
                    <span>From address</span>
                    <input autoComplete="email" onChange={(event) => setSender(event.target.value)} placeholder="sender@example.com" type="email" value={sender} />
                  </label>
                  <label className="scanner-field">
                    <span>Reply-To address</span>
                    <input onChange={(event) => setReplyTo(event.target.value)} placeholder="Optional" type="email" value={replyTo} />
                  </label>
                </div>
                <label className="scanner-field">
                  <span>Subject</span>
                  <input onChange={(event) => setSubject(event.target.value)} placeholder="Email subject" value={subject} />
                </label>
                <label className="scanner-field">
                  <span>Email content</span>
                  <textarea onChange={(event) => { setContent(event.target.value); resetReport() }} placeholder="Paste the email body you want to review…" required rows={6} value={content} />
                </label>
                <label className="scanner-field">
                  <span>Optional raw headers</span>
                  <textarea onChange={(event) => setHeaders(event.target.value)} placeholder="Paste headers only if you want to inspect supplied SPF/DKIM/DMARC evidence." rows={4} value={headers} />
                </label>
              </div>
            )}
            {type === 'qr' && (
              <div className="qr-scanner-tools">
                <p className="qr-privacy-note"><ShieldCheck aria-hidden="true" size={17} /> QR images are decoded locally and are not uploaded.</p>
                <div className="qr-actions">
                  <button className="button button-secondary" disabled={cameraActive} onClick={startCamera} type="button">
                    <Camera aria-hidden="true" size={17} /> Scan QR with camera
                  </button>
                  <label className="button button-secondary qr-upload-button">
                    <FileImage aria-hidden="true" size={17} /> Upload QR image
                    <input
                      accept="image/*"
                      aria-label="Upload QR image"
                      onChange={(event) => void handleImage(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                  {cameraActive && (
                    <button className="icon-button" aria-label="Stop camera" onClick={() => setCameraActive(false)} type="button">
                      <X aria-hidden="true" size={18} />
                    </button>
                  )}
                </div>
                {cameraActive && <video className="qr-camera-preview" muted playsInline ref={videoRef} />}
                {cameraMessage && <p className="qr-camera-message" role="status">{cameraMessage}</p>}
                {decoded && (
                  <div className="qr-decoded-content">
                    <div className="qr-decoded-heading">
                      <span><Smartphone aria-hidden="true" size={16} /> Decoded content</span>
                      <button className="text-button" onClick={() => void copyDecoded()} type="button">
                        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p>{decoded}</p>
                    <small>Destination is not opened automatically. Review it before analysis.</small>
                  </div>
                )}
              </div>
            )}

            {type !== 'qr' && (
              <label className="external-sharing-consent">
                <input
                  checked={allowExternalChecks}
                  onChange={(event) => setAllowExternalChecks(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  {type === 'url'
                    ? 'Allow configured reputation providers to receive this URL.'
                    : 'Allow configured reputation providers to receive up to the first three links extracted from this content.'}
                  The message or email text itself is not sent to these providers.
                </span>
              </label>
            )}
            {type === 'qr' && decoded && (
              <label className="external-sharing-consent">
                <input checked={allowExternalChecks} onChange={(event) => setAllowExternalChecks(event.target.checked)} type="checkbox" />
                <span>Allow configured reputation providers to receive up to the first three URLs extracted from decoded content. The QR image and non-URL text are not shared.</span>
              </label>
            )}

            <div className="scan-submit-row">
              <p><ShieldCheck aria-hidden="true" size={15} /> Deterministic analysis runs without external AI.</p>
              <button className="button button-primary scan-submit" disabled={busy || (type === 'qr' && !decoded)} type="submit">
                {busy ? <><span className="button-spinner" /> Analyzing…</> : <><ScanSearch aria-hidden="true" size={17} /> Analyze {scanLabels[type]}</>}
              </button>
            </div>
            {error && <p className="scanner-error" role="alert">{error}</p>}
          </form>

          <div className="scanner-privacy">
            <ShieldCheck aria-hidden="true" size={17} />
            <p><strong>Privacy-first analysis</strong><span>Raw submitted content is not saved to scan history or written to application logs. Only selected evidence and report metadata are retained.</span></p>
          </div>
        </section>

        <aside className="scanner-side-panel">
          <section className="analysis-method-card panel">
            <span className="analysis-method-icon"><ScanSearch aria-hidden="true" size={19} /></span>
            <h2>Evidence, not guesses</h2>
            <p>Risk scores are based on transparent local indicators and configured provider results. Unknown checks never count as clean.</p>
            <ul>
              <li>Risk and confidence are reported separately.</li>
              <li>Provider findings are labeled with their source.</li>
              <li>No submitted URL is opened or fetched by this server.</li>
            </ul>
          </section>
          <section className="scanner-notice panel">
            <span className="scanner-notice-icon"><ShieldCheck aria-hidden="true" size={17} /></span>
            <p><strong>Use a trusted channel</strong><span>Never share OTPs, approve unexpected payment requests, or install remote-access tools at the request of an unknown sender.</span></p>
          </section>
          <button className="scanner-text-link" onClick={() => navigate('/history')} type="button">
            Review previous scans <ArrowUpRight aria-hidden="true" size={15} />
          </button>
        </aside>
      </div>

      {report && <ScanReportView historySaved={historySaved} report={report} />}
    </div>
  )
}
