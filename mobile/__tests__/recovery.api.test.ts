import { getEmergencyContacts, draftComplaint } from '../src/api/recovery.api';

describe('Fraud Recovery & Emergency Contacts', () => {
  it('returns Indian Cybercrime Helpline 1930 and national directory', async () => {
    const contacts = await getEmergencyContacts();
    const helpline1930 = contacts.helplines.find((h) => h.number === '1930');
    expect(helpline1930).toBeDefined();
    expect(contacts.banks.length).toBeGreaterThan(0);
  });

  it('generates legal complaint draft with statutory provisions (IT Act 66D, BNS 318)', async () => {
    const draft = await draftComplaint({
      victimName: 'Ankit Sharma',
      phone: '+91 9876543210',
      email: 'ankit@example.com',
      fraudType: 'UPI Fraud',
      incidentDate: '2026-11-16',
      financialLoss: 30000,
      transactionId: 'UTR998877665544',
      bankName: 'SBI',
      incidentSummary: 'Clicked fake electricity disconnection SMS link and lost ₹30,000.',
    });

    expect(draft.formattedText).toContain('Ankit Sharma');
    expect(draft.formattedText).toContain('1930');
    expect(draft.formattedText).toContain('30000');
    expect(draft.statutoryProvisions.length).toBeGreaterThanOrEqual(1);
  });
});
