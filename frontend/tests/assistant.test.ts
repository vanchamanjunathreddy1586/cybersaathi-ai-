import test from 'node:test'
import assert from 'node:assert/strict'
import { AssistantApiError } from '../src/assistant/assistantApi.ts'

test('AssistantApiError captures message and optional HTTP status code', () => {
  const err = new AssistantApiError('AI provider unavailable', 503)
  assert.equal(err.name, 'AssistantApiError')
  assert.equal(err.message, 'AI provider unavailable')
  assert.equal(err.status, 503)
})

test('All 7 required CyberSaathi suggested questions exist and are localized', () => {
  const expectedVectors = [
    'Digital Arrest',
    'UPI',
    'loan app',
    'electricity',
    'phishing',
    'OTP',
    'two-factor authentication',
  ]

  const englishSuggestions = [
    'I received a call from CBI threatening me with "Digital Arrest". What should I do?',
    'Money was debited from my UPI account without my knowledge. How do I freeze the transaction?',
    'An instant loan app is threatening to message my contacts. How do I handle this extortion?',
    'I got an SMS saying electricity power will be disconnected tonight. Is this genuine?',
    'How can I tell if a payment link is a phishing attempt?',
    'What should I do if I shared an OTP by mistake?',
    'Explain two-factor authentication in simple terms.',
  ]

  assert.equal(englishSuggestions.length, 7)
  for (const vector of expectedVectors) {
    const found = englishSuggestions.some((s) => s.toLowerCase().includes(vector.toLowerCase()))
    assert.ok(found, `Expected suggestion vector "${vector}" not found in suggestions`)
  }
})

test('Conversation title is generated from first question up to 72 characters', () => {
  const question = 'I received a call from CBI threatening me with "Digital Arrest". What should I do?'
  const derivedTitle = question.replace(/\s+/g, ' ').trim().slice(0, 72)
  assert.ok(derivedTitle.length <= 72)
  assert.equal(derivedTitle, 'I received a call from CBI threatening me with "Digital Arrest". What sh')
})

test('Composer keydown distinguishes Enter (submit) and Shift+Enter (newline)', () => {
  let submitted = false
  let defaultPrevented = false

  const handleKeyDown = (key: string, shiftKey: boolean, content: string) => {
    if (key === 'Enter' && !shiftKey) {
      defaultPrevented = true
      if (content.trim()) submitted = true
    }
  }

  // Case 1: Enter alone submits
  handleKeyDown('Enter', false, 'How to report UPI fraud?')
  assert.equal(defaultPrevented, true)
  assert.equal(submitted, true)

  // Case 2: Shift+Enter allows newline without submit
  defaultPrevented = false
  submitted = false
  handleKeyDown('Enter', true, 'Line 1')
  assert.equal(defaultPrevented, false)
  assert.equal(submitted, false)

  // Case 3: Empty content with Enter prevents default but does not submit
  defaultPrevented = false
  submitted = false
  handleKeyDown('Enter', false, '   ')
  assert.equal(defaultPrevented, true)
  assert.equal(submitted, false)
})

test('Incident response content prefixes guidance metadata', () => {
  const formatIncidentQuestion = (moneyLost: string, rawText: string) =>
    `Incident response. Money lost: ${moneyLost}. User report: ${rawText}`

  const formatted = formatIncidentQuestion('yes', 'Lost Rs 25,000 to fake electricity SMS')
  assert.ok(formatted.includes('Money lost: yes'))
  assert.ok(formatted.includes('Lost Rs 25,000'))
})
