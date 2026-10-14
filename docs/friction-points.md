# Friction-Point Checklist

Use this checklist before building features that touch GovCRM, public sentiment, public records, issue rankings, citizen data, or shared civic graph records.

## Questions

1. Does this let a paying government customer alter public civic truth?
2. Does this let criticism be suppressed?
3. Does this expose individual citizen sentiment without consent?
4. Does this create pay-to-rank or pay-to-influence dynamics?
5. Would citizens lose access to core civic information if a government customer stops paying?
6. Is the feature workflow, compliance, or reporting, or is it control over public opinion?

## Risk Labels

### Green: Workflow Tools

Examples:

- case assignment
- department routing
- response-time reporting
- meeting workflow tracking
- internal task queues

Green features manage government work without changing public civic truth.

### Yellow: Aggregate Analytics

Examples:

- district-level trend summaries
- issue category volume
- response-time benchmarks
- public comment counts

Yellow features can be useful, but they must avoid exposing individual citizens or allowing governments to hide inconvenient trends.

### Orange: Individual-Level Data Access

Examples:

- named constituent history
- individual sentiment history
- contact-level issue preferences
- granular comment metadata

Orange features require consent, access controls, retention rules, audit logs, and clear purpose limits.

### Red: Manipulation, Suppression, Or Control

Examples:

- deleting public criticism
- editing public sentiment totals
- changing issue rankings for paying customers
- hiding negative trends
- improving public ratings through payment
- rewriting candidate or official records outside reviewed correction workflows

Red features should not be built.
