"""
Configuration Module
====================
Loads all environment variables from the .env file and exposes them
as a typed settings object. Also parses the SYSTEM_PROMPTS and
AVAILABLE_MODELS formats used in this project.

SYSTEM_PROMPTS format:  "Name::prompt text||Name2::prompt text2"
AVAILABLE_MODELS format: "gpt-4.1,gpt-4.1-mini,gpt-4.1-nano"
"""

# Step 1: Import standard library and third-party modules
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict

# Step 2: Load the .env file before accessing environment variables
# Use an explicit path relative to this config.py file so it works
# regardless of which directory uvicorn / the debugger is launched from.
from dotenv import load_dotenv
_ENV_FILE = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV_FILE, override=True)


# Step 3: Define a typed dataclass to hold all configuration values
@dataclass
class Settings:
    # --- Azure AI Foundry connection ---
    # The full project endpoint URL from your Azure AI Foundry project
    foundry_project_endpoint: str = field(
        default_factory=lambda: os.getenv("FOUNDRY_PROJECT_ENDPOINT", "")
    )

    # The API key for authenticating with Azure AI Foundry (AzureKeyCredential)
    foundry_api_key: str = field(
        default_factory=lambda: os.getenv("FOUNDRY_API_KEY", "")
    )

    # The name of the hosted agent to use in Demo 02
    foundry_agent_name: str = field(
        default_factory=lambda: os.getenv("FOUNDRY_AGENT_NAME", "")
    )

    # --- Model configuration ---
    # The default model to use when none is specified by the frontend
    default_model: str = field(
        default_factory=lambda: os.getenv("DEFAULT_MODEL", "gpt-4.1")
    )

    # Raw comma-separated model list string from .env
    # e.g. "gpt-4.1,gpt-4.1-mini,gpt-4.1-nano"
    _available_models_raw: str = field(
        default_factory=lambda: os.getenv("AVAILABLE_MODELS", "gpt-4.1")
    )

    # --- System prompts ---
    # Raw string with format: "Name::prompt||Name2::prompt2"
    _system_prompts_raw: str = field(
        default_factory=lambda: os.getenv(
            "SYSTEM_PROMPTS",
            "General Assistant::You are a helpful assistant.||"
            "Technical Expert::You are a technical expert who explains things clearly.||"
            "Code Reviewer::You review code for best practices and suggest improvements."
        )
    )

    # --- Azure Content Understanding (Demo 06) ---
    # Base endpoint of the Azure AI resource (without /api/projects/...)
    # e.g. https://cv-foundry-eastus2.services.ai.azure.com/
    content_understanding_endpoint: str = field(
        default_factory=lambda: os.getenv("CONTENT_UNDERSTANDING_ENDPOINT", "")
    )

    # The analyzer ID created in your Content Understanding resource
    content_understanding_analyzer_id: str = field(
        default_factory=lambda: os.getenv("CONTENT_UNDERSTANDING_ANALYZER_ID", "patient_medical_report")
    )

    # --- Contract Comparison (Demo 07) ---
    # Azure Content Understanding endpoint and credentials for contract analysis
    contract_cu_base_url: str = field(
        default_factory=lambda: os.getenv("CONTRACT_CU_BASE_URL", "")
    )
    contract_cu_subscription_key: str = field(
        default_factory=lambda: os.getenv("CONTRACT_CU_SUBSCRIPTION_KEY", "")
    )
    contract_cu_api_version: str = field(
        default_factory=lambda: os.getenv("CONTRACT_CU_API_VERSION", "2025-05-01-preview")
    )
    # Azure Blob Storage for uploading contract files before analysis
    contract_blob_connection_string: str = field(
        default_factory=lambda: os.getenv("CONTRACT_BLOB_CONNECTION_STRING", "")
    )
    contract_blob_container_name: str = field(
        default_factory=lambda: os.getenv("CONTRACT_BLOB_CONTAINER_NAME", "cu-files")
    )
    contract_blob_sas_expiration_hours: int = field(
        default_factory=lambda: int(os.getenv("CONTRACT_BLOB_SAS_EXPIRATION_HOURS", "24"))
    )

    # --- Security ---
    # The API key that the frontend must send in the X-API-Key header
    demo_api_key: str = field(
        default_factory=lambda: os.getenv("DEMO_API_KEY", "demo-key-12345")
    )

    # --- Server ---
    port: int = field(
        default_factory=lambda: int(os.getenv("PORT", "8000"))
    )

    # Step 4: Parsed versions of the raw strings (populated in __post_init__)
    available_models: List[str] = field(default_factory=list)
    system_prompts: List[Dict[str, str]] = field(default_factory=list)

    def __post_init__(self):
        """
        Step 5: Parse the raw string formats into usable Python data structures.
        This runs automatically after the dataclass is initialized.
        """
        # Parse AVAILABLE_MODELS: split on commas, strip whitespace
        # Input:  "gpt-4.1,gpt-4.1-mini,gpt-4.1-nano"
        # Output: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"]
        self.available_models = [
            model.strip()
            for model in self._available_models_raw.split(",")
            if model.strip()
        ]

        # Parse SYSTEM_PROMPTS: split on "||" to get each entry,
        # then split each entry on "::" to get name and prompt text
        # Input:  "General Assistant::You are helpful.||Code Reviewer::You review code."
        # Output: [{"name": "General Assistant", "prompt": "You are helpful."}, ...]
        self.system_prompts = []
        for entry in self._system_prompts_raw.split("||"):
            entry = entry.strip()
            if "::" in entry:
                name, prompt = entry.split("::", 1)  # Split on first "::" only
                self.system_prompts.append({
                    "name": name.strip(),
                    "prompt": prompt.strip()
                })

    def validate(self) -> List[str]:
        """
        Step 6: Validate that required configuration is present.
        Returns a list of error messages (empty list = all good).
        """
        errors = []

        if not self.foundry_project_endpoint:
            errors.append("FOUNDRY_PROJECT_ENDPOINT is not set in .env")

        if not self.foundry_api_key:
            errors.append("FOUNDRY_API_KEY is not set in .env")

        if not self.available_models:
            errors.append("AVAILABLE_MODELS is not set or empty in .env")

        return errors


# Step 7: Create the single global settings instance
# Import this object in all other modules: from backend.config import settings
settings = Settings()
