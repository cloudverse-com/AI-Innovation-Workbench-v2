"""
Document Processor Service
===========================
Handles two processing modes for uploaded files (used in Demo 01):

MODE 1 — TEXT EXTRACTION (Docling):
    PDF → Docling → Markdown text → inject into the chat prompt
    Best for: text-heavy documents, reports, contracts, papers

MODE 2 — VISION (GPT-4.1 Vision):
    PDF → render each page as PNG → base64 encode → send as image messages
    Best for: diagrams, charts, scanned documents, mixed media

Supported file types: PDF, JPG, JPEG, PNG
"""

# Step 1: Import standard library modules
import base64
import io
import os
import tempfile
from pathlib import Path
from typing import List

# Step 2: Import image processing library
from PIL import Image

# Step 3: Azure AI Inference message types for vision
from azure.ai.inference.models import (
    ImageContentItem,
    ImageUrl,
    TextContentItem,
    UserMessage,
)


# ─────────────────────────────────────────────────────────────────────────────
# TEXT EXTRACTION MODE (Docling)
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes, filename: str) -> str:
    """
    Step 4: Use Docling to convert a PDF to clean Markdown text.

    Docling is an open-source document processing library that understands
    document structure (headings, tables, lists) and converts PDFs to
    well-formatted Markdown that LLMs can easily read and reason about.

    Returns the extracted Markdown text as a string.
    """
    try:
        # Step 4a: Import Docling (only needed for PDF text extraction)
        from docling.document_converter import DocumentConverter

        # Step 4b: Write the file bytes to a temporary file
        # Docling needs a file path, not raw bytes
        with tempfile.NamedTemporaryFile(
            suffix=".pdf", delete=False, prefix="workbench_"
        ) as tmp_file:
            tmp_file.write(file_bytes)
            tmp_file_path = tmp_file.name

        try:
            # Step 4c: Create the Docling converter and process the document
            converter = DocumentConverter()
            result = converter.convert(tmp_file_path)

            # Step 4d: Export the result as Markdown
            # Docling preserves headings, tables, lists, and code blocks
            markdown_text = result.document.export_to_markdown()

            return markdown_text

        finally:
            # Step 4e: Always clean up the temporary file
            os.unlink(tmp_file_path)

    except ImportError:
        # Step 4f: Graceful fallback if Docling is not installed
        return (
            f"[Note: Docling is not installed. Install with: pip install docling]\n\n"
            f"File: {filename} ({len(file_bytes):,} bytes)\n"
            f"Could not extract text without Docling."
        )
    except Exception as e:
        return f"[Error extracting text from {filename}: {str(e)}]"


def extract_text_from_image(file_bytes: bytes, filename: str) -> str:
    """
    Step 5: Extract text description from an image file (JPG, PNG).

    For images in TEXT EXTRACTION mode, we return a placeholder message
    telling the LLM that an image was attached. Vision mode handles
    actual image understanding.
    """
    # Get image dimensions for context
    try:
        img = Image.open(io.BytesIO(file_bytes))
        width, height = img.size
        format_name = img.format or "unknown"
        return (
            f"[Image attached: {filename}, {width}x{height} pixels, {format_name} format. "
            f"Switch to Vision mode to analyze image content.]"
        )
    except Exception:
        return f"[Image attached: {filename}, {len(file_bytes):,} bytes]"


# ─────────────────────────────────────────────────────────────────────────────
# VISION MODE — PDF Page Rendering
# ─────────────────────────────────────────────────────────────────────────────

def pdf_to_image_messages(
    file_bytes: bytes,
    filename: str,
    user_message: str,
    max_pages: int = 5,
) -> UserMessage:
    """
    Step 6: Convert a PDF to a vision-enabled UserMessage.

    Each page of the PDF is rendered as a PNG image, base64-encoded,
    and included as an ImageContentItem. GPT-4.1 Vision can then
    analyze the visual layout, diagrams, charts, and text together.

    max_pages: limit pages to avoid exceeding token limits
    """
    # Step 6a: Try to use pdf2image for PDF rendering
    try:
        from pdf2image import convert_from_bytes

        # Step 6b: Render PDF pages as PIL Image objects
        pil_images = convert_from_bytes(
            file_bytes,
            dpi=150,          # 150 DPI balances quality vs token usage
            first_page=1,
            last_page=max_pages,
        )

        # Step 6c: Build the content items list for the UserMessage
        content_items = []

        # Step 6d: Add a text header describing what we're sending
        content_items.append(
            TextContentItem(
                text=f"I'm sharing {len(pil_images)} page(s) from '{filename}'. "
                     f"{user_message}"
            )
        )

        # Step 6e: Convert each page to base64 PNG and add as ImageContentItem
        for page_num, pil_image in enumerate(pil_images, start=1):
            # Convert PIL image to PNG bytes
            png_buffer = io.BytesIO()
            pil_image.save(png_buffer, format="PNG", optimize=True)
            png_bytes = png_buffer.getvalue()

            # Encode to base64 data URL
            b64_encoded = base64.b64encode(png_bytes).decode("utf-8")
            data_url = f"data:image/png;base64,{b64_encoded}"

            # Add label and image
            content_items.append(
                TextContentItem(text=f"Page {page_num}:")
            )
            content_items.append(
                ImageContentItem(image_url=ImageUrl(url=data_url))
            )

        return UserMessage(content=content_items)

    except ImportError:
        # Step 6f: Fallback if pdf2image is not available
        return UserMessage(
            content=f"[Vision mode requires pdf2image. "
                    f"Install with: pip install pdf2image]\n\n{user_message}"
        )
    except Exception as e:
        return UserMessage(
            content=f"[Error rendering PDF pages: {str(e)}]\n\n{user_message}"
        )


def image_to_vision_message(
    file_bytes: bytes,
    filename: str,
    user_message: str,
) -> UserMessage:
    """
    Step 7: Convert a JPG/PNG image to a vision-enabled UserMessage.

    The image is base64-encoded and included as an ImageContentItem.
    GPT-4.1 Vision will analyze the image along with the user's text question.
    """
    # Step 7a: Determine the MIME type from the file extension
    ext = Path(filename).suffix.lower()
    mime_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    mime_type = mime_type_map.get(ext, "image/jpeg")

    # Step 7b: Base64-encode the image bytes
    b64_encoded = base64.b64encode(file_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_encoded}"

    # Step 7c: Build the UserMessage with both text and image content
    return UserMessage(
        content=[
            TextContentItem(text=user_message),
            ImageContentItem(image_url=ImageUrl(url=data_url)),
        ]
    )


# ─────────────────────────────────────────────────────────────────────────────
# Unified Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def process_uploaded_file(
    file_bytes: bytes,
    filename: str,
    processing_mode: str,   # "text" or "vision"
    user_message: str = "",
) -> dict:
    """
    Step 8: Unified file processing entry point called by Demo 01.

    Returns a dict with:
        mode: "text" or "vision"
        text_content: extracted text (text mode only)
        vision_message: UserMessage with images (vision mode only)
        error: error message if processing failed
    """
    ext = Path(filename).suffix.lower()
    is_pdf = ext == ".pdf"
    is_image = ext in (".jpg", ".jpeg", ".png", ".gif", ".webp")

    # Step 8a: Text extraction mode
    if processing_mode == "text":
        if is_pdf:
            text = extract_text_from_pdf(file_bytes, filename)
        elif is_image:
            text = extract_text_from_image(file_bytes, filename)
        else:
            text = f"[Unsupported file type: {ext}]"

        return {
            "mode": "text",
            "text_content": text,
            "vision_message": None,
            "error": None,
        }

    # Step 8b: Vision mode
    elif processing_mode == "vision":
        if is_pdf:
            vision_msg = pdf_to_image_messages(file_bytes, filename, user_message)
        elif is_image:
            vision_msg = image_to_vision_message(file_bytes, filename, user_message)
        else:
            return {
                "mode": "vision",
                "text_content": None,
                "vision_message": None,
                "error": f"Vision mode does not support {ext} files",
            }

        return {
            "mode": "vision",
            "text_content": None,
            "vision_message": vision_msg,
            "error": None,
        }

    else:
        return {
            "mode": processing_mode,
            "text_content": None,
            "vision_message": None,
            "error": f"Unknown processing mode: {processing_mode}",
        }
