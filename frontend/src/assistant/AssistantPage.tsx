import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  Mic,
  Pause,
  Plus,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  AssistantApiError,
  createAssistantConversation,
  deleteAssistantConversation,
  listAssistantConversations,
  loadAssistantContextOptions,
  loadAssistantConversation,
  sendAssistantMessage,
  type AssistantContextOptions,
  type AssistantConversation,
  type AssistantLanguage,
  type AssistantMessage,
  type AssistantMode,
} from './assistantApi'
import './Assistant.css'

type RecognitionResult = {
  readonly length: number
  readonly [index: number]: { readonly transcript: string }
}

interface RecognitionResultEvent extends Event {
  readonly results: RecognitionResult
}

interface RecognitionErrorEvent extends Event {
  readonly error: string
}

interface BrowserSpeechRecognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onstart: (() => void) | null
  onresult: ((event: RecognitionResultEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const speechLanguage: Record<AssistantLanguage, string> = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
}

const languageNames: Record<AssistantLanguage, string> = {
  en: 'English',
  te: 'తెలుగు',
  hi: 'हिन्दी',
}

const incidentGuidance: Record<AssistantLanguage, {
  title: string
  steps: string[]
}> = {
  en: {
    title: 'Immediate steps for suspected financial fraud',
    steps: [
      'Contact your bank or payment provider immediately using its official app or the number printed on your card. Ask them to secure the account or payment method.',
      'If money may have been lost in India, call the national cyber fraud helpline at 1930 promptly and report at cybercrime.gov.in.',
      'Keep transaction IDs, amount, date and time, recipient details, and relevant messages or screenshots. Do not edit the originals or share passwords, OTPs, or full card details.',
      'CyberSaathi cannot contact a bank, freeze an account, recover money, or file a complaint for you.',
    ],
  },
  te: {
    title: 'ఆర్థిక మోసం అనుమానం ఉంటే వెంటనే చేయాల్సినవి',
    steps: [
      'మీ బ్యాంక్ లేదా చెల్లింపు సేవ యొక్క అధికారిక యాప్ లేదా కార్డ్‌పై ఉన్న నంబర్ ద్వారా వెంటనే సంప్రదించి ఖాతా లేదా చెల్లింపు మార్గాన్ని భద్రపరచమని అడగండి.',
      'భారతదేశంలో డబ్బు నష్టం జరిగి ఉండవచ్చని అనిపిస్తే, త్వరగా 1930 సైబర్ మోసం హెల్ప్‌లైన్‌కు కాల్ చేసి cybercrime.gov.in లో నివేదించండి.',
      'లావాదేవీ ఐడీలు, మొత్తం, తేదీ/సమయం, స్వీకర్త వివరాలు, సంబంధిత సందేశాలు లేదా స్క్రీన్‌షాట్‌లను భద్రపరచండి. అసలు ఆధారాలను మార్చవద్దు; పాస్‌వర్డ్‌లు, OTPలు లేదా పూర్తి కార్డ్ వివరాలు పంచుకోవద్దు.',
      'CyberSaathi మీ బ్యాంక్‌ను సంప్రదించదు, ఖాతాను నిలిపివేయదు, డబ్బు తిరిగి పొందదు లేదా ఫిర్యాదు నమోదు చేయదు.',
    ],
  },
  hi: {
    title: 'संभावित वित्तीय धोखाधड़ी के लिए तुरंत उठाए जाने वाले कदम',
    steps: [
      'अपने बैंक या भुगतान सेवा से उसके आधिकारिक ऐप या कार्ड पर दिए गए नंबर से तुरंत संपर्क करें और खाते या भुगतान माध्यम को सुरक्षित करने के लिए कहें।',
      'भारत में पैसे का नुकसान हुआ हो सकता है, तो जल्द 1930 साइबर धोखाधड़ी हेल्पलाइन पर कॉल करें और cybercrime.gov.in पर रिपोर्ट करें।',
      'लेन-देन आईडी, राशि, तारीख/समय, प्राप्तकर्ता की जानकारी और संबंधित संदेश या स्क्रीनशॉट सुरक्षित रखें। मूल प्रमाण न बदलें; पासवर्ड, OTP या पूरे कार्ड विवरण साझा न करें।',
      'CyberSaathi बैंक से संपर्क, खाते को फ्रीज़, पैसे की वसूली या शिकायत दर्ज नहीं कर सकता।',
    ],
  },
}

const suggestions: Record<AssistantLanguage, string[]> = {
  en: [
    'I received a call from CBI threatening me with "Digital Arrest". What should I do?',
    'Money was debited from my UPI account without my knowledge. How do I freeze the transaction?',
    'An instant loan app is threatening to message my contacts. How do I handle this extortion?',
    'I got an SMS saying electricity power will be disconnected tonight. Is this genuine?',
    'How can I tell if a payment link is a phishing attempt?',
    'What should I do if I shared an OTP by mistake?',
    'Explain two-factor authentication in simple terms.',
  ],
  te: [
    'నాకు సీబీఐ లేదా పోలీస్ నుండి కాల్ వచ్చి డిజిటల్ అరెస్ట్ చేస్తామని బెదిరిస్తున్నారు. నేను ఏమి చేయాలి?',
    'నా అనుమతి లేకుండా నా యూపీఐ ఖాతా నుండి డబ్బు కట్ అయ్యింది. ట్రాన్సాక్షన్ ఎలా ఫ్రీజ్ చేయించాలి?',
    'ఒక లోన్ యాప్ నా కాంటాక్ట్స్ కి మెసేజ్ చేస్తామని బెదిరిస్తోంది. దీని నుండి ఎలా రక్షణ పొందాలి?',
    'కరెంట్ బిల్లు కట్టలేదని ఈ రాత్రికి కరెంట్ కట్ చేస్తామని మెసేజ్ వచ్చింది. ఇది నిజమేనా?',
    'చెల్లింపు లింక్ ఫిషింగ్ అని ఎలా గుర్తించాలి?',
    'తప్పుగా OTP పంచుకుంటే ఏమి చేయాలి?',
    'రెండు-దశల ధృవీకరణను సులభంగా వివరించండి.',
  ],
  hi: [
    'मुझे सीबीआई अधिकारी का कॉल आया है और वो डिजिटल अरेस्ट की धमकी दे रहे हैं। मुझे क्या करना चाहिए?',
    'मेरे खाते से बिना मेरी जानकारी के यूपीआई से पैसे कट गए हैं। ट्रांजैक्शन कैसे फ्रीज करवाएं?',
    'एक फर्जी लोन ऐप मेरे कॉन्टैक्ट्स को कॉल करके परेशान करने की धमकी दे रहा है। कैसे निपटें?',
    'बिजली बिल बकाया बताकर रात को बिजली काटने का मैसेज आया है। क्या यह असली है?',
    'भुगतान लिंक फ़िशिंग है या नहीं, कैसे पहचानें?',
    'गलती से OTP साझा हो जाए तो क्या करें?',
    'दो-कारक प्रमाणीकरण को सरल भाषा में समझाएँ।',
  ],
}

function messageTime(value: string, language: AssistantLanguage) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(`${language}-IN`, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date)
}

function apiErrorMessage(error: unknown) {
  return error instanceof AssistantApiError || error instanceof Error
    ? error.message
    : 'The assistant request could not be completed.'
}

function selectedLanguage(value: string): AssistantLanguage {
  if (value === 'te' || value === 'hi') return value
  return 'en'
}

function selectedMode(value: string): AssistantMode {
  if (value === 'scan' || value === 'learning' || value === 'incident') return value
  return 'chat'
}

function selectedMoneyLost(value: string): 'yes' | 'no' | 'unsure' | '' {
  if (value === 'yes' || value === 'no' || value === 'unsure') return value
  return ''
}

export default function AssistantPage() {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [conversations, setConversations] = useState<AssistantConversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [language, setLanguage] = useState<AssistantLanguage>('en')
  const [mode, setMode] = useState<AssistantMode>('chat')
  const [draft, setDraft] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingConversation, setLoadingConversation] = useState(false)
  const [sending, setSending] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextOpen, setContextOpen] = useState(false)
  const [contextOptions, setContextOptions] = useState<AssistantContextOptions | null>(null)
  const [loadingContext, setLoadingContext] = useState(false)
  const [scanId, setScanId] = useState('')
  const [investigationId, setInvestigationId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [incidentMoneyLost, setIncidentMoneyLost] = useState<'yes' | 'no' | 'unsure' | ''>('')
  const [voiceStatus, setVoiceStatus] = useState('')
  const [listening, setListening] = useState(false)
  const [speechMessageId, setSpeechMessageId] = useState<string | null>(null)
  const [speechPaused, setSpeechPaused] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef(0)

  const refreshConversations = useCallback(async () => {
    if (!accessToken) return []
    const records = await listAssistantConversations(accessToken)
    setConversations(records)
    return records
  }, [accessToken])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!accessToken) {
        setLoadingHistory(false)
        setError('Sign in again to use CyberSaathi Assistant.')
        return
      }
      setLoadingHistory(true)
      try {
        const records = await listAssistantConversations(accessToken)
        if (!active) return
        setConversations(records)
        const first = records[0]
        if (first) {
          setSelectedId(first.id)
          setLanguage(first.language)
          const detail = await loadAssistantConversation(accessToken, first.id)
          if (!active) return
          setMessages(detail.messages)
        }
      } catch (loadError) {
        if (active) setError(apiErrorMessage(loadError))
      } finally {
        if (active) setLoadingHistory(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [accessToken])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pendingQuestion])

  useEffect(() => () => {
    recognitionRef.current?.stop()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  const selectedConversation = conversations.find((item) => item.id === selectedId) ?? null

  async function handleNewConversation() {
    if (!accessToken || creating) return
    setCreating(true)
    setError(null)
    try {
      const conversation = await createAssistantConversation(accessToken, language)
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)])
      setSelectedId(conversation.id)
      setMessages([])
      setDraft('')
      setMode('chat')
      setIncidentMoneyLost('')
      setContextOptions(null)
      setScanId('')
      setInvestigationId('')
      setLessonId('')
    } catch (createError) {
      setError(apiErrorMessage(createError))
    } finally {
      setCreating(false)
    }
  }

  async function handleSelectConversation(conversationId: string) {
    if (!accessToken || conversationId === selectedId) return
    const requestId = ++requestIdRef.current
    setSelectedId(conversationId)
    setMessages([])
    setLoadingConversation(true)
    setError(null)
    setDraft('')
    try {
      const result = await loadAssistantConversation(accessToken, conversationId)
      if (requestId !== requestIdRef.current) return
      setMessages(result.messages)
      setLanguage(result.conversation.language)
      setContextOptions(null)
      setScanId('')
      setInvestigationId('')
      setLessonId('')
      setMode('chat')
    } catch (loadError) {
      if (requestId === requestIdRef.current) setError(apiErrorMessage(loadError))
    } finally {
      if (requestId === requestIdRef.current) setLoadingConversation(false)
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    if (!accessToken || !window.confirm('Delete this conversation and all of its messages? This cannot be undone.')) return
    try {
      await deleteAssistantConversation(accessToken, conversationId)
      const remaining = conversations.filter((item) => item.id !== conversationId)
      setConversations(remaining)
      if (selectedId === conversationId) {
        setSelectedId(null)
        setMessages([])
        if (remaining[0]) await handleSelectConversation(remaining[0].id)
      }
    } catch (deleteError) {
      setError(apiErrorMessage(deleteError))
    }
  }

  async function handleLoadContextOptions() {
    if (!accessToken || loadingContext) return
    setLoadingContext(true)
    setError(null)
    try {
      setContextOptions(await loadAssistantContextOptions(accessToken))
    } catch (contextError) {
      setError(apiErrorMessage(contextError))
    } finally {
      setLoadingContext(false)
    }
  }

  async function submitQuestion(questionText: string) {
    const content = questionText.trim()
    if (!accessToken || !content || sending) return
    if (!navigator.onLine) {
      setError('CyberSaathi Assistant needs an internet connection. Your message has not been sent.')
      return
    }
    if (mode === 'incident' && !incidentMoneyLost) {
      setError('For incident guidance, first tell us whether money was lost, not lost, or you are unsure.')
      return
    }

    const submittedContent = mode === 'incident'
      ? `Incident response. Money lost: ${incidentMoneyLost}. User report: ${content}`
      : content

    setSending(true)
    setPendingQuestion(submittedContent)
    setError(null)
    setDraft('')

    try {
      let targetId = selectedId
      if (!targetId) {
        setCreating(true)
        try {
          const newConv = await createAssistantConversation(accessToken, language)
          targetId = newConv.id
          setSelectedId(targetId)
          setConversations((items) => [newConv, ...items.filter((item) => item.id !== newConv.id)])
        } finally {
          setCreating(false)
        }
      }

      const result = await sendAssistantMessage(accessToken, targetId, {
        content: submittedContent,
        language,
        mode,
        context: {
          ...(scanId ? { scanId } : {}),
          ...(investigationId ? { investigationId } : {}),
          ...(lessonId ? { lessonId } : {}),
        },
      })
      setMessages((items) => [...items, ...result.messages])
      try {
        const refreshed = await refreshConversations()
        const current = refreshed.find((item) => item.id === targetId)
        if (current) setLanguage(current.language)
      } catch {
        // Conversation refreshed softly
      }
    } catch (sendError) {
      setError(apiErrorMessage(sendError))
    } finally {
      setPendingQuestion(null)
      setSending(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.trim() || sending) return
    await submitQuestion(draft)
  }

  function startVoiceInput() {
    const speechWindow = window as SpeechWindow
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceStatus('Speech recognition is not available in this browser. You can type your question instead.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new Recognition()
    recognition.lang = speechLanguage[language]
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onstart = () => {
      setListening(true)
      setVoiceStatus(`Listening in ${languageNames[language]}. Speak your question now.`)
    }
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) =>
        event.results[index]?.transcript ?? '',
      ).join(' ').trim()
      if (transcript) {
        setDraft((current) => `${current}${current.trim() ? ' ' : ''}${transcript}`.slice(0, 4_000))
        setVoiceStatus('Speech was transcribed. Review the text before sending.')
      } else {
        setVoiceStatus('No speech was transcribed. Please try again or type your question.')
      }
    }
    recognition.onerror = (event) => {
      setListening(false)
      setVoiceStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone access was denied. Allow microphone access in browser settings or type your question.'
        : `Voice input did not complete (${event.error}). You can retry or type your question.`)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setVoiceStatus('Starting microphone input… Your browser may ask for permission.')
    try {
      recognition.start()
    } catch {
      setListening(false)
      setVoiceStatus('Voice input could not start. Check microphone permission or type your question.')
    }
  }

  function speakMessage(message: AssistantMessage) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setVoiceStatus('Speech synthesis is not available in this browser. The answer remains available as text.')
      return
    }
    if (speechMessageId === message.id && window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        setSpeechPaused(false)
      } else {
        window.speechSynthesis.pause()
        setSpeechPaused(true)
      }
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(message.content)
    utterance.lang = speechLanguage[language]
    utterance.onstart = () => {
      setSpeechMessageId(message.id)
      setSpeechPaused(false)
      setVoiceStatus(`Speaking in ${languageNames[language]}.`)
    }
    utterance.onend = () => {
      setSpeechMessageId(null)
      setSpeechPaused(false)
      setVoiceStatus('')
    }
    utterance.onerror = () => {
      setSpeechMessageId(null)
      setSpeechPaused(false)
      setVoiceStatus('Speech playback did not complete. Read the answer above.')
    }
    setSpeechMessageId(message.id)
    setVoiceStatus('Starting speech playback…')
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeechMessageId(null)
    setSpeechPaused(false)
    setVoiceStatus('')
  }

  async function copyMessage(message: AssistantMessage) {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopyStatus(`Copied response from ${messageTime(message.created_at, language)}.`)
    } catch {
      setCopyStatus('Copy is unavailable. Select and copy the response text instead.')
    }
  }

  const activeIncidentGuidance = incidentGuidance[language]

  return (
    <section className="assistant-page" aria-labelledby="assistant-title">
      <header className="assistant-heading">
        <div>
          <p className="eyebrow">CYBERSAATHI AI / PERSONAL CYBER GUIDE</p>
          <h1 id="assistant-title">CyberSaathi Assistant</h1>
          <p>Clear cybersecurity help in English, Telugu, or Hindi—grounded in what you share.</p>
        </div>
        <label className="assistant-language">
          <span>Response language</span>
          <select value={language} onChange={(event) => setLanguage(selectedLanguage(event.target.value))}>
            <option value="en">English</option>
            <option value="te">తెలుగు</option>
            <option value="hi">हिन्दी</option>
          </select>
        </label>
      </header>

      <div className="assistant-workspace">
        <aside className="assistant-history panel" aria-label="Conversation history">
          <div className="assistant-history-heading">
            <div>
              <span className="assistant-section-kicker">YOUR HISTORY</span>
              <h2>Conversations</h2>
            </div>
            <button
              className="assistant-icon-button"
              type="button"
              onClick={() => void handleNewConversation()}
              disabled={creating}
              aria-label="Start a new conversation"
              title="New conversation"
            >
              {creating ? <LoaderCircle className="spin" size={17} /> : <Plus size={18} />}
            </button>
          </div>
          <button className="assistant-new-button" type="button" onClick={() => void handleNewConversation()} disabled={creating}>
            <Plus size={15} aria-hidden="true" />
            New conversation
          </button>
          {loadingHistory
            ? <p className="assistant-history-status" role="status">Loading conversation history…</p>
            : conversations.length
              ? (
                <ul className="assistant-conversation-list">
                  {conversations.map((conversation) => (
                    <li className={selectedId === conversation.id ? 'assistant-conversation active' : 'assistant-conversation'} key={conversation.id}>
                      <button
                        type="button"
                        className="assistant-conversation-select"
                        onClick={() => void handleSelectConversation(conversation.id)}
                        aria-current={selectedId === conversation.id ? 'page' : undefined}
                      >
                        <MessageCircle size={15} aria-hidden="true" />
                        <span>
                          <strong>{conversation.title}</strong>
                          <small>{messageTime(conversation.updated_at, conversation.language)}</small>
                        </span>
                      </button>
                      <button
                        className="assistant-delete-button"
                        type="button"
                        aria-label={`Delete ${conversation.title}`}
                        title="Delete conversation"
                        onClick={() => void handleDeleteConversation(conversation.id)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )
              : <p className="assistant-history-status">Your saved conversations will appear here.</p>}
        </aside>

        <section className="assistant-chat panel" aria-label="Assistant chat">
          <div className="assistant-chat-topline">
            <div>
              <span className="assistant-online-indicator" aria-hidden="true" />
              <strong>{selectedConversation?.title ?? 'A safer next step starts here'}</strong>
            </div>
            <label>
              <span className="sr-only">Assistant mode</span>
              <select value={mode} onChange={(event) => {
                setMode(selectedMode(event.target.value))
                setError(null)
              }}>
                <option value="chat">Cyber help</option>
                <option value="scan">Explain a scan</option>
                <option value="learning">Learning mode</option>
                <option value="incident">Incident response</option>
              </select>
            </label>
          </div>

          <div className="assistant-privacy-note">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Your messages are sent to the server’s configured AI provider and saved in your account. Never include passwords, OTPs, full card numbers, or authentication secrets. Private account context is sent only when you select it below.</span>
          </div>

          <div className="assistant-context">
            <button
              className="assistant-context-toggle"
              type="button"
              aria-expanded={contextOpen}
              onClick={() => setContextOpen((open) => !open)}
            >
              <ShieldCheck size={15} aria-hidden="true" />
              Add my CyberSaathi context
              <span>{scanId || investigationId || lessonId ? 'Selected' : 'Optional'}</span>
            </button>
            {contextOpen && (
              <div className="assistant-context-panel">
                <p>Only selected context is sent to the configured AI provider: scan findings and recommendations; limited investigation timeline notes and evidence counts; or selected lesson text with your own progress and latest quiz review. Raw scan submissions and evidence file bytes are never sent.</p>
                {!contextOptions
                  ? (
                    <button className="assistant-secondary-button" type="button" onClick={() => void handleLoadContextOptions()} disabled={loadingContext}>
                      {loadingContext ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}
                      {loadingContext ? 'Loading your context…' : 'Load my context options'}
                    </button>
                  )
                  : (
                    <div className="assistant-context-fields">
                      <label>
                        <span>Scan result</span>
                        <select value={scanId} onChange={(event) => setScanId(event.target.value)}>
                          <option value="">Do not include a scan</option>
                          {contextOptions.scans.map((scan) => (
                            <option key={scan.id} value={scan.id}>
                              {scan.scan_type.toUpperCase()} · {scan.verdict} · {messageTime(scan.created_at, language)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Investigation</span>
                        <select value={investigationId} onChange={(event) => setInvestigationId(event.target.value)}>
                          <option value="">Do not include a case</option>
                          {contextOptions.investigations.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title} · {item.status.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Academy lesson</span>
                        <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
                          <option value="">Do not include a lesson</option>
                          {contextOptions.lessons.map((lesson) => (
                            <option key={lesson.id} value={lesson.id}>
                              {lesson.title} · {lesson.difficulty}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!contextOptions.scans.length &&
                        !contextOptions.investigations.length &&
                        !contextOptions.lessons.length &&
                        <p>No saved scan, investigation, or Academy lesson is available to select.</p>}
                    </div>
                  )}
              </div>
            )}
          </div>

          <div className="assistant-transcript" aria-live="polite" aria-relevant="additions text">
            {!selectedId && !loadingHistory && (
              <div className="assistant-welcome">
                <div className="assistant-welcome-icon"><ShieldCheck size={26} /></div>
                <h2>What would you like help with?</h2>
                <p>Ask about a suspicious message, safer account settings, a scan result, or a lesson. I’ll explain what is known and what remains uncertain.</p>
                <div className="assistant-suggestions">
                  {suggestions[language].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={sending}
                      onClick={() => void submitQuestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <button className="assistant-primary-button" type="button" onClick={() => void handleNewConversation()} disabled={creating || sending}>
                  <Plus size={16} aria-hidden="true" />
                  Start a conversation
                </button>
              </div>
            )}
            {selectedId && !messages.length && !loadingConversation && (
              <div className="assistant-welcome assistant-welcome-compact">
                <div className="assistant-welcome-icon"><MessageCircle size={25} /></div>
                <h2>Ask CyberSaathi</h2>
                <p>Start with a question. Your first message becomes this conversation’s title.</p>
                <div className="assistant-suggestions">
                  {suggestions[language].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={sending}
                      onClick={() => void submitQuestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {loadingConversation && <p className="assistant-history-status" role="status">Loading messages…</p>}
            {messages.map((message) => (
              <article className={`assistant-message assistant-message-${message.role}`} key={message.id}>
                <div className="assistant-message-avatar" aria-hidden="true">
                  {message.role === 'assistant' ? <ShieldCheck size={16} /> : <span>Y</span>}
                </div>
                <div className="assistant-message-content">
                  <div className="assistant-message-meta">
                    <strong>{message.role === 'assistant' ? 'CyberSaathi Assistant' : 'You'}</strong>
                    <time dateTime={message.created_at}>{messageTime(message.created_at, message.language)}</time>
                  </div>
                  <div className="assistant-message-text">{message.content}</div>
                  {message.role === 'assistant' && message.context_used.length > 0 && (
                    <p className="assistant-context-used">
                      Context used: {message.context_used.map((item) => ({
                        scan: 'your selected scan',
                        investigation: 'your selected investigation',
                        academy: 'your selected Academy lesson',
                      })[item]).join(', ')}.
                    </p>
                  )}
                  {message.role === 'assistant' && (
                    <div className="assistant-message-actions">
                      <button type="button" onClick={() => void copyMessage(message)} aria-label="Copy response">
                        <Copy size={14} aria-hidden="true" /> Copy
                      </button>
                      <button type="button" onClick={() => speakMessage(message)} aria-label={speechMessageId === message.id && speechPaused ? 'Resume speaking' : speechMessageId === message.id ? 'Pause speaking' : 'Read response aloud'}>
                        {speechMessageId === message.id && !speechPaused
                          ? <Pause size={14} aria-hidden="true" />
                          : <Volume2 size={14} aria-hidden="true" />}
                        {speechMessageId === message.id && speechPaused ? 'Resume' : speechMessageId === message.id ? 'Pause' : 'Listen'}
                      </button>
                      {speechMessageId === message.id && (
                        <button type="button" onClick={stopSpeaking} aria-label="Stop speaking">
                          <Square size={13} aria-hidden="true" /> Stop
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {pendingQuestion && (
              <article className="assistant-message assistant-message-user">
                <div className="assistant-message-avatar" aria-hidden="true"><span>Y</span></div>
                <div className="assistant-message-content">
                  <div className="assistant-message-meta"><strong>You</strong><span>Sending…</span></div>
                  <div className="assistant-message-text">{pendingQuestion}</div>
                </div>
              </article>
            )}
            {sending && (
              <div className="assistant-thinking" role="status">
                <LoaderCircle className="spin" size={16} />
                <span>Waiting for the configured AI provider…</span>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {mode === 'incident' && (
            <section className="assistant-incident-card" aria-labelledby="incident-guidance-title">
              <div className="assistant-incident-title">
                <AlertTriangle size={18} aria-hidden="true" />
                <h2 id="incident-guidance-title">{activeIncidentGuidance.title}</h2>
              </div>
              <label className="assistant-money-lost">
                <span>{language === 'te' ? 'డబ్బు నష్టం జరిగిందా?' : language === 'hi' ? 'क्या पैसे का नुकसान हुआ?' : 'Was money lost?'}</span>
                <select value={incidentMoneyLost} onChange={(event) => {
                  setIncidentMoneyLost(selectedMoneyLost(event.target.value))
                  setError(null)
                }}>
                  <option value="">{language === 'te' ? 'ఎంచుకోండి' : language === 'hi' ? 'चुनें' : 'Choose one'}</option>
                  <option value="yes">{language === 'te' ? 'అవును' : language === 'hi' ? 'हाँ' : 'Yes'}</option>
                  <option value="no">{language === 'te' ? 'లేదు' : language === 'hi' ? 'नहीं' : 'No'}</option>
                  <option value="unsure">{language === 'te' ? 'నిశ్చయం లేదు' : language === 'hi' ? 'पता नहीं' : 'Not sure'}</option>
                </select>
              </label>
              {incidentMoneyLost && (
                <>
                  <ol>{activeIncidentGuidance.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  <div className="assistant-incident-links">
                    <a href="tel:1930"><ExternalLink size={14} aria-hidden="true" /> Call 1930</a>
                    <a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer">
                      <ExternalLink size={14} aria-hidden="true" /> Official cybercrime reporting portal
                    </a>
                    <Link to="/investigations"><BookOpen size={14} aria-hidden="true" /> Open investigations to record this incident</Link>
                  </div>
                </>
              )}
            </section>
          )}

          {error && <p className="assistant-error" role="alert">{error}</p>}
          {voiceStatus && <p className="assistant-voice-status" role="status">{voiceStatus}</p>}
          {copyStatus && <p className="assistant-copy-status" role="status"><Check size={14} /> {copyStatus}</p>}

          <form className="assistant-composer" onSubmit={(event) => void handleSubmit(event)}>
            <label className="sr-only" htmlFor="assistant-message-input">Ask your cybersecurity question</label>
            <textarea
              id="assistant-message-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  if (!sending && draft.trim()) {
                    void submitQuestion(draft)
                  }
                }
              }}
              placeholder={language === 'te'
                ? 'మీ సైబర్ భద్రత ప్రశ్నను అడగండి… (Enter నొక్కి పంపండి, Shift+Enter కొత్త లైన్)'
                : language === 'hi'
                  ? 'अपना साइबर सुरक्षा प्रश्न पूछें… (भेजने के लिए Enter दबाएं, नई लाइन के लिए Shift+Enter)'
                  : 'Ask a cybersecurity question… (Press Enter to send, Shift+Enter for new line)'}
              maxLength={4_000}
              rows={2}
              disabled={sending || loadingConversation}
            />
            <div className="assistant-composer-footer">
              <div>
                <button
                  className={listening ? 'assistant-voice-button listening' : 'assistant-voice-button'}
                  type="button"
                  onClick={startVoiceInput}
                  disabled={sending}
                  aria-pressed={listening}
                >
                  <Mic size={16} aria-hidden="true" />
                  {listening ? 'Stop listening' : 'Speak'}
                </button>
                <span className="assistant-character-count">{draft.length}/4000</span>
              </div>
              <button className="assistant-send-button" type="submit" disabled={sending || !draft.trim()}>
                {sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} aria-hidden="true" />}
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  )
}
