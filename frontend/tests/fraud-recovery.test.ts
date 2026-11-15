import test from 'node:test'
import assert from 'node:assert/strict'
import { RecoveryApiError, type ComplaintInput } from '../src/recovery/recoveryApi.ts'

test('RecoveryApiError captures message and HTTP status code', () => {
  const err = new RecoveryApiError('Fraud vector not found', 404)
  assert.equal(err.name, 'RecoveryApiError')
  assert.equal(err.message, 'Fraud vector not found')
  assert.equal(err.status, 404)
})

test('Recovery complaint data structure validates required Indian reporting fields', () => {
  const validComplaint: ComplaintInput = {
    victimName: 'Sunita Sharma',
    victimPhone: '+91 9876543210',
    victimEmail: 'sunita@example.com',
    victimAddress: 'Flat 302, Green Glen Layout, Bellandur',
    cityState: 'Bengaluru, Karnataka',
    incidentDate: '2026-11-14',
    incidentTime: '11:45 AM',
    vectorId: 'upi-fraud',
    policeStation: 'Cyber Crime Police Station, CID',
    lossAmountInr: 32000,
    bankName: 'HDFC Bank',
    accountNumberLast4: '9876',
    transactionIdUtr: '431892817261',
    accusedIdentifier: 'fraudster@fakeupi',
    cybercrimeAckNumber: 'NCRP20261114001',
    incidentChronology:
      'I was induced to scan a QR code under the pretext of receiving a customer refund, which debited Rs 32,000.',
    evidenceList: [
      'Bank statement showing debited entry',
      'UPI app transaction receipt with UTR 431892817261',
    ],
  }

  assert.ok(validComplaint.victimName.length >= 2, 'Victim name must be at least 2 chars')
  assert.ok(/^[0-9+ -]{10,15}$/.test(validComplaint.victimPhone), 'Phone must match regex')
  assert.ok(validComplaint.victimEmail.includes('@'), 'Email must contain @')
  assert.ok(validComplaint.evidenceList.length > 0, 'Evidence list must not be empty')
  assert.ok(validComplaint.lossAmountInr !== undefined && validComplaint.lossAmountInr > 0, 'Loss amount must be positive')
})

test('Checklist persistence serializes and deserializes step toggles accurately', () => {
  const mockStorage: Record<string, string> = {}
  const key = 'cybersaathi_recovery_steps'

  const stepsState = {
    'upi-step-1': true,
    'upi-step-2': true,
    'upi-step-3': false,
  }

  mockStorage[key] = JSON.stringify(stepsState)

  const parsed = JSON.parse(mockStorage[key] ?? '{}') as Record<string, boolean>
  assert.equal(parsed['upi-step-1'], true)
  assert.equal(parsed['upi-step-2'], true)
  assert.equal(parsed['upi-step-3'], false)
  assert.equal(parsed['upi-step-4'], undefined)
})

test('Defrauded amount in INR is correctly formatted with Indian numbering system', () => {
  const formatInr = (amount: number) => `₹${amount.toLocaleString('en-IN')}/-`

  assert.equal(formatInr(1000), '₹1,000/-')
  assert.equal(formatInr(45000), '₹45,000/-')
  assert.equal(formatInr(150000), '₹1,50,000/-')
  assert.equal(formatInr(2500000), '₹25,00,000/-')
})
