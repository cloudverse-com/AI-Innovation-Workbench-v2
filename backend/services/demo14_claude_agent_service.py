"""
Demo 14: MAF Agent + Claude Model
=================================
A Microsoft Agent Framework (MAF) agent whose model is an **Anthropic Claude**
deployment — served through your Azure AI Foundry project.

The point of this demo is that the MAF agent abstraction is **provider-agnostic**.
Demos 11–13 wrap `FoundryChatClient` around an Azure-hosted GPT model; here the
exact same `Agent(client=FoundryChatClient(...))` wrapper is pointed at a Claude
deployment instead. Nothing about the agent code changes — only the model name.

  1. Client — FoundryChatClient(model=<your Claude deployment name>)
  2. Agent  — Agent(client=client, instructions=system_prompt)
  3. Answer — streamed tokens, identical to the other Foundry demos.

Why Foundry and not the Anthropic API directly? Foundry hosts Anthropic models
in its catalog, so the same project endpoint, the same `DefaultAzureCredential`,
and the same client serve Claude — no separate API key, no new SDK. Swap the
deployment name and you've swapped model providers.

Config (backend/.env): CLAUDE_MODEL — the deployment name of the Claude model
in your Foundry project (e.g. "claude-opus-4-1"). It must match exactly.
"""

from typing import AsyncGenerator

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from backend.config import settings

_SYSTEM_PROMPT = (
    "You are Claude, a helpful AI assistant running inside a Microsoft Agent "
    "Framework agent. Answer clearly and concisely."
)


def _resolve_model() -> str:
    """The Claude deployment to run. This demo is always Claude — the global
    model dropdown does not apply here — so we ignore any caller-supplied model
    and always use CLAUDE_MODEL."""
    if not settings.foundry_project_endpoint:
        raise ValueError("FOUNDRY_PROJECT_ENDPOINT is not set in backend/.env.")
    if not settings.claude_model:
        raise ValueError(
            "CLAUDE_MODEL is not set in backend/.env. Set it to the deployment "
            "name of an Anthropic Claude model deployed in your Azure AI Foundry "
            'project (e.g. "claude-sonnet-4-6").'
        )
    return settings.claude_model


async def stream(
    message: str, system_prompt: str | None = None
) -> AsyncGenerator[str, None]:
    """Stream the Claude agent's answer token-by-token."""
    client = FoundryChatClient(
        project_endpoint=settings.foundry_project_endpoint,
        model=_resolve_model(),
        credential=DefaultAzureCredential(),
    )
    agent = Agent(
        client=client,
        name="ClaudeAgent",
        instructions=system_prompt or _SYSTEM_PROMPT,
    )

    async for chunk in agent.run(message, stream=True):
        if chunk.text:
            yield chunk.text
