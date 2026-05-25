"""
Foundry Client Service
======================
Factory that creates Agent instances backed by FoundryChatClient.
All demos import create_agent() from here.
"""

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

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

    client = FoundryChatClient(
        project_endpoint=settings.foundry_project_endpoint,
        model=model or settings.default_model,
        credential=DefaultAzureCredential(),
    )

    return Agent(
        client=client,
        name=name,
        instructions=instructions,
    )
