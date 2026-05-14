"""
Demo 06 — Azure Content Understanding
======================================
Upload a medical report PDF and analyze it with Azure AI Content Understanding.
Uses AnalysisInput(data=...) to send file bytes directly — no blob storage needed.
"""

import asyncio

from azure.ai.contentunderstanding import ContentUnderstandingClient
from azure.ai.contentunderstanding.models import AnalysisInput
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import AzureError

from backend.config import settings

_API_VERSION = "2025-11-01"


async def analyze(file_bytes: bytes, filename: str, analyzer_id: str) -> dict:
    """Send file bytes to Content Understanding and return the analysis result dict."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_analysis, file_bytes, filename, analyzer_id)


def _run_analysis(file_bytes: bytes, filename: str, analyzer_id: str) -> dict:
    credential = AzureKeyCredential(settings.foundry_api_key)
    client = ContentUnderstandingClient(
        endpoint=settings.content_understanding_endpoint,
        credential=credential,
        api_version=_API_VERSION,
    )

    poller = client.begin_analyze(
        analyzer_id=analyzer_id,
        inputs=[
            AnalysisInput(
                data=file_bytes,
                name=filename,
                mime_type="application/pdf",
            )
        ],
    )
    result = poller.result()
    return result.as_dict()
