---
name: content-pack-generator
description: Generate complete SEO and GEO-ready content packs from a topic, including metadata, structured article draft, CTA strategy, hyperlink plans, FAQs, JSON-LD schema blocks, image plan, and a quality self-review checklist. Use when users ask for content briefs, SEO blog/article drafts, go-to-market content assets, or reusable publishing packs with strict output formatting.
---

# Content Pack Generator

Generate a copy-paste-ready content pack in strict Markdown section order.
Collect required inputs up front, apply defaults when details are missing, and preserve clarity over keyword density.

## Input Collection

Ask for these inputs at the beginning:

1. Topic (required)
2. Target audience / ICP (optional)
3. Brand / product name + positioning (optional)
4. Primary keyword + 3-5 secondary keywords (optional)
5. Desired tone (optional)
6. Region/language (default: English, US)
7. Internal links list (optional) and external reference domains (optional)
8. Desired CTA goal (optional: Book demo / Contact / Subscribe / Download)

Interaction order rules:

1. Ask for Topic first and wait.
2. After topic is provided, ask items 2-6 one by one, in order, waiting for each answer before asking the next.
3. Accept skip responses such as "skip", "n/a", or blank-style responses for optional fields.
4. After item 6, ask items 7 and 8.
5. If any optional field is missing, proceed with practical defaults and note inferred assumptions in the output.

## Generation Workflow

1. Identify search intent from topic and audience.
2. Build metadata aligned with intent and keyword strategy.
3. Create a heading hierarchy with exactly one H1 and logical H2/H3 flow.
4. Draft long-form content with three natural CTA placements:
   - after intro
   - mid-article
   - near conclusion
5. Add inline suggested link placeholders:
   - `[Internal Link: <anchor text> -> <url>]`
   - `[External Link: <anchor text> -> <url>]`
6. Produce standalone CTA variants.
7. Produce internal and external hyperlink plans with citation flags for claims that need sources.
8. Add 6-10 concise FAQs and generate matching FAQPage JSON-LD.
9. Add Article/BlogPosting JSON-LD when article format is used.
10. Propose image concepts with placement and descriptive alt text.
11. Finish with a quality checklist and critique.

## Output Contract (Strict)

Return Markdown with this exact section order and headings:

1. `Metadata`
2. `Article Outline`
3. `Full Draft (Markdown)`
4. `CTA Copy (Standalone)`
5. `Hyperlinking Plan`
6. `FAQs`
7. `JSON-LD`
8. `Images + Alt Text`
9. `GPT Feedback (Quality Checklist)`

Use this exact field structure:

### 1. Metadata

- Meta Title:
- Meta Description:
- Slug:
- Primary Keyword:
- Secondary Keywords:
- Target Audience:
- Search Intent:

### 2. Article Outline

- H1:
- H2/H3 outline (nested bullets)

### 3. Full Draft (Markdown)

- Use exactly one H1.
- Use H2/H3 correctly.
- Include CTAs in the three required positions.
- Keep CTAs aligned with CTA goal.
- Include suggested link placeholders inline.

### 4. CTA Copy (Standalone)

- Primary CTA (short)
- Primary CTA (long)
- Secondary CTA options (3)

### 5. Hyperlinking Plan

- Internal links (5-10): anchor text + destination (placeholder if unknown)
- External links (3-6): anchor text + destination (credible sources)
- Mark unsupported factual claims as external citation needed.

### 6. FAQs

- Provide 6-10 FAQs.
- Keep each answer 2-4 sentences.

### 7. JSON-LD

- FAQPage JSON-LD as valid JSON.
- Article/BlogPosting JSON-LD as valid JSON with placeholders:
  - `headline`
  - `description`
  - `author`
  - `datePublished`
  - `image`
  - `url`
  - `publisher`

### 8. Images + Alt Text

- Provide 4-8 image suggestions with:
  - concept/shot description
  - placement (after which section)
  - alt text (descriptive, non-spammy)

### 9. GPT Feedback (Quality Checklist)

Include a checklist plus concise critique covering:

- intent match
- H1/H2/H3 correctness
- CTA naturalness
- meta title/description effectiveness and typical length fit
- FAQ usefulness and non-redundancy
- missing sections, unclear claims, simplification opportunities

## Quality Rules

- Do not mention "as an AI model".
- Avoid keyword stuffing.
- Keep claims factual; flag citation needs explicitly.
- Ensure JSON-LD is valid JSON:
  - double quotes only
  - no trailing commas
- Keep output copy-paste ready.
