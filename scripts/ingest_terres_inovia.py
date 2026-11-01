#!/usr/bin/env python3
"""Load three sourced French legume PDFs into an EXISTING private Bedrock KB S3 data source.

Never commits or republishes the copyrighted source PDFs to the public repo.
Dry-run by default. Requires boto3 and configured AWS credentials only with --apply.

Examples:
  python scripts/ingest_terres_inovia.py --download-missing
  python scripts/ingest_terres_inovia.py --kb-id C5WRYFYF1O --data-source-id ID --download-missing --apply --sync
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "data/rag/terres_inovia_sources.json"
LOCAL = ROOT / "data/rag/private-pdfs"
MAX_BYTES = 35 * 1024 * 1024


def sha256_of(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def download_pdf(url: str, destination: Path) -> None:
    if not url.startswith("https://www.terresinovia.fr/"):
        raise ValueError("Downloads must be from the official Terres Inovia domain")
    request = Request(url, headers={"User-Agent": "LegumeAmi-RAG-Source-Loader/1.0"})
    with urlopen(request, timeout=35) as response:
        if response.status != 200:
            raise RuntimeError("HTTP " + str(response.status))
        temp = destination.with_suffix(".pdf.partial")
        try:
            received = 0
            with temp.open("wb") as out:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    received += len(chunk)
                    if received > MAX_BYTES:
                        raise RuntimeError("PDF exceeded 35 MB safety limit")
                    out.write(chunk)
            if not temp.read_bytes().startswith(b"%PDF-"):
                raise RuntimeError("Downloaded file is not a PDF")
            temp.replace(destination)
        finally:
            temp.unlink(missing_ok=True)


def s3_config(agent, kb_id: str, ds_id: str) -> tuple[str, list[str]]:
    ds = agent.get_data_source(knowledgeBaseId=kb_id, dataSourceId=ds_id)["dataSource"]
    cfg = ds.get("dataSourceConfiguration") or {}
    if cfg.get("type") != "S3":
        raise RuntimeError("The selected KB data source is not S3; refusing to create a new data source")
    s3 = cfg.get("s3Configuration") or {}
    arn = s3.get("bucketArn", "")
    if not arn.startswith("arn:aws:s3:::"):
        raise RuntimeError("Cannot read the existing KB S3 bucket ARN")
    return arn.split(":::", 1)[1], s3.get("inclusionPrefixes") or []


def run() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=LOCAL)
    parser.add_argument("--download-missing", action="store_true",
                        help="Fetch source PDFs from official Terres Inovia URLs if absent")
    parser.add_argument("--apply", action="store_true",
                        help="Upload to the preexisting S3 KB bucket, rather than dry-run")
    parser.add_argument("--sync", action="store_true",
                        help="Start a KB ingestion job after upload; implies --apply")
    parser.add_argument("--kb-id", default=os.getenv("LEGUMAMIES_KB_ID", "C5WRYFYF1O"))
    parser.add_argument("--data-source-id", default=os.getenv("LEGUMAMIES_KB_DATA_SOURCE_ID", ""))
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "us-east-1"))
    parser.add_argument("--prefix", default="",
                        help="S3 folder inside KB inclusion prefix (default: automatic)")
    parser.add_argument("--output-report", type=Path, default=None)
    args = parser.parse_args()

    corpus = json.loads(REGISTRY.read_text(encoding="utf-8"))
    args.source_dir.mkdir(parents=True, exist_ok=True)
    processed = []
    for doc in corpus["documents"]:
        path = args.source_dir / doc["filename"]
        if not path.exists():
            if not args.download_missing:
                print("MISSING", path, "| retry with --download-missing or copy the uploaded PDF here")
                return 2
            print("Downloading official:", doc["official_url"])
            try:
                download_pdf(doc["official_url"], path)
            except Exception as exc:
                print("DOWNLOAD FAILED:", doc["id"], str(exc),
                      "| use the PDF supplied by the farmer instead", file=sys.stderr)
                return 2
        if path.stat().st_size > MAX_BYTES or path.stat().st_size < 1000:
            print("REJECTED PDF size:", path, file=sys.stderr)
            return 2
        with path.open("rb") as stream:
            if stream.read(5) != b"%PDF-":
                print("Not a PDF:", path, file=sys.stderr)
                return 2
        sha = sha256_of(path)
        expected = doc.get("uploaded_sha256")
        if expected and sha != expected:
            print("SHA-256 mismatch for", doc["id"], "expected", expected,
                  "got", sha, file=sys.stderr)
            return 2
        processed.append((doc, path, sha))
        print(doc["id"], "|", path.stat().st_size, "bytes | sha256", sha)

    if not args.apply and not args.sync:
        print("DRY RUN complete: no network writes, no AWS changes.")
        return 0

    if not args.data_source_id:
        print("Set --data-source-id (existing KB S3 data source). "
              "Discover with: aws bedrock-agent list-data-sources "
              "--knowledge-base-id " + args.kb_id + " --region " + args.region,
              file=sys.stderr)
        return 2
    import boto3
    agent = boto3.client("bedrock-agent", region_name=args.region)
    bucket, prefixes = s3_config(agent, args.kb_id, args.data_source_id)
    prefix = args.prefix.strip("/")
    if prefix and prefixes and not any(prefix.startswith(p.strip("/")) for p in prefixes):
        raise RuntimeError("Prefix is outside the configured KB inclusionPrefixes")
    if not prefix:
        prefix = (prefixes[0].strip("/") + "/" if prefixes else "rag/") + "terres-inovia"
    if prefixes and not any(prefix.startswith(p.strip("/")) for p in prefixes):
        raise RuntimeError("Generated destination is outside KB data-source inclusionPrefixes")
    prefix = prefix.strip("/")
    s3 = boto3.client("s3", region_name=args.region)

    uploaded = []
    for doc, path, sha in processed:
        key = prefix + "/" + doc["filename"]
        # Keep the filterable metadata small: the KB vector store is S3 Vectors, which caps
        # filterable metadata at 2048 bytes per record (chunk text + attributes). We keep only
        # the attributes needed for citations and drop the redundant publisher page URL.
        attr = {
            "document_id": doc["id"],
            "crop": doc["crop"],
            "source_title": doc["title"],
            "publisher": "Terres Inovia",
            "publication_year": doc["year"],
            "original_source_url": doc["official_url"],
            "language": "fr",
        }
        # NOTE: this KB's vector store is S3 Vectors, which caps filterable metadata at 2048
        # bytes per record (chunk text + attributes). A custom `*.metadata.json` sidecar pushes
        # larger PDF chunks over that limit and the ingestion job FAILS. We therefore upload the
        # PDF only. Citations still resolve to the correct publisher, exact source URL and real
        # page number via src/advisor/tools.py (_DOC_PROVENANCE filename map +
        # x-amz-bedrock-kb-document-page-number that Bedrock populates for PDFs). `attr` is kept
        # for reference / a future non-S3-Vectors store.
        _ = attr
        s3.upload_file(str(path), bucket, key,
                       ExtraArgs={"ContentType": "application/pdf",
                                  "Metadata": {"sha256": sha, "source-id": doc["id"]}})
        uploaded.append({"document_id": doc["id"], "s3_key": key, "sha256": sha})
        print("UPLOADED", "s3://" + bucket + "/" + key)

    job = None
    if args.sync:
        job = agent.start_ingestion_job(
            knowledgeBaseId=args.kb_id, dataSourceId=args.data_source_id,
            description="Légume'Ami French legume guides source refresh"
        )["ingestionJob"]
        print("INGESTION STARTED", job.get("ingestionJobId"), "status", job.get("status"))
        print("Indexing is asynchronous: check status with aws bedrock-agent get-ingestion-job.")
    else:
        print("UPLOADED; run again with --sync to request vector embedding/indexing.")

    result = {"knowledge_base_id": args.kb_id, "data_source_id": args.data_source_id,
              "bucket": bucket, "prefix": prefix, "uploaded": uploaded,
              "ingestion_job_id": job.get("ingestionJobId") if job else None}
    if args.output_report:
        args.output_report.parent.mkdir(parents=True, exist_ok=True)
        args.output_report.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
