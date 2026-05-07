"""
Foundry Client Service
======================
Factory that creates Agent instances backed by FoundryChatClient.
All demos import create_agent() from here.
"""

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.core.credentials import AzureKeyCredential

from backend.config import settings


def create_agent(
    instructions: str,
    model: str | None = None,
    name: str = "WorkbenchAgent",
) -> Agent:
    """
    Creates a fresh Agent backed by FoundryChatClient for a single request.

    Each call returns a new Agent — agents are stateless; conversation history
    is managed by the caller and injected into the message text.
    """
    if not settings.foundry_project_endpoint:
        raise ValueError(
            "FOUNDRY_PROJECT_ENDPOINT is not set. "
            "Copy backend/.env.template to backend/.env and fill in your values."
        )
    if not settings.foundry_api_key:
        raise ValueError(
            "FOUNDRY_API_KEY is not set. "
            "Copy backend/.env.template to backend/.env and fill in your values."
        )

    client = FoundryChatClient(
        project_endpoint=settings.foundry_project_endpoint,
        model=model or settings.default_model,
        credential=AzureKeyCredential(settings.foundry_api_key),
    )

    return Agent(
        client=client,
        name=name,
        instructions=instructions,
    )
