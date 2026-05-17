"""
Demo 07 — Contract Comparison
==============================
Uploads a contract PDF to Azure Blob Storage (generating a SAS URL),
then submits it to Azure Content Understanding for analysis.
Mirrors the C# AzureContentUnderstandingController.UploadAndStartAnalyze flow.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas

from backend.config import settings

ANALYZERS = [
    "Contract_Term_Review",
    "ContractComparisonFromCUTeam",
    "Contract_Term_Review_Babar_Analyzer",
]


async def upload_and_start_analyze(file_bytes: bytes, filename: str, analyzer_name: str) -> dict:
    """
    1. Upload file to Azure Blob Storage and generate a time-limited SAS URL.
    2. POST the SAS URL to Azure Content Understanding to start analysis.
    3. Return the initial response (contains resultId for polling).
    """
    sas_url = await asyncio.get_event_loop().run_in_executor(
        None, _upload_and_get_sas, file_bytes, filename
    )
    return await _start_analyze(sas_url, analyzer_name)


async def get_analysis_result(result_id: str) -> dict:
    """Fetch the current status/result of a previously started analysis."""
    endpoint = (
        f"{settings.contract_cu_base_url.rstrip('/')}"
        f"/contentunderstanding/analyzerResults/{result_id}"
        f"?api-version={settings.contract_cu_api_version}"
    )
    headers = {"Ocp-Apim-Subscription-Key": settings.contract_cu_subscription_key}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(endpoint, headers=headers)
        resp.raise_for_status()
        return resp.json()


# ── Internal helpers ──────────────────────────────────────────────────────────

def _parse_connection_string(conn_str: str) -> tuple[str, str]:
    """Extract AccountName and AccountKey from a storage connection string."""
    parts: dict[str, str] = {}
    for segment in conn_str.split(";"):
        if "=" in segment:
            key, value = segment.split("=", 1)
            parts[key] = value
    return parts.get("AccountName", ""), parts.get("AccountKey", "")


def _upload_and_get_sas(file_bytes: bytes, filename: str) -> str:
    """Upload bytes to blob storage and return a SAS URL valid for the configured hours."""
    conn_str = settings.contract_blob_connection_string
    container_name = settings.contract_blob_container_name
    account_name, account_key = _parse_connection_string(conn_str)

    service_client = BlobServiceClient.from_connection_string(conn_str)
    blob_name = f"{uuid.uuid4()}-{filename}"
    container_client = service_client.get_container_client(container_name)
    container_client.upload_blob(blob_name, file_bytes, overwrite=True)

    expiry = datetime.now(timezone.utc) + timedelta(
        hours=settings.contract_blob_sas_expiration_hours
    )
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=container_name,
        blob_name=blob_name,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=expiry,
    )
    blob_url = (
        f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}"
    )
    return f"{blob_url}?{sas_token}"


async def _start_analyze(sas_url: str, analyzer_name: str) -> dict:
    """POST to Content Understanding analyze endpoint and return the raw response."""
    endpoint = (
        f"{settings.contract_cu_base_url.rstrip('/')}"
        f"/contentunderstanding/analyzers/{analyzer_name}:analyze"
        f"?api-version={settings.contract_cu_api_version}"
    )
    headers = {
        "Ocp-Apim-Subscription-Key": settings.contract_cu_subscription_key,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(endpoint, json={"url": sas_url}, headers=headers)
        resp.raise_for_status()
        return resp.json()
