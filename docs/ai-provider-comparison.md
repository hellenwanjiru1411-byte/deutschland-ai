# Which AI provider reads an official German letter for us — and what it costs

**Status:** research brief for the owner's decision. Read date for every price and term below: **24 October 2026**.
**Author:** researcher. **Consumers:** the owner (decision), the lead (planning), the engineer (gateway).

**What this document is not.** No account was created anywhere, no API key exists, nothing has been sent to any provider, and no contract or data-processing agreement has been signed with anyone. Every price here is a **published list price read off the vendor's own page on 24 October 2026**, not a quote, not a negotiated rate, and not a bill we have paid. Where a vendor publishes no figure, the row says so instead of carrying a guess.

It fills the `to verify` rows of `docs/ai-provider-requirements.md` (the requirements spec) with sourced answers, and it names the candidates that fail a must-have rather than ranking them.

---

## 0. The answer in six lines

1. **Four vendors are contractable today by a small project:** Scaleway (Paris), Mistral AI (EU endpoint), Microsoft Azure (Data Zone EU), Google Cloud (EU region). A fifth, IONOS AI Model Hub, exists but publishes no price I could find — reported in §7 as unverifiable, not omitted.
2. **At pilot volume the AI bill is cents, not euros.** 90 letters a month costs **€0.05 to €3.90** depending on model and letter length (§3). The €100 ceiling is not a budget constraint; it is a runaway-loop fuse.
3. **The letter can stay inside the EU** — Scaleway processes in Paris only, Azure Data Zone EU processes and stores in the EU, Google and Mistral sell an EU region. Only Scaleway makes the claim without a surcharge; Mistral charges 1.1× and explicitly excludes its control plane (§6).
4. **Mistral's public terms do not give the unconditional "never used to improve" promise our spec demands** — they exclude model training but reserve use of Customer Data to "optimize" the product (§5.2). That needs a contract amendment before it passes our own gate.
5. **Scaleway's Generative APIs privacy policy is the only one I read that says, in those words, that data is not used "for training, retraining, or improving the base models"** (§5.1).
6. **Recommendation:** Scaleway first, Azure Data Zone second, with the trade-off stated in §8. Quality on German officialese is **unverified for every candidate** and can only be settled by a three-letter test — which costs under €0.05 on any of them.

---

## 1. Who was checked, and why these four

The gate is not "which model is best" but "which vendor will sign a data-processing agreement with a 30-person pilot and bill us per letter with no minimum". Checked and shortlisted:

| Vendor | Product | Why it is on the list |
|---|---|---|
| **Scaleway** (FR) | Generative APIs — Serverless | EU-only hosting (Paris), per-token billing, 1M free tokens for a new customer, no minimum spend |
| **Mistral AI** (FR) | La Plateforme API, `api.eu.mistral.ai` | EU regional inference endpoint, document/OCR product, cheap small model |
| **Microsoft** (Azure) | Foundry Models sold by Azure (Azure OpenAI), Data Zone deployment | Data Zone EU processing, published DPA, strongest published no-training wording |
| **Google Cloud** | Gemini on the Agent Platform (formerly Vertex AI), EU "non-global" region | EU region pricing published, training restriction in the Service Terms |

Checked and **not** shortlisted, with the reason, in §7: IONOS AI Model Hub (product exists, no public price found), OpenAI direct (no EU processing region for the standard API was verified — unverified, see §9), AWS Bedrock and Aleph Alpha (not reached inside this session's budget — unverified, not assessed).

---

## 2. The comparison table

Prices are **list prices, read 24 October 2026, excluding VAT**. Mistral and Azure/Google publish in **USD**; Scaleway publishes in **EUR**. Price per document is **our arithmetic** on those list prices, using the token assumptions in §3.1 — it is not a vendor figure.

| Candidate | Where data is processed | DPA available | Training on customer data | Price / document, explain + deadlines (2 pp / 10 pp / 30 pp) | Free tier / minimum / rate limits | What we could not verify |
|---|---|---|---|---|---|---|
| **Scaleway** — Generative APIs, `deepseek-v4.1-flash` (vision) | **Paris, France only.** "We currently host all models in a secure datacenter located in France, Paris only. This may change in the future." [S1] | A DPA is referenced in Scaleway's contracts area, **but I did not read the DPA document** — see §9 | **No.** "Your data is not used for training, retraining, or improving the base models." [S2] | **€0.0016 / €0.0050 / €0.0137** | 1,000,000 free tokens per new customer, then pay-as-you-go [S1]. No minimum found. Limits are tokens/min, queries/min, concurrency; **numeric values not published** on the FAQ page [S3] | The DPA text itself; the numeric rate limits; whether the "1M free tokens" applies to every model; the "may change in the future" clause on the Paris-only claim |
| **Mistral AI** — `mistral-small-4` on `api.eu.mistral.ai` | **EU/EFTA data centres** for inference, **but not the control plane**: "account configuration, API keys, billing, access management, usage analytics … may still be handled by Mistral systems outside the selected inference geography" [S4] | Yes — Data Processing Addendum, effective 27 Jul 2026, published and incorporated by reference [S5] | **Training excluded, improvement not.** Terms exclude model training (§4.2) but license Customer Data to "provide, maintain and **optimize**" the products, "which includes debugging, assessing, reviewing, and correcting the performance" [S6] | **$0.00051 / $0.00152 / $0.00403** (EU endpoint, 1.1× list) | Free mode exists with "included monthly usage" [S7] — **the quota is not published**; pay-as-you-go draws on prepaid credits; ZDR only on **paid** plans and only if Mistral **approves the request** [S8] | The free-mode quota; the per-model rate limits (console-only); the sub-processor list (Trust Center is JavaScript-only, I could not read it); whether an Order Form can remove the "optimize" licence |
| **Microsoft Azure** — `gpt-4.1-mini`, **Data Zone** deployment, Sweden Central | **EU Member Nation** for processing; "any data stored at rest … is stored in the customer-designated geography" [S9]. Microsoft's **EU Data Boundary** commits to store and process Customer Data within the EU/EFTA [S10] | Yes — Microsoft Products and Services DPA, referenced from the service's own data-protection page [S9] | **No.** Prompts/completions "are NOT used by providers … to improve their models or services", "NOT used to train any generative AI foundation models without your permission" [S9] | **$0.00137 / $0.00405 / $0.0107** | No perpetual free tier found; abuse monitoring is on by default and "managed customers may apply to modify" it [S9] | Whether an Azure subscription/access approval is required for a private individual; the free-trial terms; the abuse-monitoring retention period in days; newest GPT-6 prices (Azure's own page says they are "in processing for publishing") |
| **Google Cloud** — Gemini 3.8 Flash, **non-global (EU) region** | EU region (the "non-global" price column is the regional one) [S11] | Yes — Cloud Data Processing Addendum [S12] | **No.** "Google won't use your data to train or fine-tune any AI/ML models without your prior permission or instruction" [S13] | **$0.0030 / $0.0083 / $0.0215** at introductory pricing; **$0.0059 / $0.0165 / $0.0429** from 1 Jan 2027 | No perpetual free tier found; introductory pricing runs to 31 Dec 2026, then doubles [S11] | The free-trial credit amount and expiry; whether Gemini 3.8 Flash is available in every EU region; **failed calls**: Google states that from 13 Nov 2026 "users will be charged for retrievable token usage even if the request ultimately fails due to client or server timeouts" [S11] — the exact scope is unverified |

**Sources** are listed in §10 with their URLs.

### 2.1 Two rows that matter more than they look

- **Mistral's EU endpoint has a limitation our design collides with.** "Stateful features, including Agents, Batch, and the Files API, are not available on regional endpoints" [S4]. Our gateway is stateless by design (one document per call, no provider-side storage), so this is compatible — but it means we can never quietly add Mistral's file library later.
- **Google's EU price is a 10% surcharge, not a different product** — the same model, priced higher in the non-global column [S11]. Azure's Data Zone pricing works the same way (a premium over the Global SKU) [S9].

---

## 3. What a letter actually costs

### 3.1 The assumptions, stated so they can be argued with

No vendor publishes "tokens per German official letter", so the numbers below rest on three assumptions **we** made. They are not vendor claims, and the first thing the pilot should do is measure the real ones.

| Assumption | Value | Why |
|---|---|---|
| Input tokens per page of dense German official text | **600** | An A4 page of small-print official German is roughly 2,400 characters; at ~4 characters per token that is ~600 tokens. Approximate by construction. |
| Output tokens for "who wrote this, what it is about, which deadline, what to do" as structured JSON | **400 + 40 × pages** | The answer grows with the letter but does not scale linearly — one explanation covers the whole document. |
| Scan vs. text | Text path assumed | Our own requirements say to extract text locally from digital PDFs and re-encode photos (`docs/ai-provider-requirements.md` §1.4). A **scan sent as an image costs more** — the image is tokenised by the vendor and the per-image token counts were not verified for any candidate. |

Formula: `cost = pages × 600 / 1e6 × input_price + (400 + 40 × pages) / 1e6 × output_price`.

### 3.2 Per document, per candidate

Explaining one letter **and** extracting its deadlines in the same call (the design requirement in our spec, so one call, not two):

| Candidate / model | 2 pages | 10 pages | 30 pages |
|---|---|---|---|
| Scaleway `gemma-4-26b-a4b-it` (€0.25 / €0.50 per M) | €0.00054 | €0.0019 | €0.0053 |
| Scaleway `deepseek-v4.1-flash` (€0.60 / €1.80) | €0.0016 | €0.0050 | €0.0137 |
| Scaleway `qwen3.8-27b` (€0.60 / €3.30) | €0.0023 | €0.0062 | €0.0161 |
| **Mistral `mistral-small-4`** (EU, $0.165 / $0.66) | **$0.00051** | **$0.0015** | **$0.0040** |
| Mistral `mistral-medium-3.5` (EU, $1.65 / $8.25) | $0.0059 | $0.0165 | $0.0429 |
| Mistral `mistral-large-4` (EU, $1.496 / $4.598) | $0.0040 | $0.0127 | $0.0343 |
| **Azure `gpt-4.1-mini` Data Zone** ($0.44 / $1.76) | **$0.0014** | **$0.0040** | **$0.0107** |
| Azure `gpt-4.1` Data Zone ($2.20 / $8.80) | $0.0069 | $0.0202 | $0.0537 |
| **Google Gemini 3.8 Flash**, EU, intro ($0.825 / $4.125) | **$0.0030** | **$0.0083** | **$0.0215** |
| Google Gemini 3.8 Flash, EU, from 1 Jan 2027 ($1.65 / $8.25) | $0.0059 | $0.0165 | $0.0429 |

**Translation costs more, because the output is as long as the letter.** A 10-page letter translated (6,000 in / ~7,200 out): Scaleway `gemma` €0.0051, Scaleway `deepseek` €0.0166, Mistral Small EU $0.0057, Azure `gpt-4.1-mini` $0.0153, Google intro $0.0347.

**The OCR path is the expensive part, not the explanation.** Mistral OCR is billed at **$4 per 1,000 pages** ($0.004/page, OCR 4.1) [S14]. A 30-page scanned letter costs **$0.12 just to turn into text** — thirty times the cost of explaining it afterwards with `mistral-small-4`. If we use OCR at all, it must be for scans only, with a page cap.

### 3.3 The pilot's monthly bill

Pilot: ~30 people × 3 documents = **90 letters a month** (the AI meter's own limit), in bursts.

| Scenario | Cheapest shortlisted option | Most expensive shortlisted option |
|---|---|---|
| Every letter 2 pages | €0.05/month (Scaleway `gemma`) | €0.53/month (Mistral Medium EU) |
| Every letter 10 pages | €0.17/month (Scaleway `gemma`) | €1.49/month (Mistral Medium EU) |
| Every letter 30 pages | €0.48/month (Scaleway `gemma`) | €3.86/month (Mistral Medium EU) |
| All 90 letters also translated (10 pp) | +€0.46/month (Scaleway `gemma`) | +€1.49/month (Mistral Medium EU) |

**Read that against the €100 ceiling.** The AI bill at pilot volume is **0.05% to 4% of the ceiling**. The plan's line "the AI bill lands immediately" is true, and the number it lands at is a few euros a month — not the constraint anyone feared. The real constraint is §4.

---

## 4. What the €100 monthly hard stop buys

Letters a month before the ceiling is reached, at **2 pages** and at **30 pages**, computed from §3.2:

| Candidate / model | Letters/month at €100 (2 pp) | Letters/month at €100 (30 pp) | Multiple of the pilot (90/month) |
|---|---|---|---|
| Scaleway `gemma-4-26b` | ~185,000 | ~19,000 | 200× – 2,000× |
| Scaleway `deepseek-v4.1-flash` | ~63,000 | ~7,300 | 80× – 700× |
| Mistral `mistral-small-4` (EU) | ~194,000 | ~24,800 | 270× – 2,100× |
| Mistral `mistral-medium-3.5` (EU) | ~16,800 | ~2,330 | 26× – 190× |
| Azure `gpt-4.1-mini` Data Zone | ~73,000 | ~9,300 | 100× – 800× |
| Google Gemini 3.8 Flash (EU, intro) | ~33,700 | ~4,660 | 52× – 370× |

**The honest reading:** the €100 stop would only trip at **26× to 2,100× the pilot's volume**. It is not a limit that shapes the product; it is a fuse against a runaway loop (a retry storm, a bug that re-sends every document, a script left running). It should stay, and it should be built where the bill is created — but nobody should expect to see it fire during a 30-person pilot.

**What actually binds first at our size is the provider's own quota and rate limit**, not our money:

- **Scaleway's free tier is 1,000,000 tokens** [S1]. At 1,680 tokens per 2-page letter that is ~595 letters — more than six months of pilot. At 19,600 tokens per 30-page letter it is **~51 letters**, i.e. **less than one month of the pilot's worst case**. So the free tier is a genuine starting point, and it can run out mid-month if people upload long letters. That is a real, foreseeable failure mode and the interface must say so plainly, not silently stop.
- **Mistral's free-mode quota is not published** — it is shown only inside the console [S7]. We cannot plan around a number we cannot read, and Mistral's own docs tie zero-data-retention to **paid** plans [S8]. On the free tier we would be relying on the 30-day abuse-monitoring retention instead [S15].
- **Azure and Google have no perpetual free tier that I could verify**, so both mean a card and a bill from day one. At these amounts the bill is trivial; the friction is account setup, not cost.

---

## 5. The data-protection reality, in plain language

### 5.1 Scaleway

The strongest statement I found anywhere in this research, in Scaleway's own Generative APIs privacy policy: *"Your data is not accessible to other Scaleway customers. Your data is not accessible to the creators of the underlying large language models. Your data is not used for training, retraining, or improving the base models. Your data is not accessible to third-party products, or services."* [S2]

That sentence covers exactly the three things our spec demands (no training, **no improvement**, no third-party access) — and it is the only candidate where "improving" is excluded in so many words.

What is honest to add:

- **Retention is not zero.** "API usage data: Aggregated and anonymized data is stored for up to 6 months for performance monitoring and improvement" [S2]. Aggregated and anonymised is not the letter itself, but the sentence "for performance monitoring and improvement" sits next to the no-improvement promise and only a lawyer should decide whether they conflict. **I could not find a stated maximum retention period for the raw request content in days** — that is a gap against our requirement L9.
- **Content may be stored on error.** "In this case, we may store temporarily the corresponding HTTP request content to identify and fix root cause issues or any security or security vulnerability" [S2] — i.e. a **500 error can cause the letter to be stored**. For a letter with a name, an address and a case number, that is the kind of clause we must be able to quote to a worried person, and it is a reason to have our gateway log and delete nothing on our side.
- **The Paris-only claim carries a caveat**: "This may change in the future" [S1]. A vendor that reserves the right to move is not the same as one contractually pinned to a region (our requirement L2).
- **Open-weight models.** The models we would call are not Scaleway's own (Gemma, DeepSeek, Qwen). Scaleway states data is not accessible to the model creators [S2], which addresses the obvious worry — but it is a policy statement, not something we can test.

**Deal-breaker check for a letter with a name, address, case number or health details:** nothing in what I read disqualifies Scaleway. The open items are the DPA text, a stated raw-content retention period, and the error-path storage.

### 5.2 Mistral

Mistral's Data Processing Addendum is real, published, effective 27 July 2026, and incorporated by reference [S5] — that is more than most small vendors offer, and the EU endpoint genuinely moves inference into EU/EFTA data centres [S4].

But two clauses decide it, and they are the reason Mistral is not my first recommendation:

1. **The training exclusion has exceptions.** Commercial Terms §4.2: Mistral "will not use Customer Data or Outputs to train its artificial intelligence models **except** (a) when you opted in to training on a product set to opt-out by default or have not opted out of training on a product set to opt-in by default, (b) when you provide Feedback, (c) as provided in an Order Form, (d) …" [S6]. That is not an unconditional never-train promise; it is a default with carve-outs. Our spec (L5–L7) demands the unconditional version, enforceable in writing.
2. **"Improvement" is licensed.** §4.1 grants Mistral the right to use Customer Data and Outputs "for the purposes of providing, maintaining, and **optimizing** the Mistral AI Products, which includes **debugging, assessing, reviewing, and correcting the performance** … but excludes model training" [S6]. The privacy policy repeats it: a legitimate-interest purpose "to improve the Mistral AI Products or develop new products (but excluding model training) … Your Input and Output" [S15].

**In plain words:** with Mistral we could honestly write "your letter is not used to train the model". We could **not** honestly write "your letter is never used to improve the product" — because their terms say it is, and a human may review it. For letters carrying a name, an address, a case number or health details, that is a materially different promise from the one our requirements document says we need.

The rest of the picture: default retention is **30 rolling days** for API input and output "to monitor abuse (unless zero data retention is activated)" [S15]; ZDR is paid-plan only, request-based, and **Mistral may approve or deny it** [S8]; the control plane (keys, billing, usage analytics) is explicitly outside the EU endpoint's guarantee [S4]; and the EU endpoint costs **1.1× list** [S4].

**Deal-breaker check:** not a hard disqualification — but on our own written requirements it **fails L5/L6 as written** unless an Order Form or DPA annex removes the "optimize" licence and the training carve-outs. That is a negotiation, not a click.

### 5.3 Microsoft Azure

The clearest published wording of the four: prompts and completions are not available to other customers, not available to OpenAI or other model providers, "NOT used by providers … to improve their models or services", "NOT used to train any generative AI foundation models without your permission or instruction" [S9]. Data Zone deployment in an EU Member Nation processes in the EU and stores at rest in the customer-designated geography [S9], inside the Microsoft **EU Data Boundary** [S10]. The DPA is Microsoft's standard one, referenced from the same page [S9].

What to watch: **abuse monitoring is on by default and involves human review** — "Microsoft personnel analyze prompts and completions … for harmful content"; "managed customers may apply to modify abuse monitoring" [S9]. We would need to know whether we qualify as a managed customer and what the modified state actually is, in writing, before we tell a customer their letter is not read by a person at the provider.

**Deal-breaker check:** nothing disqualifying. The open item is human review of content under abuse monitoring, and the process to turn it off.

### 5.4 Google Cloud

"Google won't use your data to train or fine-tune any AI/ML models without your prior permission or instruction" — stated in the Agent Platform zero-data-retention documentation, applying to "all managed models … including GA and pre-GA models" [S13]; DPA is the Cloud Data Processing Addendum [S12]; EU pricing exists as the "non-global" column [S11].

Two cautions. **Failures can be charged:** from 13 November 2026, "users will be charged for retrievable token usage even if the request ultimately fails due to client or server timeouts" [S11] — that is directly relevant to our "retry without paying twice" question, and the answer appears to be *no guarantee*. And Google's no-training statement is about training, not about product improvement; I did not find a sentence as strong as Scaleway's or Azure's on improvement.

**Deal-breaker check:** nothing disqualifying; the charged-failure rule and the improvement question are open.

### 5.5 The thing that is true for all four, and must be said to the person

**A letter cannot have its identifiers reliably stripped, and no vendor changes that.** The addressee block is the first thing on the page, the name recurs in the salutation and the body, the address recurs in the footer and in bank details, and on a photo or a scan there is no text to edit — the pixels are the letter. The case number is a pseudonym, not an anonymisation: removing it makes the answer less useful without making the data anonymous. So every option here means **sending the letter as it is, including the name, the address and the case number**, and saying so in the notice before it goes (`docs/ai-provider-requirements.md` §2.8). Nothing in this brief is a way around that; it is a choice about *which* company receives it, under *which* terms, in *which* country.

---

## 6. The owner's question: can a letter go to a model without leaving the EU at all?

**Yes, for processing. No vendor gives a guarantee that covers everything, and the strictest version has a price tag and a caveat.**

| Option | What is actually promised | Cost effect |
|---|---|---|
| **Scaleway** | "We currently host all models in a secure datacenter located in France, Paris only. This may change in the future." [S1] | **No surcharge** — the listed EUR prices are the Paris prices |
| **Azure Data Zone EU** | Processing in an EU Member Nation; data at rest in the customer-designated geography; EU Data Boundary for storage and processing [S9][S10] | Data Zone list price (the figures in §3.2) |
| **Google EU region** | Regional ("non-global") deployment in an EU region [S11] | **+10%** over global list (visible as the non-global column) [S11] |
| **Mistral EU endpoint** | Inference in EU/EFTA data centres — **and explicitly not the control plane**: keys, billing, usage analytics "may still be handled by Mistral systems outside the selected inference geography" [S4] | **+10%** (1.1× list) [S4] |

**The plain answer for the owner:** there is a provider that processes the letter inside the EU — in fact four. But "the letter never leaves the EU at all" in the strictest sense (including support access, logs and the vendor's own admin systems) is a **contract term**, and the only vendor whose public statement even claims it without a surcharge is Scaleway, with a "this may change in the future" caveat attached [S1]. Microsoft's EU Data Boundary is the strongest contractual instrument I found [S10], and it costs a Data Zone deployment, not a premium line on the invoice.

**The only configuration where nobody but us can touch the letter is a self-hosted open-weight model on our own EU infrastructure** — and that is a fixed monthly GPU cost, not a per-letter cost, so it does not scale down to 90 letters a month. I did not price GPU hosting in this session and will not quote a figure I did not read; the honest statement is that self-hosting is a different order of magnitude from the €0.05–€3.90 a month the four vendors above would charge us at pilot volume, and it belongs in a separate decision if the owner ever wants it.

---

## 7. Checked and not usable for this decision

**IONOS AI Model Hub (Germany).** The product is real and documented: a managed model platform with text generation, embeddings, RAG, tool calling and OCR, under IONOS Cloud [S16]. It would be the obvious German-hosted candidate and I wanted it in the table. **I could not find a published per-token price**: two pricing URLs returned "page or file not found" on 24 October 2026. Without a price I cannot compute a cost per letter, and a candidate with no cost column is not decision-ready. **Reported as unverifiable, not omitted** — if the owner wants a German-hosted option, the next step is one enquiry to IONOS sales asking for per-token list prices, a DPA and the processing region.

**OpenAI direct.** Not shortlisted. The standard API's processing region and the availability of EU data residency for a small self-serve account were **not verified in this session**, and I will not assert either way. The plan's requirement is EU processing; Azure (above) is the route by which OpenAI models can be used inside the EU boundary with Microsoft as the contracting party.

**AWS Bedrock, Aleph Alpha, OVHcloud AI Endpoints, Deutsche Telekom, SAP AI Core.** Not assessed. Not because they are unsuitable — **because this session's budget did not reach them**. They are unverified, not rejected.

---

## 8. Recommendation

### First choice: **Scaleway Generative APIs**, model `gemma-4-26b-a4b-it` or `deepseek-v4.1-flash`, Paris.

**The honest reason.** It is the only candidate where the two things that decide this question are both stated plainly and both cheap: the letter is processed in one country (France) with no surcharge and no regional price trick, and the vendor says in its own privacy policy that data is not used "for training, retraining, or improving the base models" [S2] — which is more than Mistral's terms offer and is the sentence our requirements document was written to find. It bills in euro, per token, with a 1,000,000-token free tier and no minimum, so the pilot can start without a card and without a commitment, and 90 letters a month costs under €1.50 even with translations.

**What we give up.** The models are open-weight third-party models (Gemma, DeepSeek, Qwen), so **quality on German officialese is completely unproven** — this is the real risk, and it is the risk the pilot exists to measure. The DPA document has not been read, the raw-content retention period is not stated in days, and the Paris-only promise carries a "may change in the future" clause.

### Second choice: **Microsoft Azure, `gpt-4.1-mini`, Data Zone deployment.**

**The honest reason.** If the pilot's three-letter test shows the open-weight models cannot read an official German letter well enough, Azure is the fallback that does not force a data-protection compromise to get quality: its published wording matches our requirement list almost line for line (no training, no improvement, not shared with OpenAI), the EU Data Boundary is the strongest contractual instrument I found [S10], and `gpt-4.1-mini` at Data Zone list price is **$0.0014 per 2-page letter** — cheaper than Mistral's mid model and about the same as Scaleway's.

**What we give up.** No free tier, so a card and a subscription from day one; more setup than an API key; abuse monitoring is on by default with human review unless we qualify to modify it [S9]; and the newest models' prices are not published yet.

### The trade-off in one sentence

**Scaleway is the better answer to "who may see this letter" and the worse answer to "can it read German officialese"; Azure is the reverse, at the cost of a cloud account and a default human-review clause to negotiate away. Mistral would be the best answer to the reading problem, but its terms reserve the right to use the letter to improve the product, so it fails our own requirements until an Order Form changes that.**

### What settles it, and what it costs

**A blind test on three anonymised letters** — one digital PDF, one clean scan, one bad phone photo — run through Scaleway and Azure side by side, scored against the Q1–Q6 rows of `docs/ai-provider-requirements.md` (does it read official German, does it find the deadline without inventing one, does it refuse to act as a lawyer, does it cope with a bad photo). At the prices in §3.2 that test costs **under €0.05 in total**. It is the cheapest decision-relevant experiment available to this project, and it is the one thing this research cannot do for the owner.

---

## 9. What we could not verify

Every line below is a claim I did not confirm. None of it is softened, and none of it should be read as "probably fine".

1. **Scaleway's data-processing agreement.** I did not read the DPA document, did not confirm it can be signed by a sole trader without a negotiated contract, and did not see its sub-processor list, its breach-notification deadline, or its deletion-on-termination clause.
2. **Scaleway's rate limits.** The mechanism is published (tokens per minute, queries per minute, concurrency) [S3], the **numbers are not** — they live in an "Organization quotas" page I did not reach. Whether Scaleway throttles 180 calls a month is therefore **unknown**.
3. **Scaleway's retention in days for raw request content.** The policy states 6 months for "aggregated and anonymized" usage data [S2] but gives no maximum for the content itself.
4. **Mistral's free-mode quota** and **per-model rate limits** — both are console-only, not published [S7].
5. **Mistral's sub-processor list** — the Trust Center is a JavaScript application and returned no readable content.
6. **Whether Mistral will amend §4.1 ("optimize") and §4.2 (training carve-outs) by Order Form** for a customer of our size. Unverified; this is a question to their sales team, not a fact.
7. **Whether Mistral's zero-data-retention request would be granted to us** — it is discretionary and reviewed case by case [S8].
8. **Azure: whether an individual (not a company) can open the subscription needed**, whether access to the models needs approval, the free-trial terms, and the abuse-monitoring retention period in days.
9. **Azure's newest model prices** — Azure's own page says the GPT-6 series prices are "in processing for publishing" [S17]. The figures in this brief are `gpt-4.1` and `gpt-4.1-mini` from Azure's public Retail Prices API, region Sweden Central [S18].
10. **Google's free-trial credit** (amount and expiry), and whether Gemini 3.8 Flash is available in every EU region.
11. **The exact scope of Google's charged-failure rule** from 13 November 2026 [S11].
12. **Per-image token counts for scans, for every vendor.** The §3.2 figures are for the text path. A photographed letter sent as an image costs more, and I could not source a per-page image token figure for any of the four.
13. **Page limits per call for every vendor.** Our gateway must cap pages regardless; whether 30 pages fit in one call was not verified for any candidate.
14. **Quality on German official letters for every candidate.** No model was run. Q1–Q6 in the requirements document remain `to verify`.
15. **IONOS AI Model Hub's prices, DPA and processing region** — see §7.
16. **Whether any vendor's terms forbid our use case** (helping a person understand an authority's letter). I read no clause prohibiting it, but "I did not find a prohibition" is not the same as "the terms permit it", and the legal question in the plan is still open.
17. **All prices are list prices on 24 October 2026, excluding VAT, with no negotiated discount, and no invoice has been paid.** A currency conversion between USD and EUR was not applied; the tables keep each vendor's own currency.

---

## 10. Sources, with what was read and when

All read **24 October 2026**.

| ID | Source | What it supports |
|---|---|---|
| S1 | Scaleway, *Generative APIs* product page — <https://www.scaleway.com/en/generative-apis/> | Free tier of 1,000,000 tokens; "host all models in a secure datacenter located in France, Paris only … This may change in the future"; per-million-token EUR prices per model |
| S2 | Scaleway, *Generative APIs Privacy Policy* — <https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/> | Not accessible to other customers / model creators / third parties; "not used for training, retraining, or improving the base models"; 6-month aggregated retention; error-path storage; GDPR statement; reviewed 3 Oct 2025 |
| S3 | Scaleway, *What rate limits apply with Scaleway Generative APIs — Serverless* — <https://www.scaleway.com/en/docs/generative-apis/reference-content/rate-limits/> | Rate-limit dimensions; base limits require a payment method; numbers held in Organization quotas. Reviewed 24 Apr 2026 |
| S4 | Mistral AI, *Regional inference* — <https://docs.mistral.ai/inference/regional-inference> | `api.eu.mistral.ai`; EU/EFTA data centres; 1.1× upcharge; control plane not regional; Agents/Batch/Files unavailable regionally |
| S5 | Mistral AI, *Data Processing Addendum*, effective 27 Jul 2026 — <https://legal.mistral.ai/terms/data-processing-addendum> | The DPA exists, is published and is incorporated by reference; sub-processor and SCC definitions |
| S6 | Mistral AI, *Commercial Terms of Service* — <https://legal.mistral.ai/terms/commercial-terms-of-service> | §4.1 "optimize … debugging, assessing, reviewing"; §4.2 training exclusion with carve-outs |
| S7 | Mistral AI, *Usage and limits* — <https://docs.mistral.ai/admin/billing-usage/usage-limits> | Free mode with "included monthly usage"; pay-as-you-go draws on prepaid credits; rate limits shown in the console; organization/workspace spending caps |
| S8 | Mistral AI, *Zero data retention* — <https://docs.mistral.ai/admin/monitor-comply/zero-data-retention> | ZDR on paid plans only; request-based, approved or denied; covers `/v1/chat/completions` and `/v1/ocr`; excludes Files/Agents/Batch |
| S9 | Microsoft Learn, *Data, privacy, and security for Foundry Models sold by Azure* — <https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy> | No training / no improvement / not shared with OpenAI; Data Zone EU processing and storage; abuse monitoring with human review and the modification route; reference to the Microsoft DPA |
| S10 | Microsoft Learn, *What is the EU Data Boundary?* — <https://learn.microsoft.com/en-us/privacy/eudb/eu-data-boundary-learn> | Microsoft's commitment to store and process Customer Data within the EU/EFTA boundary for Azure and other enterprise services |
| S11 | Google Cloud, *Agent Platform Pricing* — <https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing> (the Vertex AI pricing URL now redirects here) | Gemini 3.8 Flash USD list prices, global vs non-global; introductory pricing to 31 Dec 2026 and standard pricing from 1 Jan 2027; charged-failure rule from 13 Nov 2026 |
| S12 | Google Cloud, *Cloud Data Processing Addendum* — <https://cloud.google.com/terms/data-processing-addendum> | The DPA exists and applies to Google Cloud services |
| S13 | Google Cloud, *Gemini Enterprise Agent Platform and zero data retention* — <https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention> | "Google won't use your data to train or fine-tune any AI/ML models without your prior permission or instruction", all managed models incl. pre-GA |
| S14 | Mistral AI, *API pricing* — <https://docs.mistral.ai/inference/pricing> (reached via docs.mistral.ai) | Per-model token prices in USD/EUR; OCR billed per 1,000 pages ($4 for OCR 4.1, $2 for OCR 3); batch −50%, cached input discounts |
| S15 | Mistral AI, *Privacy Policy* — <https://legal.mistral.ai/terms/privacy-policy> | API input/output kept 30 rolling days to monitor abuse unless ZDR; improvement purpose "excluding model training" covering Input and Output |
| S16 | IONOS, *AI Model Hub* documentation — <https://docs.ionos.com/cloud/ai-model-hub> | Product exists: LLMs, embeddings, RAG, tool calling, OCR, rate-limits page. No price found |
| S17 | Microsoft Azure, *Azure OpenAI Service pricing* — <https://azure.microsoft.com/en-us/pricing/details/azure-openai/> | Global / Data Zone / Regional deployment types; GPT-6 prices "in processing for publishing" |
| S18 | Microsoft Azure, *Retail Prices API*, service `Foundry Models`, product `Azure OpenAI`, region `swedencentral` — <https://prices.azure.com/api/retail/prices> | Data Zone list prices used in §3.2: `gpt-4.1-mini` $0.00044/1K in, $0.00176/1K out; `gpt-4.1` $0.0022/1K in, $0.0088/1K out |

---

## 11. What this puts in front of the owner

1. **Approve the two-vendor test.** Three anonymised letters through Scaleway and Azure, scored against Q1–Q6. Cost: under €0.05. This is the only thing that turns "which provider" from a judgement into a measurement.
2. **Decide whether "never used to improve" is a must-have or a nice-to-have.** If it is a must-have (the requirements document says it is), Mistral is out until an Order Form changes its terms, and the choice is Scaleway vs Azure. If the owner is willing to accept "not used for training, but may be used to improve the product", Mistral becomes the strongest reader of German officialese and the shortlist changes.
3. **Decide whether a cloud account is acceptable.** Azure and Google mean a subscription and a card. Scaleway means a card too, but only after the free tokens run out. The owner's own constraint — he pays per letter — is unaffected either way at these amounts.
4. **Note that the €100 stop will not fire in the pilot.** It should still be built, as a fuse. The number that matters more is the free-tier token count, because that is what can stop the pilot mid-month.
5. **Nothing here is a contract.** The next step after the test is: request Scaleway's DPA and sub-processor list, ask for the retention period in days, and only then write the customer-facing notice — which cannot honestly name a provider, a region and a retention period until those are real.
