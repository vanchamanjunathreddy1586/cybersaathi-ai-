import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  Download,
  FilePlus2,
  FileText,
  Fingerprint,
  LoaderCircle,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../auth/supabase'
import {
  addInvestigationEvidence,
  addInvestigationNote,
  analyzeInvestigation,
  createInvestigation,
  deleteInvestigation,
  deleteInvestigationEvidence,
  getInvestigation,
  InvestigationApiError,
  listInvestigations,
  updateInvestigation,
  type Investigation,
  type InvestigationDetail,
  type InvestigationEvidence,
  type InvestigationInsight,
  type InvestigationStatus,
} from './investigationApi'
import './investigations.css'

const evidenceBucket = 'investigation-evidence'
const evidenceMimeTypes = new Set([
  'application/json',
  'application/pdf',
  'message/rfc822',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const maxEvidenceBytes = 10 * 1024 * 1024

function readableError(error: unknown, fallback: string): string {
  return error instanceof InvestigationApiError || error instanceof Error
    ? error.message
    : fallback
}

function formattedDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}

function statusLabel(status: InvestigationStatus): string {
  return status === 'in_progress' ? 'In progress' : status[0].toUpperCase() + status.slice(1)
}

function safeFilename(value: string): string {
  return value.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'investigation'
}

async function downloadReport(investigation: InvestigationDetail): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF()
  let y = 18

  const addBlock = (label: string, value: string) => {
    const lines = pdf.splitTextToSize(`${label}: ${value || 'None recorded'}`, 170)
    if (y + lines.length * 6 > 280) {
      pdf.addPage()
      y = 18
    }
    pdf.text(lines, 20, y)
    y += lines.length * 6 + 4
  }

  pdf.setFontSize(18)
  pdf.text('CyberSaathi AI — Investigation Report', 20, y)
  y += 12
  pdf.setFontSize(10)
  addBlock('Title', investigation.title)
  addBlock('Status', statusLabel(investigation.status))
  addBlock('Created', formattedDate(investigation.created_at))
  addBlock('Last updated', formattedDate(investigation.updated_at))
  addBlock('Case description', investigation.description)
  y += 2
  pdf.setFontSize(13)
  pdf.text('Timeline', 20, y)
  y += 8
  pdf.setFontSize(10)
  for (const event of investigation.events) {
    addBlock(formattedDate(event.created_at), `${event.summary} (${event.event_type.replaceAll('_', ' ')})`)
  }
  y += 2
  if (y > 275) {
    pdf.addPage()
    y = 18
  }
  pdf.setFontSize(13)
  pdf.text('Evidence register', 20, y)
  y += 8
  pdf.setFontSize(10)
  if (investigation.evidence.length === 0) {
    addBlock('Evidence', 'No files attached')
  }
  for (const item of investigation.evidence) {
    addBlock(item.file_name, `${item.mime_type}, ${item.size_bytes} bytes, SHA-256 ${item.sha256}`)
  }
  pdf.setFontSize(8)
  addBlock('Privacy note', 'This report contains user-provided case notes and evidence metadata. Attached file contents are not embedded. SHA-256 values are computed in the browser and are not independently verified by the server.')
  pdf.save(`${safeFilename(investigation.title)}-report.pdf`)
}

export function InvestigationRoom() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const accessToken = session?.access_token
  const [records, setRecords] = useState<Investigation[]>([])
  const [detail, setDetail] = useState<InvestigationDetail | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<InvestigationStatus>('open')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [allowExternalAnalysis, setAllowExternalAnalysis] = useState(false)
  const [insight, setInsight] = useState<InvestigationInsight | null>(null)
  const [aiMessage, setAiMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const loadKey = `${accessToken ?? ''}:${id ?? ''}`
  const loading = loadedKey !== loadKey

  useEffect(() => {
    if (!accessToken) return
    let active = true
    const load = id
      ? getInvestigation(accessToken, id).then((value) => {
        if (active) {
          setError('')
          setDetail(value)
          setTitle(value.title)
          setDescription(value.description)
          setStatus(value.status)
        }
      })
      : listInvestigations(accessToken).then((value) => {
        if (active) {
          setError('')
          setRecords(value)
        }
      })
    void load.catch((loadError: unknown) => {
      if (active) setError(readableError(loadError, 'Investigation data could not be loaded.'))
    }).finally(() => {
      if (active) setLoadedKey(loadKey)
    })
    return () => { active = false }
  }, [accessToken, id, loadKey])

  const refreshDetail = async (investigationId: string) => {
    if (!accessToken) return
    const value = await getInvestigation(accessToken, investigationId)
    setDetail(value)
    setTitle(value.title)
    setDescription(value.description)
    setStatus(value.status)
  }

  const createCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken) return
    setBusy(true)
    setError('')
    try {
      const created = await createInvestigation(accessToken, { title, description })
      navigate(`/investigations/${created.id}`)
    } catch (createError) {
      setError(readableError(createError, 'The investigation could not be created.'))
    } finally {
      setBusy(false)
    }
  }

  const saveCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !accessToken || !detail) return
    setBusy(true)
    setError('')
    try {
      await updateInvestigation(accessToken, detail.id, { title, description, status })
      await refreshDetail(detail.id)
    } catch (saveError) {
      setError(readableError(saveError, 'The investigation could not be updated.'))
    } finally {
      setBusy(false)
    }
  }

  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !accessToken || !detail) return
    setBusy(true)
    setError('')
    try {
      await addInvestigationNote(accessToken, detail.id, note)
      setNote('')
      setInsight(null)
      await refreshDetail(detail.id)
    } catch (noteError) {
      setError(readableError(noteError, 'The timeline note could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  const uploadEvidence = async (file: File) => {
    if (busy || !accessToken || !detail || !supabase) {
      if (!accessToken || !detail || !supabase) {
        setError('Supabase is not configured for evidence uploads.')
      }
      return
    }

    if (file.size < 1 || file.size > maxEvidenceBytes || !evidenceMimeTypes.has(file.type)) {
      setError('Choose a supported file up to 10 MB (PDF, image, plain text, CSV, JSON, or EML).')
      return
    }
    if ([...file.name].some((character) => {
      const code = character.charCodeAt(0)
      return character === '/' || character === '\\' || code <= 0x1f || (code >= 0x7f && code <= 0x9f)
    })) {
      setError('The selected file name contains unsupported characters.')
      return
    }

    setBusy(true)
    setError('')
    const evidenceId = crypto.randomUUID()
    const objectPath = `${session.user.id}/${detail.id}/${evidenceId}`
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const sha256 = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
      const { error: uploadError } = await supabase.storage
        .from(evidenceBucket)
        .upload(objectPath, file, {
          cacheControl: '0',
          contentType: file.type,
          upsert: false,
        })
      if (uploadError) throw new Error('The evidence file could not be uploaded to private storage.')

      try {
        await addInvestigationEvidence(accessToken, detail.id, {
          id: evidenceId,
          fileName: file.name,
          objectPath,
          mimeType: file.type,
          sizeBytes: file.size,
          sha256,
        })
      } catch (metadataError) {
        const { error: cleanupError } = await supabase.storage.from(evidenceBucket).remove([objectPath])
        if (cleanupError) {
          throw new Error(
            'Evidence metadata could not be saved and the uploaded file could not be cleaned up. Contact support with this investigation ID.',
            { cause: metadataError },
          )
        }
        throw metadataError
      }

      setInsight(null)
      await refreshDetail(detail.id)
    } catch (uploadError) {
      setError(readableError(uploadError, 'The evidence file could not be added.'))
    } finally {
      setBusy(false)
    }
  }

  const openEvidence = async (item: InvestigationEvidence) => {
    if (!supabase) {
      setError('Supabase is not configured for evidence downloads.')
      return
    }
    const newTab = window.open('about:blank', '_blank')
    if (!newTab) {
      setError('Allow pop-ups to open the private evidence download.')
      return
    }
    newTab.opener = null
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from(evidenceBucket)
        .createSignedUrl(item.object_path, 60, { download: item.file_name })
      if (signedUrlError) throw new Error('The private evidence file could not be opened.')
      newTab.location.href = data.signedUrl
    } catch (downloadError) {
      newTab.close()
      setError(readableError(downloadError, 'The evidence file could not be opened.'))
    }
  }

  const removeEvidence = async (item: InvestigationEvidence) => {
    if (busy || !accessToken || !detail) return
    if (!window.confirm(`Delete "${item.file_name}" from this investigation?`)) return
    setBusy(true)
    setError('')
    try {
      await deleteInvestigationEvidence(accessToken, detail.id, item.id)
      setInsight(null)
      await refreshDetail(detail.id)
    } catch (deleteError) {
      setError(readableError(deleteError, 'The evidence file could not be deleted.'))
    } finally {
      setBusy(false)
    }
  }

  const removeCase = async () => {
    if (busy || !accessToken || !detail) return
    if (!window.confirm('Delete this investigation, its timeline, and attached evidence? This cannot be undone.')) return
    setBusy(true)
    setError('')
    try {
      await deleteInvestigation(accessToken, detail.id)
      navigate('/investigations')
    } catch (deleteError) {
      setError(readableError(deleteError, 'The investigation could not be deleted.'))
    } finally {
      setBusy(false)
    }
  }

  const runAnalysis = async () => {
    if (busy || !accessToken || !detail || !allowExternalAnalysis) return
    setBusy(true)

    setError('')
    setAiMessage('')
    setInsight(null)
    try {
      const result = await analyzeInvestigation(accessToken, detail.id)
      if (result.status === 'available') setInsight(result.insight)
      else setAiMessage(result.reason)
    } catch (analysisError) {
      setError(readableError(analysisError, 'AI analysis could not be completed.'))
    } finally {
      setBusy(false)
    }
  }

  const visibleRecords = records.filter((record) =>
    `${record.title} ${record.description} ${record.status}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  if (id) {
    return (
      <div className="investigation-page">
        <header className="investigation-heading">
          <div>
            <Link className="investigation-back" to="/investigations"><ArrowLeft size={15} /> All investigations</Link>
            <p className="eyebrow">CYBERSAATHI AI / INVESTIGATION ROOM</p>
            <h1>{detail?.title ?? 'Investigation'}</h1>
            <p>Keep notes, evidence metadata, and a factual timeline together.</p>
          </div>
          <div className="investigation-heading-actions">
            {detail && (
              <>
                <button className="button button-secondary" disabled={busy} onClick={() => void downloadReport(detail)} type="button">
                  <Download size={15} /> Download report
                </button>
                <button className="button button-danger" disabled={busy} onClick={() => void removeCase()} type="button">
                  <Trash2 size={15} /> Delete
                </button>
              </>
            )}
          </div>
        </header>

        {loading && <p className="investigation-state" role="status">Loading investigation…</p>}
        {error && <p className="investigation-error" role="alert">{error}</p>}

        {detail && (
          <div className="investigation-detail-grid">
            <div className="investigation-main-column">
              <section className="investigation-panel panel">
                <div className="investigation-panel-heading">
                  <span className="investigation-icon"><ClipboardList size={17} /></span>
                  <div><h2>Case details</h2><p>Only save information you need for this investigation.</p></div>
                </div>
                <form className="investigation-form" onSubmit={(event) => void saveCase(event)}>
                  <label className="investigation-field">
                    <span>Title</span>
                    <input maxLength={120} onChange={(event) => setTitle(event.target.value)} required value={title} />
                  </label>
                  <label className="investigation-field">
                    <span>Description</span>
                    <textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} rows={4} value={description} />
                  </label>
                  <div className="investigation-form-row">
                    <label className="investigation-field">
                      <span>Status</span>
                      <select onChange={(event) => setStatus(event.target.value as InvestigationStatus)} value={status}>
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>
                    <button className="button button-primary" disabled={busy} type="submit">
                      {busy ? <LoaderCircle className="investigation-spinner" size={15} /> : <ShieldCheck size={15} />}
                      Save details
                    </button>
                  </div>
                </form>
              </section>

              <section className="investigation-panel panel">
                <div className="investigation-panel-heading">
                  <span className="investigation-icon"><Fingerprint size={17} /></span>
                  <div><h2>Evidence register</h2><p>Files are private, account-scoped, and never sent to AI.</p></div>
                </div>
                <div className="evidence-upload-row">
                  <button className="button button-secondary" disabled={busy} onClick={() => fileInput.current?.click()} type="button">
                    <Upload size={15} /> Add evidence
                  </button>
                  <input
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.json,.eml,application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv,application/json,message/rfc822"
                    className="visually-hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.currentTarget.value = ''
                      if (file) void uploadEvidence(file)
                    }}
                    ref={fileInput}
                    type="file"
                  />
                  <span>Maximum 10 MB per file. A browser-computed SHA-256 is recorded for reference.</span>
                </div>
                {detail.evidence.length === 0 && <p className="investigation-empty-inline">No evidence files attached.</p>}
                <div className="evidence-list">
                  {detail.evidence.map((item) => (
                    <article className="evidence-item" key={item.id}>
                      <span className="evidence-file-icon"><FileText size={16} /></span>
                      <div className="evidence-file-info">
                        <strong>{item.file_name}</strong>
                        <span>{item.mime_type} · {(item.size_bytes / 1024).toFixed(1)} KB · {formattedDate(item.created_at)}</span>
                        <code>SHA-256 {item.sha256}</code>
                      </div>
                      <div className="evidence-actions">
                        <button aria-label={`Download ${item.file_name}`} className="icon-button" onClick={() => void openEvidence(item)} title="Download private file" type="button">
                          <Download size={15} />
                        </button>
                        <button aria-label={`Delete ${item.file_name}`} className="icon-button" disabled={busy} onClick={() => void removeEvidence(item)} title="Delete evidence" type="button">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="investigation-panel panel">
                <div className="investigation-panel-heading">
                  <span className="investigation-icon"><MessageSquareText size={17} /></span>
                  <div><h2>Investigation timeline</h2><p>Notes are stored as supplied and are visible only to you.</p></div>
                </div>
                <form className="investigation-note-form" onSubmit={(event) => void saveNote(event)}>
                  <label className="visually-hidden" htmlFor="investigation-note">Add a timeline note</label>
                  <textarea id="investigation-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="Record an observation, action, or follow-up…" required rows={3} value={note} />
                  <button className="button button-primary" disabled={busy || !note.trim()} type="submit"><Plus size={15} /> Add note</button>
                </form>
                <ol className="investigation-timeline">
                  {detail.events.map((event) => (
                    <li className={`timeline-event timeline-event-${event.event_type}`} key={event.id}>
                      <span className="timeline-dot" />
                      <div>
                        <p>{event.summary}</p>
                        <span>{event.event_type.replaceAll('_', ' ')} · {formattedDate(event.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <aside className="investigation-side-column">
              <section className="investigation-panel investigation-ai-panel panel">
                <div className="investigation-panel-heading">
                  <span className="investigation-icon investigation-ai-icon"><Sparkles size={17} /></span>
                  <div><h2>Evidence-grounded AI</h2><p>Optional analysis; no raw files are included.</p></div>
                </div>
                <label className="investigation-consent">
                  <input checked={allowExternalAnalysis} onChange={(event) => setAllowExternalAnalysis(event.target.checked)} type="checkbox" />
                  <span>Send this case description, notes, and evidence metadata to the configured AI provider for analysis.</span>
                </label>
                <button className="button button-primary investigation-ai-button" disabled={busy || !allowExternalAnalysis} onClick={() => void runAnalysis()} type="button">
                  {busy ? <LoaderCircle className="investigation-spinner" size={15} /> : <Sparkles size={15} />}
                  Analyze case context
                </button>
                <p className="investigation-ai-disclaimer">AI output is an unverified aid, not proof. Confirm every statement against original evidence. Results are not stored.</p>
                {aiMessage && <p className="investigation-ai-status" role="status">{aiMessage}</p>}
                {insight && <InsightCard insight={insight} detail={detail} />}
              </section>

              <section className="investigation-panel panel">
                <div className="investigation-panel-heading">
                  <span className="investigation-icon"><ShieldCheck size={17} /></span>
                  <div><h2>Privacy & handling</h2></div>
                </div>
                <ul className="investigation-privacy-list">
                  <li>Evidence is kept in a private Supabase bucket with per-user access policies.</li>
                  <li>Only the file name, size, media type, and browser-computed SHA-256 are indexed; hashes are not server-verified.</li>
                  <li>Uploaded files are not executed or inspected automatically.</li>
                  <li>Deleting the case also removes its registered evidence objects.</li>
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="investigation-page">
      <header className="investigation-heading">
        <div>
          <p className="eyebrow">CYBERSAATHI AI / CASE WORKSPACE</p>
          <h1>Investigation room</h1>
          <p>Organize incident notes, private evidence, and a chronological record of your actions.</p>
        </div>
      </header>

      {error && <p className="investigation-error" role="alert">{error}</p>}

      <section className="investigation-create-panel panel">
        <div className="investigation-panel-heading">
          <span className="investigation-icon"><FilePlus2 size={17} /></span>
          <div><h2>Start an investigation</h2><p>Create a private case record for an incident you are reviewing.</p></div>
        </div>
        <form className="investigation-create-form" onSubmit={(event) => void createCase(event)}>
          <label className="investigation-field">
            <span>Case title</span>
            <input maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Suspicious account recovery message" required value={title} />
          </label>
          <label className="investigation-field">
            <span>Initial description <small>Optional</small></span>
            <textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="Summarize what you want to track. Avoid passwords, OTPs, or unnecessary personal data." rows={3} value={description} />
          </label>
          <button className="button button-primary" disabled={busy || !title.trim()} type="submit">
            {busy ? <LoaderCircle className="investigation-spinner" size={15} /> : <Plus size={15} />}
            Create investigation
          </button>
        </form>
      </section>

      <section className="investigation-list-panel">
        <div className="investigation-list-heading">
          <div><h2>Your investigations</h2><p>Only records owned by your signed-in account are shown.</p></div>
          <label className="investigation-search">
            <span className="visually-hidden">Search investigations</span>
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Search investigations…" value={search} />
          </label>
        </div>
        {loading && <p className="investigation-state" role="status">Loading investigations…</p>}
        {!loading && !error && visibleRecords.length === 0 && (
          <div className="investigation-empty panel">
            <span><ClipboardList size={22} /></span>
            <strong>{records.length === 0 ? 'No investigations yet' : 'No cases match your search'}</strong>
            <p>{records.length === 0 ? 'Create a case to start a private timeline and evidence register.' : 'Try a different title, description, or status.'}</p>
          </div>
        )}
        {visibleRecords.length > 0 && (
          <div className="investigation-card-grid">
            {visibleRecords.map((record) => (
              <article className="investigation-case-card panel" key={record.id}>
                <div className="investigation-case-card-top">
                  <span className="investigation-icon"><Fingerprint size={17} /></span>
                  <span className={`investigation-status investigation-status-${record.status}`}>{statusLabel(record.status)}</span>
                </div>
                <h3>{record.title}</h3>
                <p>{record.description || 'No description provided.'}</p>
                <div className="investigation-case-card-bottom">
                  <span>Updated {formattedDate(record.updated_at)}</span>
                  <Link className="button button-secondary" to={`/investigations/${record.id}`}>Open case <ArrowLeft className="open-case-arrow" size={14} /></Link>
                </div>
              </article>
            ))}
          </div>
        )}
        {loading && <span className="visually-hidden"><LoaderCircle aria-hidden="true" /></span>}
      </section>
    </div>
  )
}

function InsightCard({
  insight,
  detail,
}: {
  insight: InvestigationInsight
  detail: InvestigationDetail
}) {
  const referencedEvents = new Set(insight.referencedEventIds)
  const referencedEvidence = new Set(insight.referencedEvidenceIds)
  return (
    <div className="investigation-insight" aria-live="polite">
      <h3>AI analysis (unverified)</h3>
      <p>{insight.summary}</p>
      {insight.referencedEventIds.length > 0 && (
        <div className="investigation-insight-references">
          <strong>Referenced timeline entries</strong>
          {detail.events.filter((event) => referencedEvents.has(event.id)).map((event) => (
            <span key={event.id}>{event.summary}</span>
          ))}
        </div>
      )}
      {insight.referencedEvidenceIds.length > 0 && (
        <div className="investigation-insight-references">
          <strong>Referenced evidence metadata</strong>
          {detail.evidence.filter((item) => referencedEvidence.has(item.id)).map((item) => (
            <span key={item.id}>{item.file_name}</span>
          ))}
        </div>
      )}
      {insight.openQuestions.length > 0 && (
        <div className="investigation-insight-references">
          <strong>Open questions</strong>
          {insight.openQuestions.map((question) => <span key={question}>{question}</span>)}
        </div>
      )}
      {insight.recommendations.length > 0 && (
        <div className="investigation-insight-references">
          <strong>Suggested next steps</strong>
          {insight.recommendations.map((recommendation) => <span key={recommendation}>{recommendation}</span>)}
        </div>
      )}
    </div>
  )
}
