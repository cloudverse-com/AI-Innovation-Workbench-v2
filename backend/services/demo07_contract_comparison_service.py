"""
Demo 07 — Contract Comparison
==============================
Uploads a contract PDF to Azure Blob Storage (generating a SAS URL),
then submits it to Azure Content Understanding for analysis using the
azure-ai-contentunderstanding SDK.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from azure.ai.contentunderstanding.aio import ContentUnderstandingClient
from azure.ai.contentunderstanding.models import AnalysisInput
from azure.core.credentials import AzureKeyCredential
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas

from backend.config import settings

ANALYZERS = [
    "Contract_Term_Review",
    "ContractComparisonFromCUTeam",
    "Contract_Term_Review_Babar_Analyzer",
]


def _make_cu_client() -> ContentUnderstandingClient:
    return ContentUnderstandingClient(
        endpoint=settings.contract_cu_base_url,
        credential=AzureKeyCredential(settings.contract_cu_subscription_key),
        api_version=settings.contract_cu_api_version,
    )


async def upload_and_start_analyze(file_bytes: bytes, filename: str, analyzer_name: str) -> dict:
    """
    1. Upload file to Azure Blob Storage and generate a time-limited SAS URL.
    2. Start a Content Understanding analysis via the SDK.
    3. Return a dict with resultId for polling.
    """
    sas_url = await asyncio.get_event_loop().run_in_executor(
        None, _upload_and_get_sas, file_bytes, filename
    )
    async with _make_cu_client() as client:
        poller = await client.begin_analyze(
            analyzer_name,
            inputs=[AnalysisInput(url=sas_url)],
        )
        return {"resultId": poller.operation_id}


async def get_analysis_result(result_id: str) -> dict:
    """Fetch the current status/result of a previously started analysis."""
    async with _make_cu_client() as client:
        result = await client._get_result(result_id)
        return dict(result)


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

