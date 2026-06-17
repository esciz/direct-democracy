# Campaign Finance Document Intake

Place manually downloaded campaign finance filings here, upload them from `/admin/data-factory/campaign-finance/upload`, or describe them in a CSV/JSON manifest consumed by `npm run civic:import-documents`.

CSV manifest columns:

```csv
candidate_name,office,jurisdiction,committee_name,report_name,report_year,filing_date,source_url,document_url,local_file_path,notes
```

Fields the importer attempts to identify from text-based PDFs:

- candidate or committee name
- office or race
- reporting period
- total contributions
- total expenditures
- cash on hand
- PAC or committee names
- filing date
- amended filing flag

Finance totals remain pending review unless confidence is high enough for later reviewer approval.
