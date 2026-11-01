# Legume'Ami agronomic PDF ingestion — jury release

## Three official French sources

- Pois chiche 2026: https://www.terresinovia.fr/sites/default/files/2026-04/guide_culture_pois-chiche_2026_terresinovia.pdf
- Pois proteagineux 2025: https://www.terresinovia.fr/sites/default/files/2025-05/guide-de-culture-pois-conventionnel-2025.pdf
- Lentille 2023: https://www.terresinovia.fr/sites/default/files/2025-06/guide-de-culture-lentille-2023.pdf

Registry: data/rag/terres_inovia_sources.json. SHA256 values for the first two match the user-uploaded files. The publisher's lentil document is confirmed online; its checksum has not been measured in this environment.

These PDF documents are copyrighted. Terres Inovia allows free downloading but prohibits reproduction or reuse without written permission. Do not republish entire third-party PDFs into the public GitHub repo. Obtain appropriate permission before using the documents in RAG. Keep original documents in private storage.

## Bedrock embedding steps (execute on Kiro AWS host)

The existing Knowledge Base is C5WRYFYF1O, region us-east-1. Reuse its existing S3 data source, not a newly created KB.

Step 1: copy original uploaded PDFs into data/rag/private-pdfs/ (Git ignored), or use the publisher's official links.

Step 2: check PDFs and hashes without AWS changes:

    python scripts/ingest_terres_inovia.py --download-missing

Step 3: discover the EXISTING S3 data source ID:

    aws bedrock-agent list-data-sources --knowledge-base-id C5WRYFYF1O --region us-east-1

Step 4: verify the S3 bucket and inclusion prefix:

    aws bedrock-agent get-data-source --knowledge-base-id C5WRYFYF1O --data-source-id EXISTING_ID --region us-east-1

Step 5: only after permission/storage checks, upload PDFs + document metadata and start indexing:

    python scripts/ingest_terres_inovia.py --download-missing --kb-id C5WRYFYF1O --data-source-id EXISTING_ID --region us-east-1 --apply --sync

Step 6: wait for ingestion status COMPLETE:

    aws bedrock-agent get-ingestion-job --knowledge-base-id C5WRYFYF1O --data-source-id EXISTING_ID --ingestion-job-id JOB_ID --region us-east-1

Step 7: test actual retrieval and POST /advisor/ask independently for each crop. Check that lentil evidence does not get mixed with chickpea evidence. Verify the assistant cites the official publisher PDF URL, document title and actual page when Bedrock provides a page number. Never invent page numbers.

The loader uses metadata sidecars with crop, source_title, publisher, publication_year, original_source_url and other attributes. It uploads documents into the existing S3 bucket and triggers the existing KB ingestion; it does not create a new KB or data source. A successful PDF upload is NOT evidence that embeddings were indexed; verify COMPLETE and run a real KB retrieve request.

## Merge strategy

This branch starts from Kiro's Chrome-verified feature/hackathon-ami-integration. Do not overwrite its tested Ami, analytics, map and notifications by wholesale-merging the older PR #8. The new work consists of missing polygon drawing, parcel journal, and RAG ingestion/citations only. Kiro must run npm ci, npm run lint, npm run build, Python tests, actual browser checks, and AWS smoke tests before release.
