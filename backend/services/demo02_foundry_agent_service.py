"""
Demo 02: Foundry Agent Service
================================
Runs a hosted FoundryAgent by name and returns the response.
"""

from agent_framework.foundry import FoundryAgent
from azure.identity import AzureCliCredential

from backend.config import settings


async def run(message: str, agent_name: str) -> str:
    agent = FoundryAgent(
        project_endpoint=settings.foundry_project_endpoint,
        agent_name=agent_name,
        credential=AzureCliCredential(),
    )
    result = await agent.run(message)
    return str(result)
