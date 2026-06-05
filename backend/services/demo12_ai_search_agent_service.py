"""
Demo 12: Agent Grounded with Azure AI Search
============================================
A Microsoft Agent Framework agent that grounds its answers in an existing
Azure AI Search index — managed RAG, server-side.

Unlike Demo 11 (which embeds chunks into an in-memory store and retrieves
locally), retrieval here happens inside Foundry: the agent is given the hosted
Azure AI Search tool — bound to a Foundry *project connection* + index name —
and Foundry runs the search and grounds the model on the results, returning
inline citations.

  1. Tool   — an `azure_ai_search` hosted-tool definition (connection + index).
  2. Agent  — Agent(client=FoundryChatClient(...), tools=[ai_search])
  3. Answer — streamed tokens; url_citation annotations are harvested into
              a list of sources returned at the end of the stream.

Note on the tool: agent-framework-foundry 1.0.0 doesn't ship a
`get_azure_ai_search_tool()` factory yet (newer releases do). Rather than
upgrade — which would disturb the azure-ai-projects pin Demo 11 relies on — we
hand the FoundryChatClient the raw hosted-tool dict. The client passes unknown
tool dicts through unchanged to the Foundry Responses API, which understands the
`azure_ai_search` tool type. The dict shape mirrors the official REST sample.

Config (backend/.env): AZURE_AI_SEARCH_CONNECTION_ID, AZURE_AI_SEARCH_INDEX,
AZURE_AI_SEARCH_QUERY_TYPE, AZURE_AI_SEARCH_TOP_K.
"""

from typing import Any, AsyncGenerator

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from backend.config import settings

_SYSTEM_PROMPT = (
    "You are a knowledge assistant grounded in an Azure AI Search index. "
    "Answer using only the information returned by the Azure AI Search tool. "
    "If the answer is not in the retrieved content, say so plainly. "
    "Always provide citations for your answers and render them as "
    "[message_idx:search_idx†source]."
)


def _require_config() -> None:
    """Fail early with an actionable message if grounding isn't configured."""
    if not settings.foundry_project_endpoint:
        raise ValueError("FOUNDRY_PROJECT_ENDPOINT is not set in backend/.env.")
    if not settings.azure_ai_search_connection_id:
        raise ValueError(
            "AZURE_AI_SEARCH_CONNECTION_ID is not set in backend/.env. "
            "Use the full Foundry project connection ID for your Azure AI Search "
            "connection (Management center > Connections), not the search "
            "service resource ID."
        )
    if not settings.azure_ai_search_index:
        raise ValueError("AZURE_AI_SEARCH_INDEX is not set in backend/.env.")


def _build_ai_search_tool() -> dict:
    """The `azure_ai_search` hosted-tool definition, per the Foundry REST shape."""
    return {
        "type": "azure_ai_search",
        "azure_ai_search": {
            "indexes": [
                {
                    "project_connection_id": settings.azure_ai_search_connection_id,
                    "index_name": settings.azure_ai_search_index,
                    "query_type": settings.azure_ai_search_query_type,
                    "top_k": settings.azure_ai_search_top_k,
                }
            ]
        },
    }


def _build_agent(model: str, system_prompt: str) -> Agent:
    _require_config()

    client = FoundryChatClient(
        project_endpoint=settings.foundry_project_endpoint,
        model=model,
        credential=DefaultAzureCredential(),
    )

    return Agent(
        client=client,
        name="AISearchGroundedAgent",
        instructions=system_prompt,
        tools=[_build_ai_search_tool()],
    )


def _harvest_citations(obj: Any, sink: list[dict], seen: set[str]) -> None:
    """
    Defensively pull url_citation annotations off a streamed update or message.
    Streaming shapes vary, so we look both at `.contents` directly and at any
    nested `.messages[].contents`.
    """
    def _from_content(content: Any) -> None:
        for ann in getattr(content, "annotations", None) or []:
            url = getattr(ann, "url", None)
            title = getattr(ann, "title", None)
            key = url or title
            if key and key not in seen:
                seen.add(key)
                sink.append({"title": title or url, "url": url})

    for content in getattr(obj, "contents", None) or []:
        _from_content(content)
    for message in getattr(obj, "messages", None) or []:
        for content in getattr(message, "contents", None) or []:
            _from_content(content)


async def stream(
    message: str, model: str, system_prompt: str | None = None
) -> AsyncGenerator:
    """
    Stream the grounded answer token-by-token. Yields:
      - str   for each answer token, and
      - dict  {"citations": [...]} once, at the end.
    The route turns these into SSE events.
    """
    agent = _build_agent(model, system_prompt or _SYSTEM_PROMPT)

    citations: list[dict] = []
    seen: set[str] = set()

    async for chunk in agent.run(message, stream=True):
        _harvest_citations(chunk, citations, seen)
        if chunk.text:
            yield chunk.text

    yield {"citations": citations}
