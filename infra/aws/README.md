# LegumAmies — AWS infrastructure (`infra/aws/`)

Reproducible, incremental AWS setup. Each step is a self-contained script that
relies on the ambient IAM instance role (no static credentials; no secrets are
stored here). Region: **us-east-1**.

## Step 1 — private RAG source bucket
`step1_s3_rag_bucket.sh`
- Private S3 bucket `legumamies-rag-<account>-<rand>` (Block Public Access on,
  SSE-S3 default encryption, ACLs disabled) + `sources/` prefix.
- Created bucket: `legumamies-rag-040416400623-2e32fb7c`.

## Step 2 — Bedrock RAG Knowledge Base (this step)
`step2_create_kb.sh` then `step2_test_retrieval.sh`

Components:
- **Embeddings:** Amazon Titan Text Embeddings V2 (`amazon.titan-embed-text-v2:0`, 1024-dim).
- **Vector store:** **Amazon S3 Vectors** (`legumamies-rag-vectors-040416400623`,
  index `legumes-kb-index`, 1024-dim, cosine). Chosen over OpenSearch
  Serverless to avoid OSS's higher baseline cost.
- **Service role:** `legumamies-bedrock-kb-role` (`kb_trust_policy.json` +
  `kb_permissions_policy.json`): invoke Titan, read the source bucket, read/write
  the vector store. Least-privilege, scoped by ARN + account conditions.
- **Knowledge Base / Data Source config:** `kb_config.json`, `kb_storage.json`,
  `kb_datasource.json`.
- **Corpus:** `kb_corpus/sources/*.md` — original paraphrased French summaries of
  Terres Inovia / Agreste material, each with inline citations. Provenance and
  reuse rights in `kb_corpus/manifest.csv`. Uploaded to the bucket's `sources/`.

Live resource ids are recorded (non-secret) in `kb_resources.json`.

### Run
```bash
# upload corpus (once), then build + ingest, then test retrieval
aws s3 cp kb_corpus/sources/ s3://legumamies-rag-040416400623-2e32fb7c/sources/ --recursive
./step2_create_kb.sh
./step2_test_retrieval.sh
```

### Data honesty & licensing
- Corpus docs are **paraphrased summaries with attribution**, not verbatim
  copies. Terres Inovia content is copyrighted (facts cited, not reproduced);
  Agreste data is Licence Ouverte / Etalab (reuse with attribution).
- Statistics in the corpus are **national/regional aggregates**, never to be
  presented as individual-field measurements.

### Scope guard
Steps 1–2 only. No Bedrock **agent**, no app deployment, no Step 3 here.
