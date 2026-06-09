"""
Demo 13: MAF Agent + MCP Tool Call
==================================
A Microsoft Agent Framework (MAF) agent that calls a **remote MCP server**
mid-conversation to ground its answers in live, trusted data.

Model Context Protocol (MCP) is an open standard that lets an agent discover
and invoke tools hosted by an external server. Here the agent connects to the
**official Microsoft Learn MCP Server** (https://learn.microsoft.com/api/mcp) —
a free, public, no-auth server (Streamable HTTP transport) that exposes tools
such as `microsoft_docs_search` and `microsoft_docs_fetch` over real Microsoft
documentation.

Flow:
  1. Tool   — MCPStreamableHTTPTool connects to the MCP server and auto-discovers
              its tools (the agent never hard-codes them).
  2. Agent  — Agent(client=FoundryChatClient(...), tools=[mcp_tool])
  3. Loop   — the model decides when to call an MCP tool; MAF runs the tool-call
              loop, sends the MCP results back to the model, and streams the
              final grounded answer.

Why this matters for a client: the same pattern points at ANY MCP server —
internal knowledge bases, ticketing systems, databases — by changing one URL.
Swap MCP_SERVER_URL in backend/.env to demo a different server.

Config (backend/.env): MCP_SERVER_URL, MCP_SERVER_LABEL (both have sensible
defaults that target the Microsoft Learn MCP Server, so the demo works out of
the box with no extra setup).
"""

from typing import Any, AsyncGenerator

from agent_framework import Agent, MCPStreamableHTTPTool
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from backend.config import settings

_SYSTEM_PROMPT = (
    "You are a Microsoft technology assistant. When a question concerns Azure, "
    ".NET, Microsoft 365, Windows, or any Microsoft product or API, you MUST use "
    "the Microsoft Learn MCP tools to look up the answer in the official "
    "documentation before responding. Base your answer on what the tools return, "
    "summarize clearly, and include the source doc links the tools provide. "
    "If the tools return nothing relevant, say so plainly instead of guessing."
)


def _require_config() -> None:
    if not settings.foundry_project_endpoint:
        raise ValueError("FOUNDRY_PROJECT_ENDPOINT is not set in backend/.env.")
    if not settings.mcp_server_url:
        raise ValueError("MCP_SERVER_URL is not set in backend/.env.")


def _build_mcp_tool() -> MCPStreamableHTTPTool:
    """
    A live connection to the remote MCP server over Streamable HTTP.

    The returned object is an async context manager — entering it opens the
    session and auto-discovers the server's tools; leaving it tears the session
    down. We never list the tools by hand: whatever the server advertises
    becomes available to the agent.
    """
    return MCPStreamableHTTPTool(
        name=settings.mcp_server_label,
        url=settings.mcp_server_url,
        load_tools=True,
        load_prompts=False,
        request_timeout=60,
    )


def _build_agent(model: str, system_prompt: str, mcp_tool: MCPStreamableHTTPTool) -> Agent:
    client = FoundryChatClient(
        project_endpoint=settings.foundry_project_endpoint,
        model=model,
        credential=DefaultAzureCredential(),
    )

    return Agent(
        client=client,
        name="MCPToolCallingAgent",
        instructions=system_prompt,
        tools=[mcp_tool],
    )


def _iter_tool_calls(chunk: Any):
    """
    Yield (name, arguments) for any MCP/function tool-call started in this
    streamed update. Streamed contents carry a `type` discriminator — we look
    for the call-start contents and read the tool name off them.
    """
    for content in getattr(chunk, "contents", None) or []:
        ctype = getattr(content, "type", "")
        if ctype in ("function_call", "mcp_server_tool_call"):
            name = getattr(content, "name", None)
            if name:
                yield name, getattr(content, "arguments", None)


async def stream(
    message: str, model: str, system_prompt: str | None = None
) -> AsyncGenerator:
    """
    Stream the grounded answer. Yields:
      - dict {"tool_call": name, "arguments": ...} when the agent invokes an MCP tool
      - str  for each answer token
      - dict {"tools_used": [...], "server": label} once, at the end
    The route turns these into SSE events.
    """
    _require_config()

    seen: set[str] = set()

    # The MCP session must stay open for the whole agent run, so the streamed
    # answer is produced *inside* the `async with` block.
    async with _build_mcp_tool() as mcp_tool:
        agent = _build_agent(model, system_prompt or _SYSTEM_PROMPT, mcp_tool)

        async for chunk in agent.run(message, stream=True):
            for name, arguments in _iter_tool_calls(chunk):
                if name not in seen:
                    seen.add(name)
                    yield {"tool_call": name, "arguments": arguments}
            if chunk.text:
                yield chunk.text

    yield {"tools_used": sorted(seen), "server": settings.mcp_server_label}
