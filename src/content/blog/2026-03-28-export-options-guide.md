---
title: "How to export reports to CSV, JSON, Excel, and HTML from M365 Tenant Reporter"
description: "A comprehensive guide to choosing the right export format for your audience, understanding how each format is generated in-browser, and building recurring export workflows with the zero-storage architecture."
category: "Exports"
reading_time: "14 min read"
featured: true
keywords:
  - csv json excel html export
  - microsoft 365 report export
  - browser generated exports
  - SheetJS excel export
  - zero storage export
  - report export automation
  - export accessibility
  - tenant report download
  - export format comparison
  - microsoft 365 audit export
---

M365 Tenant Reporter supports four export formats because a single tenant snapshot typically serves multiple audiences with different tools, workflows, and expectations. A finance team that needs license utilization data wants an Excel workbook with sortable columns. An automation engineer building a provisioning pipeline wants structured JSON. An external auditor reviewing tenant configuration wants a portable HTML document. A downstream reporting tool expects a flat CSV feed. By offering all four formats, M365 Tenant Reporter ensures that the data collected during a snapshot session can flow into any workflow without format conversion overhead.

## How each format is generated in the browser

A defining architectural characteristic of M365 Tenant Reporter is that all data processing happens in the browser. There is no server-side data store, no backend file generation service, and no intermediate persistence layer. When you click an export button, the application constructs the output file entirely in your browser's memory and offers it as a download. This has important implications for data privacy, performance, and reliability.

### Excel (.xlsx) generation with SheetJS

Excel export is powered by SheetJS (also known as xlsx), an open-source JavaScript library that constructs valid Office Open XML spreadsheet files entirely in memory. When you export to Excel, M365 Tenant Reporter:

1. Constructs a worksheet data array from the report's in-memory dataset.
2. Calls SheetJS to create a workbook object with appropriate column headers, data types (string, number, date), and column widths.
3. Serializes the workbook to a binary `.xlsx` buffer.
4. Creates a Blob URL and triggers the browser's native download dialog.

The resulting file opens natively in Microsoft Excel, Google Sheets, LibreOffice Calc, and other spreadsheet applications. Column headers match the report's on-screen column names, and numeric values are typed as numbers rather than text strings, which means sorting and filtering work correctly without manual type conversion.

### JSON generation

JSON export produces a structured representation of the report data that preserves the full object hierarchy. Each row in the report becomes a JSON object with named properties matching the report schema. The export includes:

- All columns visible in the report UI, using the same property names as the underlying TypeScript interfaces.
- Proper data types: strings for text, numbers for counts, booleans for flags like `accountEnabled` and `isShared`, and ISO 8601 strings for timestamps.
- An array wrapper so the output is always valid JSON that can be parsed by any JSON-capable tool.

JSON export is constructed by serializing the in-memory report array with `JSON.stringify()` and formatting with indentation for human readability. The result is offered as a `.json` file download.

### CSV generation

CSV export produces a flat, comma-separated text file with a header row followed by data rows. M365 Tenant Reporter handles several CSV edge cases to ensure reliable downstream parsing:

- Values containing commas, quotes, or newlines are properly quoted according to RFC 4180.
- Array-valued fields (such as `assignedSkuNames`, which can contain multiple license names) are serialized to a single cell with semicolon delimiters.
- Null and undefined values are represented as empty strings rather than literal "null" or "undefined" text.
- The output uses UTF-8 encoding with a BOM (byte order mark) prefix to ensure correct character rendering when opened in Excel on Windows.

CSV is the most universally compatible format and can be ingested by virtually any data processing tool, from Excel to Python pandas to SQL Server's bulk import utilities.

### HTML generation

HTML export produces a self-contained, single-file HTML document that includes inline CSS styling for table formatting. The document is designed to be viewable in any modern browser without external dependencies. Key characteristics:

- The HTML file includes a styled `<table>` element with `<thead>` and `<tbody>` sections for proper semantic structure.
- Inline CSS provides clean table borders, alternating row colors for readability, and responsive layout that adapts to different screen widths.
- The document title includes the report name and the snapshot timestamp so the file is self-documenting.
- No JavaScript is included in the HTML output, which means the file is safe to open in restricted environments where scripting is disabled.

## When to use which format

Choosing the right export format is a workflow optimization decision. The wrong format creates friction -- a finance analyst who receives JSON will not know what to do with it, and a DevOps engineer who receives an HTML file will need to parse it before the data is useful.

### Excel: the analyst's default

Use Excel when the recipient will work with the data interactively. Excel supports:

- Sorting and filtering columns without additional tooling.
- Pivot tables for summarizing large datasets (e.g., license consumption by SKU family).
- Conditional formatting to highlight exceptions (e.g., SKUs with fewer than 10 available seats, users without MFA).
- Commentary and annotation for collaborative review.
- Integration with Power Query for automated refresh workflows.

Excel is the recommended format for license capacity reviews, budget planning exports, and any workflow where the data will be annotated, shared in a meeting, or attached to a business decision.

### JSON: the automation format

Use JSON when the data needs to feed a programmatic workflow. JSON preserves data types, supports nested structures, and is natively parseable by every modern programming language. Common JSON export scenarios include:

- Feeding a Power Automate flow that creates tickets for unlicensed users.
- Importing into a custom dashboard built with React, Angular, or Vue.
- Loading into a NoSQL database like Cosmos DB or MongoDB for trend analysis across multiple snapshots.
- Processing with a Python script that compares the current snapshot against a baseline and generates a diff report.
- Integrating with Azure Functions or AWS Lambda for event-driven processing.

### CSV: the interoperability standard

Use CSV when the downstream tool expects a flat file or when you need maximum compatibility. CSV is the most widely supported structured data format and works with:

- SQL Server, PostgreSQL, MySQL, and other relational databases via bulk import.
- SIEM platforms (Splunk, Sentinel, Elastic) for security event correlation.
- PowerShell scripts using `Import-Csv` for bulk administration operations.
- Legacy reporting tools that do not support JSON or Excel formats.
- Version control systems where diffing text-based formats is straightforward.

CSV is also the best choice when file size is a concern. It produces the smallest files because it contains no formatting metadata, styling information, or structural overhead.

### HTML: the portable evidence artifact

Use HTML when the export needs to be viewable by anyone, anywhere, without installing software or understanding data formats. HTML exports are particularly valuable for:

- Audit evidence collection where the report must be a self-contained, tamper-evident artifact.
- Email attachments for stakeholders who need to review data on mobile devices.
- Archival in document management systems where the file must be viewable decades from now.
- Sharing with external parties (auditors, consultants, partners) who should not receive raw data in a manipulable format.
- Meeting presentations where the report is projected directly from a browser tab.

## Audience mapping for common scenarios

To streamline your export decisions, here is a practical mapping between common recipients and recommended formats:

| Audience | Recommended format | Reason |
|---|---|---|
| Finance / procurement | Excel | Needs sorting, formulas, cost annotations |
| IT operations / service desk | CSV | Feeds ticketing and workflow systems |
| External auditors | HTML | Self-contained, non-manipulable evidence |
| DevOps / automation engineers | JSON | Machine-readable, typed, structured |
| Executive leadership | HTML or Excel | Viewable without technical skills |
| Compliance / legal | HTML | Portable, timestamped, browser-viewable |
| Partner / MSP | Excel | Familiar format for managed service reports |

## File size considerations

Export file sizes depend on the report type and the number of rows. For a tenant with 1,000 users:

- **CSV** produces the smallest files, typically under 200 KB for the user report.
- **JSON** is slightly larger due to property name repetition and formatting whitespace, typically 250-400 KB.
- **Excel** adds binary overhead from the Office Open XML container format, typically 150-300 KB (compressed).
- **HTML** is the largest format due to inline styling and HTML markup, typically 300-600 KB.

For tenants with tens of thousands of users, file sizes scale linearly. Even at 50,000 users, all formats remain well within browser memory limits and download quickly on modern connections. The in-browser generation approach means there is no upload/download round-trip to a server -- the file is constructed locally and available immediately.

## How the zero-storage model ensures exports don't persist server-side

M365 Tenant Reporter's zero-storage architecture means that exported files are never transmitted to, stored on, or processed by any server operated by the application. The entire export pipeline executes within your browser:

1. Report data exists in browser memory as JavaScript objects.
2. The export function transforms these objects into the target format (xlsx buffer, JSON string, CSV text, or HTML markup).
3. A Blob URL is created from the formatted output.
4. The browser's native download mechanism saves the file to your local device.
5. When you close the browser tab, the in-memory data is released.

At no point does the export data leave your browser session. This means:

- There is no server-side log of what was exported or when.
- There is no cloud storage bucket accumulating export artifacts.
- There is no risk of a server breach exposing previously exported tenant data.
- Compliance teams can be confident that tenant data is handled exclusively within the authenticated browser session.

> The zero-storage model is not just a privacy feature -- it is an architectural guarantee. The application does not have a backend data store to persist exports into even if it wanted to.

## Tips for building recurring export workflows

While M365 Tenant Reporter does not have built-in scheduling (because the browser-only model requires an interactive sign-in), you can build effective recurring export practices:

### Establish a snapshot cadence

Decide how often your organization needs fresh tenant data. Monthly is sufficient for most governance and capacity planning purposes. Weekly may be appropriate for rapidly growing tenants or during migration projects. Quarterly works for baseline compliance reporting.

### Standardize file naming

Adopt a consistent naming convention for exported files, such as `{tenant}-{report}-{date}.{ext}`. For example: `contoso-licenses-2026-03-28.xlsx`. This makes it easy to find and compare exports across dates.

### Create a shared export archive

Designate a SharePoint document library or shared network folder as the canonical location for snapshot exports. Organize by date, and include exports from all report modules for each snapshot session. This creates a longitudinal record of your tenant's state over time.

### Pair exports with review notes

For each snapshot session, create a brief review notes document summarizing key findings: SKUs approaching capacity, new unlicensed users identified, groups flagged for cleanup. Store this alongside the exports. Over time, this builds an institutional knowledge base about your tenant's health trajectory.

### Use JSON exports for trend automation

If you want to automate trend analysis, export JSON from each snapshot session and store the files in a consistent location. A simple script can parse multiple JSON files, extract key metrics (total users, licensed count, available seats per SKU), and generate a trend chart or alert when thresholds are crossed.

## Accessibility considerations for HTML exports

HTML exports from M365 Tenant Reporter are designed with accessibility in mind:

- **Semantic table markup.** The export uses proper `<table>`, `<thead>`, `<th>`, and `<tbody>` elements, which enables screen readers to navigate the data by row and column.
- **High-contrast styling.** The inline CSS uses sufficient color contrast ratios for text and background colors to meet WCAG 2.1 Level AA guidelines.
- **No JavaScript dependency.** The HTML file is fully functional without scripting, which means it works in locked-down browser environments and assistive technology tools that may not execute JavaScript.
- **Responsive layout.** The table styling adapts to different viewport widths, making the export usable on tablets and mobile devices when shared with stakeholders who review reports on the go.

These characteristics make HTML the recommended format when the export will be reviewed by a diverse audience with varying technology setups and accessibility needs.

## Combining multiple exports for comprehensive reporting

A complete tenant review typically involves exporting data from multiple report modules -- users, licenses, groups, mailboxes, security insights -- in the same snapshot session. Because all reports in a single session share the same collection timestamp, the exports are inherently consistent with each other. This timestamp coherence is important for audit purposes: when an auditor asks "what was the state of your tenant on March 28?", you can provide a complete set of exports that all reflect the same moment in time.

For comprehensive reporting packages, consider exporting each module in the format best suited to its primary audience, and additionally exporting the full set in HTML for archival purposes. The HTML exports serve as the human-readable record of what the tenant looked like at snapshot time, while the CSV or Excel exports serve as the working copies for analysis and remediation.
