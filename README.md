# CryptoTrace Workspace

SIH 2026 — CryptoTrace / I4C Investigation Platform

Build a complete, polished, production-quality frontend web application for my Smart India Hackathon 2026 project.

The product is a Cyber Crime Crypto Investigation Platform for investigators, NOT a generic cryptocurrency explorer.

The frontend should feel like a professional law-enforcement / cyber-crime investigation workspace used by investigators to trace suspicious cryptocurrency fund flows, analyze wallets, identify potential VASPs, correlate multiple complaints, understand risk factors, maintain evidence, and generate actionable investigation outputs.

1. TECH STACK

Use:

React.js

TypeScript

Vite

Tailwind CSS

React Router

Lucide React icons

Framer Motion for subtle animations

Recharts for analytics/charts

React Flow for the interactive fund-flow/network graphs

Build the application with clean, reusable components and a scalable folder structure.

The frontend must be fully responsive for:

Desktop

Laptop

Tablet

Mobile

Desktop should be the primary experience because investigators will mostly use large screens.

2. IMPORTANT PRODUCT DIRECTION

DO NOT design this as:

A crypto trading dashboard

A cryptocurrency portfolio

A normal blockchain explorer

A flashy Web3 landing page

A futuristic hacker website

A generic admin dashboard

Instead, design it as:

A professional Cyber Crime Investigation & Intelligence Workspace.

The UI should communicate:

Trust

Security

Seriousness

Evidence

Intelligence

Investigation

Accuracy

Explainability

It should look suitable for a government/cyber-crime investigation environment.

3. VISUAL DESIGN

Create a premium, modern, professional dark interface.

Recommended visual language:

Deep charcoal / near-black background

Dark slate surfaces

Subtle borders

White / light-gray typography

One restrained accent color for important interactive elements

Red/orange for high-risk alerts

Green for verified/safe/connected states

Amber for warnings

Blue/cyan can be used sparingly for blockchain/information elements

Avoid excessive gradients.

Avoid excessive glowing neon effects.

Avoid overusing glassmorphism.

Avoid huge decorative elements.

The interface should feel like a real investigation product, not a gaming UI.

Use:

Compact cards

Data tables

Status badges

Clear hierarchy

Tooltips

Side panels

Drawers

Modals

Charts

Timeline components

Interactive graphs

Use subtle hover states and micro-interactions.

Animations should be fast and professional.

4. APPLICATION SHELL

Create a persistent application layout.

Desktop:

┌──────────────────────────────────────────────────────────┐
│ Top Header / Global Search / Notifications / Investigator│
├───────────────┬──────────────────────────────────────────┤
│ │ │
│ SIDEBAR │ MAIN CONTENT │
│ │ │
│ Dashboard │ │
│ Cases │ │
│ Investigate │ │
│ Networks │ │
│ Reports │ │
│ Evidence │ │
│ Integrations │ │
│ Settings │ │
│ │ │
└───────────────┴──────────────────────────────────────────┘

Sidebar should be collapsible.

On mobile, convert it into a drawer/bottom navigation.

5. LOGIN PAGE

Create a professional login page.

Brand:

CryptoTrace

Subtitle:

Cyber Crime Crypto Investigation Platform

Include:

Email / Investigator ID

Password

Remember me

Sign in button

Secure environment indicator

Example:

SECURE INVESTIGATION ENVIRONMENT

Investigator Login

[ Investigator ID ]

[ Password ]

☐ Remember me

[ SIGN IN ]

Use a polished government/security-oriented visual.

For the demo, authentication can be mocked.

Do not require a real backend.

6. DASHBOARD

After login, show the main investigation dashboard.

Top summary cards:

Active Cases
124

High Risk Wallets
37

VASP Attribution Hits
52

Pending Actions
18

Add subtle trend indicators.

Example:

ACTIVE CASES
124
+12 this week

HIGH RISK
37
+5 this week

VASP HITS
52
8 requiring review

PENDING ACTIONS
18
6 urgent

Dashboard sections

Recent Investigations

Create a table:

Case IDWalletChainRiskStatusLast Activity

Example:

NCRP-2026-1234
0x82...91
Ethereum
91
Investigating

NCRP-2026-1198
TX...82
TRON
74
Review

NCRP-2026-1142
bc1...
Bitcoin
32
Closed

High-Risk Wallets

Show a compact list/card:

Wallet
Chain
Risk Score
Reason
Last Seen

Recent VASP Detections

Show:

Potential VASP
Confidence
Chain
Cases Linked

IMPORTANT:

Never call an entity "Confirmed Exchange" unless actual confirmation exists.

Use terminology:

"Potential VASP"

"Attribution Candidate"

"Likely VASP"

Investigation Activity

Create a timeline:

09:41 — New complaint linked
09:38 — Wallet traced
09:31 — Bridge detected
09:26 — Risk score updated
09:20 — Case created

7. CASES PAGE

Create the main case-management workspace.

Top:

Cases

[ + New Investigation ]

Filters:

Search Case ID

Search Complaint ID

Search Wallet

Blockchain

Risk

Status

Date

Table:

Case ID
Complaint ID
Primary Wallet
Chain
Amount
Risk
Related Cases
Status
Last Updated

Use pagination.

Add sorting.

Add filter chips.

Clicking a case should open the Case Details page.

8. CASE DETAILS PAGE

Example:

Case #NCRP-2026-1234

Status:
INVESTIGATING

Priority:
HIGH

Summary cards:

Victim Loss
₹10,00,000

Risk Score
87 / 100

Chains
3

Related Wallets
5

Related Complaints
2

Create tabs:

Overview
Fund Flow
Timeline
Risk Analysis
VASP Attribution
Related Cases
Evidence
Notes

9. NEW INVESTIGATION PAGE

This is one of the most important screens.

Title:

START NEW INVESTIGATION

Create a clean investigation form.

Fields:

Case ID
[ NCRP-2026-1234 ]

Complaint ID
[ NCRP-XXXXXX ]

Blockchain
[ Ethereum ▼ ]

Wallet Address
[ 0xABC........................ ]

OR

Transaction Hash
[ 0x123........................ ]

Tracing Depth
[ 5 hops ▼ ]

Advanced Investigation Options:

☑ Cross-chain tracing
☑ Bridge detection
☑ Mixer detection
☑ Previous complaint matching
☑ VASP attribution

Button:

[ START TRACE ]

When clicked:

Show a professional trace-loading experience.

Example steps:

Initializing investigation
✓ Validating wallet

Fetching transaction history
✓ Transactions loaded

Tracing fund movements
✓ 4 hops discovered

Checking bridges
✓ Cross-chain movement detected

Checking VASP attribution
✓ Candidate identified

Calculating risk
✓ Risk analysis complete

Then navigate to Investigation Workspace.

10. INVESTIGATION WORKSPACE — HERO FEATURE

THIS IS THE MOST IMPORTANT SCREEN OF THE APPLICATION.

Create a professional 3-column investigation workspace.

LEFT:

Navigation/context

CENTER:

Interactive Fund Flow Graph

RIGHT:

Selected Wallet / Intelligence Panel

Example:

┌────────────┬──────────────────────────────┬───────────────┐
│ │ │ │
│ CASE │ FUND FLOW GRAPH │ DETAILS │
│ │ │ │
│ Case Info │ ● │ Wallet Info │
│ │ / \ │ Risk │
│ │ ● ● │ VASP │
│ │ \ │ Evidence │
│ │ ◇ Bridge │ │
│ │ \ │ │
│ │ ● → 🏦 │ │
│ │ │ │
└────────────┴──────────────────────────────┴───────────────┘

11. INTERACTIVE FUND-FLOW GRAPH

Use React Flow.

Nodes should represent:

Wallets

Transactions

Bridges

Mixers

VASPs

DEXs

Contracts

Edges represent fund movement.

Nodes should visually differ by type.

Example:

Wallet A
↓
Wallet B
↓
Bridge
↓
Wallet C
↓
Potential VASP

Add animated transaction flow where appropriate.

Graph controls

Include:

Zoom in
Zoom out
Fit view
Pan

Filters:

Blockchain

Amount

Date

Suspicious only

Bridges

Mixers

VASPs

Actions:

Expand Node

Collapse Node

Trace Further

View Transactions

Export Graph

12. GRAPH NODE DETAILS

When an investigator clicks a wallet, open the right-side intelligence panel.

Example:

WALLET DETAILS

Address

0xABCD......

Chain
Ethereum

First Seen
12 Aug 2026

Balance
₹2.4L

Risk Score

82 / 100

HIGH RISK

Entity

Unknown / Potential VASP

Transactions
184

Actions:

[ Trace Further ]

[ View Transactions ]

[ Add Note ]

[ View Evidence ]

13. RISK ANALYSIS

Create a dedicated Risk Analysis tab.

Show:

RISK SCORE

87 / 100

HIGH RISK

Use a visual risk gauge.

Then show contributing factors:

Mixer Proximity
25

Fund Velocity
20

Previous Complaints
25

Wallet Age
10

Bridge Usage
7

Use horizontal bars.

WHY IS THIS RISKY?

Show explainable reasons:

✓ Linked to 3 previous complaints

✓ Funds moved through multiple wallets

✓ Mixer interaction detected

✓ Rapid movement of funds

✓ Cross-chain bridge detected

This section is extremely important.

Do NOT make the risk score a black-box number.

The investigator should understand why the score is high.

14. VASP ATTRIBUTION

Create a dedicated VASP Attribution section.

Title:

VASP ATTRIBUTION

Most Likely Entity

🏦 XYZ Exchange

Confidence

91%

Label:

Potential VASP / Attribution Candidate

Evidence:

✓ Known wallet cluster
✓ Deposit-address behavior
✓ Consolidation pattern
✓ Transaction frequency
✓ Hot-wallet relationship

Other Candidates:

Binance — 61%
CoinDCX — 42%
Exchange X — 28%

IMPORTANT:

Never display:

"Confirmed Exchange"

unless there is actual confirmation.

Always use uncertainty-aware language such as:

Potential VASP
Likely VASP
Attribution Candidate

Add an information tooltip explaining confidence.

15. TRANSACTION TIMELINE

Create a beautiful chronological transaction timeline.

Example:

12:31 PM

Victim
→ Wallet A

₹10,00,000
ETH

12:38 PM

Wallet A
→ Wallet B

₹9,80,000
ETH

12:41 PM

Wallet B
→ DEX

₹9,60,000

12:45 PM

Bridge Detected

ETH → TRON

12:52 PM

Wallet D
→ Potential VASP

₹9,10,000
USDT

Use chain badges and event icons.

16. BRIDGE DETECTION UI

Cross-chain bridge events must be visually prominent.

Example:

⚠ CROSS-CHAIN BRIDGE

Ethereum

↓

Bridge Contract

↓

TRON

Trace Confidence

92% → 68%

Show:

Bridge contract
Timestamp
Amount
Source chain
Destination chain
Confidence

17. MIXER ALERT

Create a dedicated alert component.

Example:

⚠ MIXER DETECTED

Funds entered a known mixer pool.

Confidence impact:

Risk increased

Trace confidence reduced

Provide:

Detection time
Amount
Related transaction
Reason

18. CROSS-CASE NETWORK

Create a dedicated Networks page.

This should be visually impressive.

Show network relationships:

Complaint #102
↓
Wallet X
↙ ↘
Complaint #81 Wallet Y
↓
Complaint #73

Use React Flow again.

Network summary:

NETWORK DETECTED

12 Wallets
4 Complaints
2 VASPs
3 Chains

Potential Common Entity

Mule Network #17

Confidence

84%

Allow filtering by:

Complaint

Wallet

VASP

Blockchain

Risk

19. GLOBAL SEARCH

The top header must have a global search.

Placeholder:

Search wallet / TxID / Case ID / Complaint ID

When searching:

0xABC123

Show results:

Wallet

↓

2 Cases

↓

4 Complaints

↓

1 VASP Candidate

↓

Risk: 91

Search results should be interactive.

20. EVIDENCE / CHAIN OF CUSTODY

Create a professional evidence management page.

Title:

EVIDENCE & CHAIN OF CUSTODY

Table:

Time
Event
Source
Evidence
Methodology
Investigator

Example:

20:31
Wallet identified
Blockchain
TxID
On-chain transaction

20:32
Wallet B found
Indexer
TxID
Transaction tracing

20:34
Bridge detected
Heuristic
Contract
Cross-chain analysis

20:36
VASP attributed
Attribution Engine
Cluster
Entity analysis

20:37
Risk calculated
Risk Engine
Score
Risk model

Each event should have a details drawer.

Include:

Timestamp
Source
Methodology
Evidence ID
Hash / Transaction ID
Notes

The UI should make the chain-of-custody concept very clear.

21. REPORTS PAGE

Create:

REPORTS

Buttons:

[ Generate Investigation Report ]

[ Generate Evidence Report ]

[ Export Transaction CSV ]

[ Export Graph ]

[ Generate Freeze Request ]

Report preview

CASE INVESTIGATION REPORT

Case ID
NCRP-2026-1234

Complaint ID

Executive Summary

Fund Flow

Risk Analysis

VASP Attribution

Related Complaints

Evidence Timeline

Chain of Custody

Provide a realistic report-preview interface.

22. FREEZE REQUEST

Create a dedicated workflow.

Button:

Generate VASP Freeze Request

Preview:

VASP PRESERVATION REQUEST

Case ID:
NCRP-2026-1234

Suspected VASP:
XYZ Exchange

Wallet:
0xABC...

Transaction Hashes:
...

Amount:
₹9,10,000

Evidence:
...

Buttons:

[ Download PDF ]

[ Send via Integration ]

For the frontend demo, these can generate/show mock output.

23. INTEGRATIONS PAGE

Create:

INTEGRATIONS

NCRP
🟢 Connected

SAHYOG
🟡 Sandbox / Demo

Blockchain Data Providers
🟢 Active

VASP Intelligence Registry
🟢 Active

IMPORTANT:

Do NOT fake real government connectivity.

If backend integration does not exist, clearly show:

"Sandbox / Demo"

or

"Integration-ready API"

The frontend should communicate that the architecture is integration-ready.

24. INVESTIGATOR NOTES

Inside each case, provide:

INVESTIGATOR NOTES

Example:

"Wallet appears to be intermediary between victim and exchange."

[ Add Note ]

Also show:

Assigned Investigator

Priority

Case Status

New
Investigating
Action Required
Frozen
Closed

Allow notes to be added/edited in the demo.

25. TOOLTIPS / TERMINOLOGY

The target user should NOT need to be a blockchain expert.

Add tooltips throughout the application.

Example:

ⓘ Hop

"A hop represents one movement of funds from one wallet to another."

ⓘ VASP

"Virtual Asset Service Provider, such as a cryptocurrency exchange."

ⓘ Mixer

"A service that can obscure the relationship between source and destination funds."

ⓘ Confidence

"Indicates how strongly the available evidence supports this attribution."

Use tooltips wherever technical terminology appears.

26. MOCK DATA

Since this is primarily a frontend prototype, create realistic local mock data.

Do NOT use:

lorem ipsum

random meaningless values

obviously fake placeholder text

generic "John Doe"

empty screens

Create realistic:

Case IDs

Complaint IDs

Wallet addresses

Transaction hashes

Blockchain names

Amounts

Risk scores

VASP candidates

Evidence records

Network relationships

Timestamps

Make the demo feel like a working investigation system.

27. APPLICATION FLOW

Implement this complete flow:

LOGIN

↓

DASHBOARD

↓

CASES

↓

CREATE INVESTIGATION

↓

TRACE LOADING

↓

INVESTIGATION WORKSPACE

↓

INTERACTIVE FUND-FLOW GRAPH

↓

TRANSACTION TIMELINE

↓

RISK ANALYSIS

↓

VASP ATTRIBUTION

↓

CROSS-CASE NETWORK

↓

EVIDENCE / CHAIN OF CUSTODY

↓

GENERATE REPORT

↓

FREEZE REQUEST

↓

CASE STATUS / ACTION

All pages must be connected through routing and navigation.

28. RESPONSIVENESS

This is VERY IMPORTANT.

The application must be fully responsive.

Desktop:

Use 3-column investigation workspace.

Tablet:

Collapse side panels appropriately.

Mobile:

Sidebar becomes drawer

Right intelligence panel becomes bottom sheet/drawer

Graph remains usable

Tables become horizontally scrollable or convert to cards

Forms become single-column

Buttons remain accessible

No horizontal page overflow

Test all major screens at:

320px
375px
768px
1024px
1440px+
width.

29. UX DETAILS

Add:

Loading states

Empty states

Error states

Toast notifications

Confirmation modals

Skeleton loaders

Hover states

Tooltips

Keyboard-friendly interactions

Accessible buttons

Clear status indicators

Do not make every component animated.

Animations should communicate state changes, navigation, loading, or interaction.

30. NAVIGATION

Sidebar:

Dashboard
Cases
Investigate
Networks
Reports
Evidence
Integrations
Settings

Header:

Global Search
Notifications
Current Case
Investigator Profile

31. SETTINGS PAGE

Create a basic Settings page with:

Profile
Appearance
Notifications
Investigation Preferences
Security
System Information

This does not need backend functionality.

32. DEMO INTERACTIONS

The prototype must actually feel interactive.

Examples:

Click "Start Trace"
→ show loading
→ display investigation results.

Click graph node
→ update right-side wallet panel.

Click "Trace Further"
→ add more nodes to graph.

Click "View Transactions"
→ open transaction drawer.

Click risk factor
→ show explanation.

Click VASP candidate
→ show evidence.

Click related complaint
→ navigate/open case.

Click "Generate Report"
→ show report preview.

Click "Generate Freeze Request"
→ open freeze-request preview.

Click "Add Note"
→ allow note entry.

Use local state/mock services where necessary.

33. COMPONENT ARCHITECTURE

Create reusable components such as:

AppLayout
Sidebar
Topbar
GlobalSearch
StatCard
RiskBadge
CaseTable
CaseCard
InvestigationForm
TraceLoader
FundFlowGraph
GraphControls
WalletDetailsPanel
RiskAnalysis
VaspAttribution
TransactionTimeline
BridgeAlert
MixerAlert
NetworkGraph
EvidenceTable
EvidenceDrawer
ReportPreview
FreezeRequestModal
NotesPanel
StatusBadge
Tooltip
EmptyState
LoadingState
NotificationToast

Avoid putting everything into one huge component.

34. DATA ARCHITECTURE

Keep mock data separate from UI components.

Example:

src/
components/
pages/
layouts/
data/
hooks/
utils/
types/
routes/

Create TypeScript interfaces for:

Case
Wallet
Transaction
VaspCandidate
RiskFactor
EvidenceEvent
Network
InvestigatorNote

35. QUALITY BAR

The final result should look like a product that could realistically be presented to SIH judges.

It should be:

polished

consistent

responsive

visually impressive

technically credible

easy to navigate

investigator-focused

explainable

information-dense without being cluttered

Every page should look intentionally designed.

Do not create generic CRUD pages.

The Investigation Workspace / Fund Flow Graph should be the visual centerpiece of the application.

36. SIH DEMO PRIORITY

Prioritize these features above everything else:

🔥 1. Login
🔥 2. Dashboard
🔥 3. Case Management
🔥 4. New Investigation
🔥 5. Interactive Fund Flow Graph
🔥 6. Wallet Details
🔥 7. Explainable Risk Score
🔥 8. VASP Attribution
🔥 9. Transaction Timeline
🔥 10. Cross-Case Correlation
🔥 11. Evidence / Chain of Custody
🔥 12. Freeze Request Preview

Nice-to-have:

NCRP integration screen

SAHYOG integration screen

Advanced filters

User management

Settings

Do NOT sacrifice the core investigation workflow just to add extra pages.

37. FINAL REQUIREMENT

Build the complete frontend now.

Do not just create a landing page.

Do not create only static screenshots.

Create a complete navigable React application with realistic mock data and functional frontend interactions.

The final application should demonstrate this story clearly:

A cyber-crime investigator receives a complaint → starts an investigation → traces cryptocurrency across multiple wallets/chains → identifies suspicious bridges/mixers → sees explainable risk → identifies a potential VASP → discovers links to previous complaints → reviews the evidence chain → generates an investigation report → prepares a VASP freeze request.

That complete investigator journey is the core of the product.

Make the UI premium, professional, responsive, highly polished and SIH-demo ready.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3769df2b-4c8b-43a8-b687-3de1f7242035).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
