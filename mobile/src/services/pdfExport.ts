import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface IncidentReportData {
  caseTitle: string;
  caseId: string;
  category: string;
  severity: string;
  status: string;
  incidentDate: string;
  financialLoss?: string;
  description: string;
  evidenceItems?: Array<{ title: string; type: string; timestamp: string }>;
  recommendedActions?: string[];
}

export async function generateAndShareIncidentPdf(report: IncidentReportData): Promise<string> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>CyberSaathi Incident Report - ${report.caseId}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            padding: 30px;
            line-height: 1.5;
          }
          .header {
            border-bottom: 3px solid #6366F1;
            padding-bottom: 12px;
            margin-bottom: 24px;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #0B1120;
          }
          .accent {
            color: #6366F1;
          }
          .tagline {
            font-size: 12px;
            color: #6B7280;
            margin-top: 4px;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge-high {
            background-color: #FEE2E2;
            color: #DC2626;
          }
          .badge-medium {
            background-color: #FEF3C7;
            color: #D97706;
          }
          .badge-low {
            background-color: #D1FAE5;
            color: #059669;
          }
          .grid {
            display: table;
            width: 100%;
            margin-bottom: 20px;
          }
          .row {
            display: table-row;
          }
          .col-label {
            display: table-cell;
            width: 30%;
            font-weight: 600;
            color: #4B5563;
            padding: 6px 0;
          }
          .col-val {
            display: table-cell;
            width: 70%;
            color: #111827;
            padding: 6px 0;
          }
          .section {
            margin-top: 24px;
            background: #F9FAFB;
            border-radius: 8px;
            padding: 16px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #1F2937;
            margin-bottom: 10px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #E5E7EB;
            font-size: 11px;
            color: #9CA3AF;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">CyberSaathi <span class="accent">AI</span></div>
          <div class="tagline">Your Digital World. Our Protection. &bull; Official Incident Summary</div>
        </div>

        <h2>${report.caseTitle}</h2>
        
        <div class="grid">
          <div class="row">
            <div class="col-label">Case Identifier:</div>
            <div class="col-val"><code>${report.caseId}</code></div>
          </div>
          <div class="row">
            <div class="col-label">Category:</div>
            <div class="col-val">${report.category}</div>
          </div>
          <div class="row">
            <div class="col-label">Severity Level:</div>
            <div class="col-val">
              <span class="badge ${
                report.severity === 'high' || report.severity === 'critical'
                  ? 'badge-high'
                  : report.severity === 'medium'
                  ? 'badge-medium'
                  : 'badge-low'
              }">
                ${report.severity}
              </span>
            </div>
          </div>
          <div class="row">
            <div class="col-label">Date of Incident:</div>
            <div class="col-val">${report.incidentDate}</div>
          </div>
          ${
            report.financialLoss
              ? `
          <div class="row">
            <div class="col-label">Reported Financial Loss:</div>
            <div class="col-val"><strong>${report.financialLoss}</strong></div>
          </div>`
              : ''
          }
        </div>

        <div class="section">
          <div class="section-title">Incident Narrative</div>
          <p>${report.description}</p>
        </div>

        ${
          report.evidenceItems && report.evidenceItems.length > 0
            ? `
        <div class="section">
          <div class="section-title">Attached Evidence Items (${report.evidenceItems.length})</div>
          <ul>
            ${report.evidenceItems
              .map(
                (item) => `
              <li><strong>${item.title}</strong> (${item.type}) &mdash; Recorded: ${item.timestamp}</li>
            `
              )
              .join('')}
          </ul>
        </div>`
            : ''
        }

        ${
          report.recommendedActions && report.recommendedActions.length > 0
            ? `
        <div class="section">
          <div class="section-title">Immediate Response Actions</div>
          <ol>
            ${report.recommendedActions
              .map(
                (act) => `
              <li>${act}</li>
            `
              )
              .join('')}
          </ol>
        </div>`
            : ''
        }

        <div class="footer">
          Generated automatically by CyberSaathi AI Mobile Companion.<br />
          For emergency financial fraud assistance in India, dial the Cyber Crime Helpline: <strong>1930</strong> or visit <strong>cybercrime.gov.in</strong>.
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html: htmlContent });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `CyberSaathi Report: ${report.caseId}`,
      UTI: 'com.adobe.pdf',
    });
  }

  return uri;
}
