Agent working notes for NovaEuropa4

Style and i18n rules (project-wide):

- Do not use Unicode escape sequences in code or UI strings (for example, avoid sequences like \u00e7, \u00f3, etc.). Always use real UTF‑8 characters directly (ç, ó, ã, ê, …).
- When editing text, ensure files are saved as UTF‑8. Prefer UTF‑8 without BOM unless the toolchain requires otherwise.
- If you encounter mojibake (garbled characters such as "Ã" or "�"), normalize the text to the intended Portuguese with proper accents.
- Keep labels and messages in clear Brazilian Portuguese where appropriate.

These rules apply across the entire repository unless the user explicitly requests otherwise.

