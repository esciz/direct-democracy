# Civic review first pass — September 7, 2026

The owner requested a first pass over the admin review queue and permanent removal of routine minutes approvals and similar meeting business from voter reporting.

The pass examined all 4,311 queue entries (903 vote flags and 3,408 identity groups). Historical normalized identity IDs collapse to 4,234 distinct review decisions. The batch saved 4,233 decisions to production and preserved the one existing admin decision. Every batch decision has an audit event and is labeled **Astra automated first pass**. This is conservative automated triage of extracted source evidence, not manual verification of every original PDF.

| Result | Count |
| --- | ---: |
| Routine minutes approval vote flags | 40 |
| Routine agenda approval vote flags | 19 |
| Substantive/uncertain votes requiring explicit outcome evidence | 122 |
| Votes requiring meeting-date attendance/roster evidence | 175 |
| Votes requiring tally/distribution reconciliation | 547 |
| Clear non-person identity fragments/headings | 112 |
| Identities requiring historical membership verification | 3,216 |
| Conflicting normalized identity groups requiring review | 3 |

Across the 34,418 source items, 1,306 routine items qualify for reporting exclusion. Applying the policy to this dataset removes 316 vote/motion rows, 57 decision cards (34 already-public question cards), 29 extracted official actions, 40 citizen questions, and 66 aggregate-only outcomes from derived reporting inputs. Source meeting items, original documents and action-result evidence remain available. The remaining substantive vote queue contains 844 flags.

The report at `.local/civic-first-pass-review.json` contains every decision and reason. `data/seed/civic-reporting-exclusions.json` retains the reviewed routine item IDs. No real person's identity or vote was guessed or newly approved by this pass.

## Standing reporting policy

`lib/public-meetings/reporting-policy.ts` excludes routine minutes/agenda approvals and standalone adjournment. It conservatively retains mixed items mentioning contracts, budgets, land use, taxes, fees, appointments or other substantive business. Consent agendas are not automatically excluded.

The rule is applied during vote/card/action generation and again during `prebuild`, after any restored civic release and before lossless runtime packing. The build overlay filters derived vote/card/action/question artifacts, updates review counts and rebuilds accountability summaries. It never modifies source meeting items or source documents. A substantive correction to a known source item is re-evaluated and can supersede an earlier exclusion. `public-meeting-reporting-policy-audit.json` records the active exclusions.

The review batch is opt-in: `node --import tsx scripts/review-civic-first-pass.ts` generates the local report; `--apply` saves new decisions to the configured database. It never overwrites existing admin decisions or notes. It must not run implicitly during a build.

Validation: reporting-policy regression tests, vote-artifact integrity audit, durable-review service tests, TypeScript check and production build. Live verification checks saved notes, the updated queue counts and preserved substantive entries.
