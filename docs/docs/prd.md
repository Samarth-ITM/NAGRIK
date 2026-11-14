NAGRIK — Product Requirements Document (PRD)
Document status: Final scope baseline
Version: 1.0
Date: 12 November 2026
Pilot: ITM Skills University area, Sector 4, Kharghar, Navi Mumbai
Product owner: Nagrik project owner
Primary interfaces: Telegram bot and public web application
Deployment target: Vercel + hosted database and object storage

1. Executive summary
Nagrik is a Telegram-first civic issue reporting and accountability platform. Citizens report local public-infrastructure problems through a guided Telegram bot. Reports are stored as individual citizen submissions and linked, after review, to a record representing the underlying physical problem. A web application provides a public information layer, a private super-admin control centre and organisation-specific authority dashboards.
The first pilot is deliberately limited to a 500-metre radius around the main public entrance of ITM Skills University, Plot 25 & 26, Institutional Area, Sector 4, Kharghar. The radius is a simple pilot geofence, not a claim about a municipal ward or the legal jurisdiction of an asset owner. Only publicly accessible roads, footpaths, public utilities and public spaces are included. Campus interiors, private property and residential society property are excluded unless the relevant owner explicitly authorises reporting.
The pilot does not integrate with CIDCO, Panvel Municipal Corporation (PMC), or any other government system. During the first pilot, live reports are visible to the Nagrik super-admin. A separate, read-only CIDCO-style demonstration workspace contains synthetic data and is clearly labelled as a demonstration. Actual authority organisations and accounts can be created by the super-admin later, but no government participation, endorsement, API connection or official complaint submission is implied.
Nagrik's core value is not an AI chatbot. Its core value is the structured record of a civic problem over time: the citizen report, the physical issue it refers to, the review decision, any actual authority handoff, the repair evidence and the final verification decision. AI is optional and limited to assisting with evidence review or transcription. Geographic matching is performed by a deterministic algorithm and human review, never by an AI model.
2. Product thesis and goals
2.1 Product thesis
Accessibility is the entry point: Telegram lowers the effort required to submit a report and supports English, Hindi and Marathi.
Civic intelligence is the differentiator: several reports about one physical problem can be connected to one issue record without losing individual citizen tickets.
Accountability is the outcome: a repair is not treated as verified merely because an authority user clicks “Done”. A resolution request requires evidence and super-admin approval.
2.2 Primary goals
Let a citizen submit a useful report in approximately two minutes, without creating a website account.
Capture a consistent issue category, location, evidence and language.
Give every submission a unique ticket code that the citizen can track through Telegram.
Identify likely reports of the same physical issue using a simple distance algorithm, while preventing nearby but distinct defects from being merged automatically.
Give the super-admin a complete view of reports, physical issue records, evidence, status changes, authority workspaces and system activity.
Publish a safe, anonymised view of approved issue information on the public website.
Provide authority dashboards that are organisation-isolated and can be provisioned when a real organisation is ready to use the platform.
Require repair evidence and a human approval before an issue becomes resolved.
Keep AI optional, replaceable and outside critical decisions.
Demonstrate a complete, polished product experience using an isolated sample authority workspace without inventing real government activity.
2.3 Non-goals
Nagrik is not, in this release:
An official CIDCO, PMC or government grievance portal.
A replacement for government complaint channels or emergency services.
A government work-order, tender, contractor-payment or procurement system.
An automatic authority-routing integration.
An emergency response, police dispatch, crime reporting or traffic-enforcement product.
A contractor marketplace or a platform for awarding civic works.
A citizen social network or public discussion forum.
An autonomous AI decision-maker.
A native Android or iOS application.
A WhatsApp bot.
A multi-city production SaaS rollout.
3. Pilot geography and operating boundary
3.1 Pilot anchor
The pilot anchor is the main public entrance of ITM Skills University, Plot 25 & 26, Institutional Area, Sector 4, Kharghar, Navi Mumbai, Maharashtra 410210. ITM's official website publishes this campus address.
3.2 Pilot boundary
Initial geofence: a 500-metre straight-line radius from the pinned main public entrance.
The final centre coordinate must be selected from a map pin at the actual public entrance before launch. Do not derive the production centre from a building photo or an approximate online coordinate.
The boundary is stored as configuration and can be adjusted by the super-admin.
The geofence covers publicly accessible roads, footpaths, public drainage, public streetlights, public amenities and public green spaces within the radius.
It excludes ITM campus assets, private plots, private buildings, housing-society internal roads and other private assets unless permission has been obtained.
Nagrik does not determine whether CIDCO, PMC or another entity owns an asset. It records the location and can allow the super-admin to note a suspected responsible organisation, but no ownership claim is made without verification.
3.3 Out-of-area handling
If a citizen shares a location outside the pilot boundary, the bot explains that the current pilot only covers the ITM Sector 4 area and does not create a live pilot ticket. It may offer the citizen the option to view the public website. It must not imply that an outside-area complaint has been forwarded to an authority.
4. User types and permissions
User type
Purpose
Access
Citizen
Submit and track a civic report
Telegram only; no Nagrik website account required
Public visitor
Understand Nagrik and inspect approved public information
Public website and anonymised issue map
Super-admin
Operate and govern the entire system
Global access to all live reports, issues, evidence, organisations, users, AI assessments, audit logs and settings
Authority administrator
View and manage issues assigned to one real organisation
Organisation-scoped dashboard; can update permitted issue fields and submit repair evidence
Authority operator
Work on issues assigned to one organisation
Organisation-scoped operational access; cannot create organisations, change global settings or approve final closure
Demo viewer
Explore the sample CIDCO demonstration
Read-only access to isolated synthetic data; no access to live reports

4.1 Account creation
Only the super-admin can create or invite admin and authority accounts.
There is no open authority registration.
There is no citizen website login.
Authority accounts are disabled until explicitly provisioned by the super-admin.
The first pilot has no real authority organisation connected to live operations.
The CIDCO demo is a separate sample organisation and its data is not mixed with live pilot data.
The super-admin can later create additional organisations without changing the citizen reporting flow.
4.2 Identity and anonymity
Citizens are anonymous to the public website and authority users by default. Telegram itself knows the citizen's Telegram account. Nagrik privately stores a pseudonymous user key and the minimum encrypted Telegram chat identifier needed to send ticket updates. Nagrik must not promise absolute anonymity from Telegram or from the platform operator.
5. Issue taxonomy
The reporting interface has exactly three top-level groups. Each group contains four categories. Each category contains no more than four specific options plus one Other option. “Other” routes to manual review and a short description field.
Group 1: Roads, Footpaths & Mobility
Category
Specific issue options (maximum four)
Additional option
Road Surface
Pothole; Cracked or broken road; Uneven or sunken road; Waterlogged road surface
Other
Footpaths & Pedestrian Access
Broken or missing paving; Obstructed footpath; Damaged kerb or access ramp; Damaged pedestrian railing
Other
Road Safety Assets
Damaged speed breaker; Missing or damaged road sign; Faded or missing road markings; Damaged safety barrier or guardrail
Other
Road Obstructions & Open Works
Open excavation or uncovered trench; Debris or material blocking the road; Damaged or missing manhole cover; Fallen tree or object blocking access
Other

Group 2: Waste, Cleanliness & Drainage
Category
Specific issue options (maximum four)
Additional option
Garbage & Waste Collection
Garbage accumulation; Overflowing public bin; Missed waste collection; Open or illegal dumping
Other
Drains & Stormwater
Blocked drain; Overflowing drain; Broken or missing drain cover; Stagnant water or waterlogging
Other
Public Sanitation
Dirty public toilet; Damaged or unusable public toilet; Sanitation overflow; Persistent foul odour
Other
Litter & Construction Waste
Litter accumulation in a public area; Construction or demolition debris; Waste scattered around a collection point; Silt or mud accumulation on a public path
Other

Group 3: Public Utilities, Lighting & Green Spaces
Category
Specific issue options (maximum four)
Additional option
Street Lighting & Electrical Fixtures
Streetlight not working; Flickering streetlight; Damaged pole or light fixture; Exposed or damaged electrical cable
Other
Water Supply & Public Taps
Water pipeline leakage; Broken public tap; Overflowing water line or public tank; Water supply disruption at a public facility
Other
Parks & Public Amenities
Damaged bench or seating; Broken play equipment; Damaged public railing or fence; Damaged public sign or fixture
Other
Trees & Green Spaces
Fallen branch or tree; Unsafe leaning tree; Damaged tree guard; Overgrown vegetation blocking public access
Other

5.1 Taxonomy rules
The selected group, category and leaf option are stored as stable IDs, not only display text.
The taxonomy supports English, Hindi and Marathi labels.
“Other” requires a text description and is always manually reviewed.
A report is not auto-reclassified by AI.
The super-admin may correct a category, with an audit entry recording the old and new values.
Emergency, criminal, medical, fire, violence, missing-person and police matters are not accepted as Nagrik cases. The bot displays a clear redirect to the relevant emergency or official service and does not pretend to dispatch help.
6. Channels and product surfaces
6.1 Telegram bot: primary reporting channel
Telegram is the default citizen interface. It supports:
English, Hindi and Marathi language selection.
Guided category selection using inline buttons.
Photo upload, voice notes and text descriptions.
Telegram location sharing or a manually dropped Telegram map pin.
Ticket confirmation and tracking.
Updates when the ticket status changes.
A “See Demo” button that plays a short instructional video.
A “View Nearby Issues” option linking to the public map.
Help, restart and cancel actions.
The bot must work without AI. A failed AI request cannot block report submission or tracking.
6.2 Public website: secondary information channel
The public website is hosted on Vercel and is available to anyone. It provides:
Nagrik overview, purpose and pilot boundary.
Clear “Report via Telegram” call-to-action.
An anonymised live issue map and list.
Public issue summaries and approved repair proof, only where the super-admin has explicitly approved publication.
A separate sample demonstration area.
A visible Login link for authorised admin and authority users.
A clear notice that Nagrik is an independent pilot and is not an official government grievance portal.
The public website does not submit citizen reports in this release. The Telegram bot is the only citizen submission channel.
6.3 Login-based dashboards
/login is the shared secure login entry point.
The user's server-verified role determines whether the user enters the super-admin dashboard or their organisation's authority dashboard.
No role or organisation is trusted from client-side form data.
Authority users only see issues explicitly assigned to their organisation.
The CIDCO demo is isolated and read-only. It is not an actual CIDCO integration.
7. End-to-end citizen workflow
Citizen opens the Telegram bot and presses /start.
Bot asks the citizen to choose English, Hindi or Marathi.
Bot displays the main menu: Report a Problem, Track My Report, View Nearby Issues, See Demo, and Help.
Citizen selects Report a Problem.
Bot asks for one of the three top-level issue groups.
Citizen selects a category within the group.
Citizen selects one of up to four issue types or Other.
If Other is chosen, the bot asks for a short description.
Bot requests evidence: up to three photographs, one voice note or a text description. The citizen can provide more than one type of evidence. At least one meaningful description, photograph or voice note is required.
Bot asks the citizen to share the location of the problem through Telegram's location attachment. The citizen may share current location or move the pin to the exact issue location. A written landmark is allowed as a fallback but such a report is marked for manual location review and is not automatically matched to a physical spot.
Bot shows a review card containing the selected category, description, location, evidence count and public-map privacy explanation.
Citizen confirms submission or edits the draft.
Nagrik creates an individual report and a unique ticket code, stores evidence, records the Telegram update ID and begins deterministic duplicate-candidate checking.
Bot returns the ticket code and explains that the report is received, not yet an official government complaint.
The super-admin reviews the report, validates location/category, and accepts or rejects any suggested match to an existing physical issue.
The citizen can track the ticket through Telegram and receives status notifications.
7.1 Report limits
Maximum three photographs per citizen report.
Maximum photo size: 8 MB each after Telegram download validation.
Maximum one voice note per report, up to 60 seconds and 10 MB.
Text description: maximum 500 characters.
Only JPEG, PNG and Telegram-supported photo formats accepted for photo evidence; the server validates file signatures, not only file extensions.
A report may be submitted without a photograph if it includes a meaningful text or voice description. It will receive a lower evidence-completeness indicator and may require manual review.
8. Report versus physical issue model
Nagrik stores two separate concepts:
Report: one citizen's submission. Every report receives its own ticket code and remains independently traceable.
Spot / Issue: one underlying physical civic problem, such as one pothole. Several citizen reports may be linked to the same spot after review.
Example: three citizens report the same pothole. Nagrik stores three reports and three ticket codes linked to one spot record. The spot has one canonical location and one operational status. Each citizen can still track their own report.
A report is never deleted merely because it is linked to another report. Duplicate linkage does not erase a citizen's submission or evidence.
9. Same-spot detection and duplicate handling
9.1 Principle
The system must not treat every nearby defect as the same defect. It uses a deterministic geographic candidate search and requires a human confirmation before linking reports to one spot.
9.2 Candidate bands
Distance from the spot's fixed anchor coordinate
Interpretation
System action
0–5 metres
Strong candidate
Show at the top of the super-admin's possible-match list; do not auto-merge
More than 5 metres and up to 10 metres
Possible nearby candidate
Show for manual comparison; do not auto-merge
More than 10 metres
Separate physical spot by default
Create a new spot unless a super-admin explicitly links it after checking evidence

9.3 Additional matching rules
Compare only reports with the same selected issue leaf type by default. A super-admin may manually override this.
Compare against the spot's original fixed anchor coordinate. Do not use the latest report coordinate or a moving centroid as the anchor.
Never use chain matching. If report A is 8 metres from a spot and report B is 8 metres from A but 15 metres from the spot anchor, report B is not automatically considered part of that spot.
Missing or low-confidence location means no automatic geographic candidate search; the report enters manual review.
The system can compare exact file hashes to identify the exact same uploaded file, but exact file matching is only an upload-duplication hint, not proof that two reports concern the same physical pothole.
AI is never used to identify or merge the same physical issue.
The super-admin chooses Same spot, Different spot, or Cannot determine.
If the super-admin chooses Different spot, Nagrik creates a separate spot record even if it lies within 10 metres of another spot.
Distinct reporter count is based on distinct pseudonymous Telegram users, not the raw number of submissions.
10. Review, authority handoff and status lifecycle
10.1 Statuses
Status
Meaning
Who can set it
NEW
A report was received successfully
System
UNDER_REVIEW
Nagrik administrator is reviewing details and location
Super-admin
VERIFIED
The report is credible and within the pilot scope
Super-admin
ASSIGNED
Nagrik has internally assigned the issue to an organisation or responsible work queue
Super-admin
HANDED_OFF
A real submission to an external authority has been made and evidence of that handoff is recorded
Super-admin
AUTHORITY_ACKNOWLEDGED
The authority has acknowledged the issue; a reference or verifiable acknowledgement is recorded
Super-admin or authorised authority user, with evidence
IN_PROGRESS
An authorised authority user has confirmed work has begun
Authority user or super-admin with source note
RESOLUTION_SUBMITTED
Authority has requested closure and uploaded mandatory after-repair photo evidence
Authority user
RESOLVED
Super-admin has reviewed evidence and approved closure
Super-admin only
REOPENED
A previously resolved issue is challenged or found to remain unresolved
Super-admin after review
REJECTED
Report is invalid, outside the pilot boundary, unsafe/out of scope or not a civic issue
Super-admin

10.2 Critical handoff rule
A Nagrik ticket is not an official government grievance reference. HANDED_OFF is only allowed when an administrator records the actual destination, method, date and proof of submission. An official reference is optional only where the authority's channel does not issue one. Nagrik must never invent a CIDCO, PMC or government reference number.
10.3 No premature closure
An authority user cannot directly set an issue to RESOLVED.
An authority user must submit at least one after-repair photograph and a short resolution note.
A video is optional supporting evidence.
The authority user is prompted to photograph the same physical location from a similar angle to the original report where practical. Exact framing is a recommendation, not a hard technical requirement.
The super-admin compares the original report and repair evidence, sees any AI assessment and approves or rejects closure.
If evidence is unclear, the status remains RESOLUTION_SUBMITTED or returns to IN_PROGRESS with a reason.
A citizen can press Still not fixed from the bot tracking flow. This creates a challenge for super-admin review; it does not automatically overwrite the status.
Final closure records the reviewer, timestamp, evidence, note and approval decision.
11. Repair evidence and verification
11.1 Mandatory evidence for a resolution request
At least one after-repair photograph.
A completion note.
The authenticated authority account and organisation.
Server-recorded upload time.
A cryptographic hash of the original uploaded file.
11.2 Optional supporting evidence
Short video.
Work order or internal reference.
Contractor or work package reference.
Additional photographs from another angle.
11.3 Before/after review
The super-admin dashboard presents the original citizen evidence and the authority's after-repair evidence side by side. The reviewer can inspect the location, timestamps, notes and organisation identity. The super-admin can approve, reject or request additional proof.
11.4 Authenticity limitation
Nagrik cannot reliably prove that an uploaded photograph is not AI-generated, edited, staged or taken at another location. A vision model's “real image” judgement is not reliable proof of authenticity. Nagrik therefore records provenance (who uploaded the file, when it was received, its hash and the account/organisation) and requires human review. It does not display an “AI-generated image detected” result as fact.
12. Optional AI features
AI is an assistant, not a control authority.
12.1 Allowed AI tasks
Repair evidence assessment: On an explicit reviewer action, inspect the before and after photographs and return one of APPEARS_FIXED, APPEARS_NOT_FIXED or UNCERTAIN, plus a short reason.
Image eligibility check: On an explicit reviewer action, indicate whether the uploaded image appears to show the selected kind of civic asset and whether it is sufficiently clear to review.
Optional voice transcription: If enabled and the citizen has been shown the relevant disclosure, a voice note may be transcribed to assist the administrator. The original audio remains the evidence record.
Optional category suggestion for “Other”: A reviewer may request a suggested taxonomy category. The suggestion never changes the saved category without a human action.
12.2 Forbidden AI tasks
Same-pothole or same-spot matching.
Automatic report merging.
Automatic verification of authenticity or proof that a photo is not AI-generated.
Automatic issue rejection, assignment, escalation or resolution.
Automatic authority routing based on assumed asset ownership.
Facial recognition, licence-plate recognition, identity inference or surveillance.
12.3 AI operating rules
AI is disabled by default until the operator configures a valid API key and enables it.
AI failure, quota exhaustion or model unavailability never blocks report submission, dashboard use or manual closure review.
AI results are labelled AI suggestion, not verification.
The model name and assessment timestamp are recorded.
The reviewer must explicitly request the assessment; no AI inference runs on every citizen report.
Before sending images or audio to Gemini's free tier, Nagrik must disclose that external AI processing is used and obtain the required user/admin consent. Google's published Gemini API pricing information says free-tier content may be used to improve Google's products; paid-tier content is not used for that purpose. Do not send sensitive personal information to the free tier.
Send only the minimum necessary, sanitised media. The platform does not send a citizen's Telegram ID, chat ID, name, contact details or private account data to Gemini.
13. Telegram “See Demo” experience
The main Telegram menu includes a permanent See Demo option. Pressing it sends an inline playable instructional video with a short caption.
The video should be approximately 45–60 seconds and demonstrate:
Start the bot and choose a language.
Choose one of the three issue groups.
Select a category and the specific issue.
Take and upload a clear photograph.
Share the exact location pin.
Confirm the report.
Receive and track the ticket code.
The first video asset should use simple English narration or on-screen instructions with Hindi and Marathi subtitles. The bot caption repeats the key steps in the selected language. The video is instructional only; it must not imply that a government authority has endorsed Nagrik.
14. Website information architecture
14.1 Public pages
Route
Purpose
/
Product overview, pilot description, how it works, category coverage and main Telegram CTA
/issues
Public anonymised live issue map and list
/issues/[spotCode]
Sanitised public summary for one approved spot
/demo
Clearly labelled sample demonstration hub
/demo/cidco
Read-only CIDCO-scenario sample dashboard with synthetic issues
/about
Product scope, limitations, privacy summary and contact information
/login
Secure login for super-admin and invited authority users
/privacy
Public privacy notice

14.2 Homepage content
Nagrik name and plain-language explanation.
“Report a civic problem on Telegram” CTA.
Pilot area map and the 500-metre ITM Sector 4 boundary.
Three top-level issue groups and their coverage.
How a report is submitted, reviewed, handed off and verified.
Live pilot numbers drawn only from real records.
“Explore sample dashboard” link.
“Login” link.
Explicit “Independent pilot; not an official government portal or endorsed by CIDCO/PMC” disclaimer.
14.3 Public issue map
The map shows only spots approved for public display. It can display category, approximate location, date first reported, current status and distinct report count. Exact location coordinates, original raw descriptions, citizen identity and private evidence are not exposed. A redacted after-repair photograph may be published only after super-admin approval.
14.4 Live versus sample data
Live pilot counts and live issues are calculated only from non-demo records.
Sample issues are shown only in /demo and /demo/cidco.
Sample data is visibly labelled DEMO DATA on every relevant page and record.
Demo data never appears in public live metrics, exports of live data or live notifications.
No fabricated live count, fake real authority reference or fake government completion claim is permitted.
15. Super-admin dashboard
The super-admin dashboard is the operational control centre and must include:
Overview: live report count, open spots, reports awaiting review, duplicate candidates, resolution requests awaiting approval and failed notifications.
Report queue: search, filters, report detail, citizen evidence, selected category, location and ticket code.
Spot/issue register: canonical location, associated reports, status, map and history.
Duplicate review: candidate distances, evidence comparison, same/different/uncertain decisions.
Evidence review: private original evidence, sanitised derivative, before/after comparison, upload provenance and optional AI result.
Status control: transition actions, required notes, handoff records, authority acknowledgements and reopen/reject actions.
Organisation management: create/disable organisation, configure scope and create/invite authority users.
Authority workspaces: inspect each organisation's assigned issues and account activity.
CIDCO demo management: view/reset seeded demo data separately from live records.
Public content controls: approve or suppress public spot summaries and approved repair evidence.
Telegram operations: webhook health, duplicate update counts and failed outgoing messages.
AI controls: enable/disable AI, model configuration status, usage/failure view and saved assessments.
Audit history: who changed which record, when, and the before/after values.
System health: database connectivity, storage usage, webhook status and recent failures.
Export: CSV of filtered reports/spots and an evidence manifest; private media is not bundled into a public export.
16. Authority dashboard
Each real organisation has a strict data boundary. Authority users can:
See only spots explicitly assigned to their organisation.
View the reports and sanitised evidence linked to those spots.
Acknowledge a handoff where the organisation has actually received it.
Set IN_PROGRESS with a note.
Submit a resolution request with mandatory after-repair photo and completion note.
Add optional video, work order or reference details.
View their own organisation's status history.
Authority users cannot:
See citizen names, Telegram IDs, chat IDs or private contact data.
Browse other organisations' issues.
Access the super-admin controls.
Change the fixed location anchor or merge reports.
Delete reports/evidence or alter audit logs.
Mark a spot resolved without super-admin approval.
claim that a Nagrik ticket is an official government reference.
The CIDCO demo workspace mirrors this experience using synthetic data and read-only controls. It is not a live CIDCO tenant.
17. Notifications and tracking
17.1 Citizen tracking
A citizen can select Track My Report and either select a recent ticket associated with the private Telegram account or enter the ticket code. The bot returns the current state, last update, concise note and next expected step where known.
17.2 Notifications
Citizen notifications are sent when:
A report is submitted.
A report is rejected, with reason.
A report is verified.
A real handoff is recorded.
The authority acknowledges it.
Work is marked in progress.
Repair evidence is submitted.
The super-admin approves resolution.
A resolved issue is reopened.
Notifications are best-effort. A failed Telegram message is recorded and shown to the super-admin; it does not undo the underlying status update.
18. Privacy, safety and trust
No public profile or citizen website account.
Do not collect citizen name, phone number or email by default.
Store a keyed pseudonymous user hash and encrypt the Telegram chat identifier required for notifications.
Public and authority views never expose Telegram identifiers or direct citizen identity.
Raw evidence remains private. Only a separately processed and explicitly approved copy can be public.
Remove EXIF metadata from display derivatives. Keep original evidence private with hash and access controls.
Do not show original private descriptions on the public map. Create a sanitised summary.
Use role-based permissions and database-level organisation isolation.
Keep an append-only audit trail for consequential actions.
Do not accept crime, emergency, medical or police-dispatch cases.
The bot must clearly state that a Nagrik ticket is not an official government complaint.
Publish a privacy notice before accepting live reports.
The prototype's controls are privacy-conscious engineering, not a legal compliance certification. Obtain legal and security review before a larger public rollout.
19. Revenue model and commercial strategy
Revenue is not implemented as payment processing in the MVP. It is a commercial strategy and a set of pricing hypotheses.
19.1 Primary revenue streams
Government/authority SaaS: annual organisation or ward subscription for issue intake, workflow, analytics, evidence and reporting, subject to a proper procurement or service agreement.
NGO implementation/monitoring service: technology deployment, issue monitoring, evidence management, reporting, training and ongoing support for an NGO implementing an eligible civic project.
CSR-sponsored deployment: a company sponsors a defined geographic deployment, public reporting layer or monitoring programme under a written CSR project arrangement.
Setup and integration fees: one-time onboarding, data migration, workflow configuration, training and authorised integration work.
Support and reporting packages: support, audits, monthly performance reports and evidence verification services.
19.2 The proposed 1% model
The user's initial idea is to receive 1% when an NGO obtains government funding or a civic works project. Do not implement or describe this as an informal commission for obtaining public money.
Recommended structure:
Name it a Nagrik Technology and Project-Monitoring Service Fee.
The NGO is buying specific services: platform access, issue register, report aggregation, evidence storage, status tracking, before/after proof review, dashboards, monitoring reports and support.
If a percentage model is commercially useful, negotiate 1% of the value of the specific eligible work package that Nagrik actually monitors, not automatically 1% of the NGO's entire grant or unrelated project budget.
Define the fee base, deliverables, payment milestones, tax treatment, minimum/maximum cap, audit rights and termination terms in writing.
Payment is due only for contracted services and accepted deliverables, not merely because Nagrik introduced an NGO, arranged a meeting or helped influence a government award.
The NGO must confirm that the grant/tender/funder agreement permits the expense and the procurement route used to appoint Nagrik.
No payment, gift, referral fee or benefit is offered to any public official to influence a grant, tender, inspection, payment or public decision.
No fee is hidden inside a contractor invoice or passed through without disclosure.
A percentage or contingency-fee structure is recognised as a possible contract type in the Government of India's 2025 Manual for Procurement of Consultancy Services. The manual also explains associated risks and mitigations, including tying payments to accepted deliverables. This is not a blanket permission for every NGO grant or subcontract. The relevant grant rules, procurement conditions and contract must be checked for each engagement. The Prevention of Corruption Act also makes corrupt inducements or undue advantages to public servants a serious legal risk.
19.3 Example economics
If the approved fee base is ₹10,00,000, 1% equals ₹10,000. If the approved fee base is ₹50,00,000, 1% equals ₹50,000. These are arithmetic examples, not a legal entitlement or guaranteed revenue. A fixed minimum service fee plus a capped variable component may be commercially more viable than a pure 1% fee.
19.4 CSR-specific caution
CSR is not identical to a government grant. The CSR framework has eligibility rules for implementing agencies, project approvals and utilisation requirements. The National CSR Exchange FAQ distinguishes corporate administrative overheads from costs directly attributable to designing, implementing, monitoring and evaluating a particular CSR project. It also states that the 5% administrative-overhead limit concerns the corporate's general CSR administration and that implementing-agency management expenses cannot simply be claimed as that corporate overhead category. A Nagrik fee would need to be correctly classified, included in the approved project budget where appropriate, supported by actual services and permitted by the applicable arrangement. Do not rely on the 5% number as a general cap or permission for Nagrik's fee.
19.5 NGO engagement boundary
The MVP does not include an NGO role, NGO login, NGO dashboard or NGO operating workflow. If an NGO pays Nagrik for a project-monitoring service during the pilot, Nagrik operates the platform and provides the agreed reports/evidence as a service. Any dedicated NGO workspace is a later product decision, not part of this release.
19.6 Recommended commercial sequence
Demonstrate the platform in the ITM-area pilot.
Produce measurable evidence: reporting turnaround, duplicate review quality, status traceability, evidence completeness and verified closure.
Approach an NGO for a paid, scoped monitoring/technology service pilot only after confirming its eligibility and funding terms.
Use a fixed implementation/service fee first; test the 1% variable component only where the work package and funder contract clearly permit it.
After a documented operating record, sell authority subscriptions through formal procurement or a legally approved service engagement.
20. Success metrics
20.1 Pilot product metrics
At least 10 concurrent active citizen reporting sessions supported in the initial pilot.
At least 90% of valid test reports create a unique ticket and appear in the super-admin queue.
At least 95% of supported Telegram updates are idempotently processed (replays do not create duplicate reports).
Median report submission time under two minutes in a guided test.
All reports display the selected category, location state and evidence state.
No authority user can access another organisation's records in permission tests.
No demo record appears in live public metrics.
No issue can reach RESOLVED without super-admin approval and mandatory after-repair photo evidence.
Duplicate algorithm never automatically merges two spots.
20.2 Operational metrics
Reports received by category and date.
Percentage with precise location.
Percentage with photo, voice or text evidence.
Number of candidate matches reviewed, accepted and rejected.
Median time from submission to first review.
Number of actual handoffs with proof recorded.
Number of resolution requests, approvals and rejections.
Number of citizen “Still not fixed” challenges.
Notification delivery failures.
No service-level commitment or government resolution-time promise is made in the pilot.
21. Release acceptance criteria
The release is accepted only when all of the following are demonstrated:
Citizen can complete an English, Hindi and Marathi Telegram report.
Every valid report receives a unique ticket code.
Citizen can track their own report through Telegram.
Photo, voice and text evidence are handled within defined limits.
Location outside the 500-metre pilot boundary is handled honestly.
Similar reports generate candidate matches based on fixed-anchor distance bands.
A reviewer can keep two nearby potholes separate.
Several reports can link to one physical spot without losing individual tickets.
A real authority handoff cannot be recorded without destination, date, method and proof.
Authority resolution request requires an after-repair photograph and note.
Only super-admin can approve final RESOLVED status.
AI is optional and can fail without interrupting the workflow.
AI does not perform duplicate matching or final closure decisions.
Public website is accessible without login and exposes only approved sanitised data.
Authority login is invite-only and organisation-scoped.
CIDCO demo is visibly marked and technically isolated from live data.
Super-admin can see all live operations and audit history.
Website and Telegram bot remain available when the owner's laptop is off.
A failed notification does not reverse a saved status change.
The system does not claim official CIDCO/PMC partnership or official grievance registration.
22. Delivery phases
Phase 1 — Core foundation
Create hosted project, database, storage and Vercel deployment.
Implement taxonomy, Telegram webhook, multilingual menus and report submission.
Create ticket codes, private citizen mapping and admin report queue.
Phase 2 — Spot intelligence and dashboard
Implement spot records and fixed-anchor distance candidate algorithm.
Implement super-admin spot review, duplicate decisions, status history and map.
Implement public website and sanitised public issue feed.
Phase 3 — Authority workflow and proof
Implement organisation, membership and role isolation.
Implement invite-only authority login and issue-scoped dashboard.
Implement repair evidence submission, side-by-side review and super-admin closure.
Seed isolated CIDCO demo data and read-only dashboard.
Phase 4 — Optional AI and hardening
Add optional Gemini image checks and optional voice transcription behind explicit flags.
Add Telegram See Demo video, error monitoring, retention jobs, backups and acceptance testing.
Perform security, privacy and public-content review before opening the bot to the pilot.
23. Dependencies, assumptions and risks
Item
Treatment
ITM location
Official campus address is known; exact public entrance pin must be set during deployment
Asset ownership
Not assumed; no CIDCO/PMC routing integration in pilot
Government participation
None assumed or claimed
NGO partner
Not required for MVP; no NGO login or workflow
Public website
Vercel-hosted, globally accessible; no dependency on owner's laptop
Database
Hosted Postgres and object storage; free-tier reliability is not production-grade
Gemini free tier
Quotas/model access/terms can change; AI disabled by default and manually invoked
Photo authenticity
Cannot be guaranteed by AI; provenance and human review are used
Duplicate matching
Distance creates candidates only; human confirms each link
Authority login
Accounts are created only by the super-admin; sample CIDCO tenant is isolated
Official case references
Never fabricated; only recorded when genuinely issued by an external channel
Public issue count
Must be based on live non-demo data only

24. Source references
The following public sources informed the scope and operating assumptions. Check the linked documentation again at implementation time because service limits and rules can change.
ITM Skills University official website — campus address, Plot 25 & 26, Institutional Area, Sector 4, Kharghar.
Telegram Bot API — webhook, messages, locations, files and Bot API limits. The current cloud Bot API documentation states that bots can download files up to 20 MB.
Gemini API models — current model identifiers and supported capabilities.
Gemini API pricing and data-use terms — free-tier availability and use of submitted content to improve products.
Vercel Functions limitations and Vercel Hobby plan — serverless hosting limits.
Supabase free-project pausing — free plan inactivity behaviour.
Department of Expenditure, Manual for Procurement of Consultancy Services, Second Edition 2025 — contract models, percentage success fees, deliverable acceptance and conflict-of-interest requirements.
National CSR Exchange FAQ — CSR implementing agencies, project utilisation, administrative overheads and monitoring/evaluation cost treatment.
Prevention of Corruption Act, 1988 — anti-bribery and undue-advantage provisions.

End of PRD — Final scope baseline v1.0

