"""
Demo 01: Foundry Chat Service
==============================
Streams tokens using FoundryChatClient + Agent.
"""

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from backend.config import settings


async def stream(message: str, model: str, system_prompt: str):
    client = FoundryChatClient(
        project_endpoint=settings.foundry_project_endpoint,
        model=model,
        credential=DefaultAzureCredential(),
    )
    agent = Agent(client=client, name="WorkbenchAgent", instructions=system_prompt)

    async for chunk in agent.run(message, stream=True):
        if chunk.text:
            yield chunk.text
