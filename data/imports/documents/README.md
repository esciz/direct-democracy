# Civic Document Intake

Place manually acquired civic documents here for `npm run civic:import-documents`.

Supported inputs:

- PDF
- PNG, JPG, JPEG, TIFF, WEBP images
- saved HTML
- TXT files
- CSV manifest files
- JSON manifest files

Recommended manifest columns:

```csv
document_id,civic_entity_type,civic_entity_name,office_or_topic,jurisdiction,document_type,source_name,source_url,local_file_path,election_year,notes
```

The importer registers documents and extracted fields as pending review. It does not publish uncertain data automatically.
