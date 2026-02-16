# PIB Boardroom Prep — Website & Marketing Audit
**Date:** 2026-02-12 (for Feb 13, 9am leadership kickoff)

## 1) Current Website Assessment
**What’s there (from HTML shell):**
- React SPA (single-page app) loading `/static/js/main.342200c1.js` and `/static/css/main.6238e360.css`.
- Strong meta description + keywords + OG/Twitter tags present.
- Brand positioning: “Professional Software Development & AI Solutions.”
- CTA implied in OG: “Get your FREE project specification today!”

**What’s missing / risk areas:**
- No server-rendered content in HTML (empty `#root`), so search engines and link previews rely on JS execution; weak for SEO and shareability.
- Unknown on-page content structure (H1/H2, proof points, case studies, pricing, process). Needs verification with a browser render.
- Likely lacks explicit trust signals: client logos, testimonials, case studies, certifications, awards.
- Lead capture: no evidence of structured lead form, lead magnet, or booking flow in HTML shell.

**Visual & UX (inferred):**
- Modern React build suggests contemporary UI, but cannot verify layout without rendering.

**Mobile responsiveness:**
- `meta viewport` present; likely responsive CSS, but needs visual QA across device sizes.

**Recommendation:** render audit in browser + take a mobile screenshot pass to confirm layout, CTAs, and form flows.

---

## 2) SEO Analysis
**Meta tags (present):**
- Title: “Partners in Biz - Professional Software Development & AI Solutions”
- Description: “Transform your business with custom software development, web applications, mobile apps, and AI solutions. Professional development services in South Africa.”
- Keywords: “software development, web development, mobile app development, AI solutions, custom software, React, TypeScript, full-stack development”
- Robots: index, follow
- OG/Twitter: title/description present (good for social share)

**SEO gaps:**
- SPA without SSR or pre-rendering = thin crawlable content.
- No evidence of structured data (Organization, LocalBusiness, FAQ, Service). 
- No evidence of sitemap.xml / robots.txt in HTML (needs verification).
- No visible page-specific content strategy (service pages, industry pages, case studies).

**Page speed (inferred):**
- Single JS bundle may impact LCP and TTI on mobile networks.
- Preconnects are present (fonts, firebase, GA), but main bundle likely heavy.

**Keyword opportunities:**
- Core: “custom software development South Africa”, “AI solutions South Africa”, “software development company SA”, “web app development South Africa”.
- Vertical/industry keywords: “fintech software development SA”, “logistics software SA”, “construction software SA”.
- Local pages: Johannesburg, Cape Town, Durban, Pretoria.

---

## 3) Competitor Landscape (SA: software dev + AI solutions)
**Direct dev shops / agencies:**
- **BBD** (enterprise software, strong brand)
- **Entelect** (custom software & data/AI)
- **Retro Rabbit** (product development)
- **Synthesis** (enterprise software)
- **DVT** (custom software, cloud)
- **Realm Digital** (software engineering)
- **SovTech** (software dev + digital products)

**AI / data-focused firms overlapping services:**
- **Deloitte AI / Accenture / IBM** (enterprise-level AI)
- **AIONA**, **DataProphet**, **Brandwatch SA**, **Cape AI community** (AI adjacent)

**Implication:** PIB must differentiate on **speed**, **founder-led delivery**, **practical AI**, and **SME-friendly pricing/engagement**.

---

## 4) Marketing Channel Recommendations
**Primary (B2B, SA market fit):**
- **LinkedIn**: founder-led posts, case studies, client outcomes, technical insights. Best ROI for B2B.
- **Content marketing (SEO)**: service pages + case studies + industry landing pages.
- **Google Search Ads**: high-intent keywords (“custom software development SA”, “AI development company SA”).

**Secondary:**
- **Clutch / GoodFirms / Sortlist**: credibility + lead capture.
- **Partnerships**: agencies without dev capacity, consultancies, accountants.
- **Email**: lead nurture + monthly insights.

**Channel priority order:** LinkedIn + SEO + Search Ads, then directories/partnerships.

---

## 5) Quick Wins (Next 2 Weeks)
1. **Add 2–3 case studies** (even short-form) with measurable outcomes.
2. **Create 3 service pages**: Custom Software, AI Solutions, Mobile/Web Apps.
3. **Add a clear lead capture**: “Book a 30‑min strategy call” + Calendly.
4. **Add trust signals**: client logos, testimonials, founder bio.
5. **Implement basic schema markup** (Organization + Service + FAQ).
6. **Create a simple pricing/engagement model page** (starter vs custom) to reduce friction.
7. **Set up analytics goals** (form submit, call booking, contact clicks).

---

## 6) 90-Day Marketing Roadmap (High-Level)
**Month 1: Foundations**
- Website: add service pages, case studies, lead capture, schema.
- Analytics: GA4 + conversion goals + CRM capture.
- LinkedIn: 3 posts/week, founder POV + project insights.

**Month 2: Demand & Credibility**
- Publish 4 SEO blog posts (AI & software ROI for SMEs).
- Launch Google Search Ads (10–15 core keywords).
- List on Clutch/GoodFirms/Sortlist + collect 2 reviews.

**Month 3: Scale & Optimization**
- Add industry landing pages (2–3 verticals).
- Retargeting ads on LinkedIn + Google Display.
- Launch a lead magnet (AI readiness checklist / software discovery guide).

**Success metrics:**
- +30–50% site traffic
- 10–15 qualified leads/month
- 2–3 closed projects from inbound

---

## Notes & Limitations
- SPA prevents deep on-page SEO without JS rendering. Recommend SSR or pre-render for key pages.
- Visual/UX review requires browser render (not available in this run). Final polish should include a full mobile QA pass.
