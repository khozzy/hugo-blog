---
name: incentive-builder
description: Used then generating incentive (lead magnets) for blog posts. Conatins instructions on building final bundle, generating Gumroad description and processing PDF files.
---

## Incentives (Lead Magnets)

Lead magnets are managed as standalone products in the `incentives/` directory, built as PDFs, and distributed via Gumroad.

### Structure

```
incentives/
└── <product-slug>/
    ├── content.md       # Source markdown for the PDF
    └── assets/          # Images, config files bundled with the guide

dist/incentives/                    # Build outputs (gitignored)
├── <product-slug>.pdf              # Main PDF guide
└── <product-slug>-assets.zip       # Asset bundle (if assets/ exists)
```

### Distribution Workflow

1. Create/edit `incentives/<product>/content.md`
2. Run `just incentive <product>` to build PDF + asset bundle
3. Upload to Gumroad as $0 product:
   - PDF (primary deliverable)
   - Asset zip (if generated - contains config files, etc.)
4. Use gumroad shortcode in blog post with the Gumroad URL
5. Gumroad captures email on download → webhook syncs to Beehiiv

### PDF Styling

Shared CSS for PDF generation: `assets/pdf/kozlovski-pdf.css`

### Build Script

The `scripts/build_incentive.py` script builds PDFs from markdown content.

**Pipeline**: `content.md` → pandoc/extra (Docker) → temp.html → weasyprint (Docker) → output.pdf

**Features**:
- Converts markdown to PDF via Docker containers (pandoc + weasyprint)
- Zips assets directory if present