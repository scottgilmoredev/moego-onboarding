"""
Fetches GitHub release notes, converts them to Keep a Changelog format via
Haiku, and writes the result into CHANGELOG.md under a new versioned entry.

Invoked by .github/workflows/changelog.yml on every published release. Reads
the release body from the GitHub Actions event payload, calls the Anthropic
API, and performs an in-place update of CHANGELOG.md.

Required environment variables:
    ANTHROPIC_API_KEY   Anthropic API key with access to claude-haiku-4-5
    VERSION             The release tag name, e.g. v1.1.0
    GITHUB_EVENT_PATH   Path to the GitHub Actions event JSON payload (set automatically by Actions)
"""

import json
import os
import re
import sys
import urllib.request
from datetime import date


def call_haiku(api_key: str, release_body: str) -> str:
    """Call Haiku to convert Release Drafter output to Keep a Changelog entries.

    Args:
        api_key: Anthropic API key.
        release_body: Raw release notes body from the GitHub release event.

    Returns:
        Markdown string containing only the changelog section content
        (e.g. "### Added\\n- ..."), with no version header or preamble.

    Raises:
        urllib.error.HTTPError: If the Anthropic API returns a non-2xx response.
        KeyError: If the response payload is missing the expected content field.
    """
    prompt = f"""You are updating a CHANGELOG.md that follows Keep a Changelog format (https://keepachangelog.com).

Convert the following GitHub release notes into changelog entries.

Rules:
- Group entries under these sections only: Added, Changed, Deprecated, Removed, Fixed, Security
- Map release note categories: Features -> Added, Bug Fixes -> Fixed, Refactoring/Performance -> Changed
- Omit entries that are purely internal and not user-facing: tests, CI/CD, style, maintenance, documentation
- Write each entry as one concise line from the user's perspective, not as implementation details
- Preserve PR numbers where present, e.g. (#127)
- Omit any section that has no entries
- Output ONLY the markdown section content (e.g. ### Added\\n- ...) with no version header, no preamble, and no trailing commentary

Release notes:
{release_body}"""

    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )

    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())

    return result["content"][0]["text"].strip()


def update_changelog(version: str, entries: str) -> None:
    """Insert a new versioned entry into CHANGELOG.md.

    Locates the [Unreleased] section, clears its content, and inserts the new
    versioned entry between [Unreleased] and the previous release. The
    [Unreleased] header is preserved empty for the next release cycle.

    Args:
        version: The release tag name, e.g. v1.1.0.
        entries: Markdown changelog entries produced by call_haiku.
    """
    today = date.today().isoformat()
    new_section = f"## [{version}] - {today}\n\n{entries}"

    with open("CHANGELOG.md", "r") as f:
        changelog = f.read()

    # Match from [Unreleased] through the first --- separator so the section
    # content is cleared and the new versioned entry is inserted in its place.
    updated = re.sub(
        r"(## \[Unreleased\]).*?(---)",
        f"\\1\n\n---\n\n{new_section}\n\n\\2",
        changelog,
        count=1,
        flags=re.DOTALL,
    )

    with open("CHANGELOG.md", "w") as f:
        f.write(updated)


def main() -> None:
    """Entry point. Reads environment, calls Haiku, and updates CHANGELOG.md."""
    api_key = os.environ["ANTHROPIC_API_KEY"]
    version = os.environ["VERSION"]

    # GITHUB_EVENT_PATH is set automatically by Actions and points to the full
    # event payload — the release body is read from here to avoid shell escaping
    # issues that arise when passing multi-line strings through env vars.
    with open(os.environ["GITHUB_EVENT_PATH"]) as f:
        release_body = json.load(f)["release"]["body"]

    try:
        entries = call_haiku(api_key, release_body)
    except Exception as e:
        print(f"Haiku API call failed: {e}", file=sys.stderr)
        sys.exit(1)

    update_changelog(version, entries)
    print(f"CHANGELOG.md updated for {version}")


if __name__ == "__main__":
    main()
