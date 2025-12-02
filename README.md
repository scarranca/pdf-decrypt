## PDF Unlocker API

**PDF Unlocker** is a tiny, production-friendly HTTP service for:

- **Decrypting password‑protected PDFs** using `qpdf`
- **Extracting PDFs from ZIP archives**

It’s designed to be:

- **Simple**: a couple of JSON POST endpoints
- **Stateless**: no database, no file persistence
- **Container‑ready**: ships with a `Dockerfile` and minimal dependencies

---

## Features

- **`/unlock`**: Decrypt a single password‑protected PDF.
- **`/extract-pdfs`**: Take a ZIP (base64), extract only PDFs, and return them.
- **Binary or base64 responses**: Control output format via a single `returnBase64` flag.
- **Small surface area**: Just Express + `qpdf` + `adm-zip`.

---

## Requirements

- **Node.js** 18+ (recommended)
- **qpdf** installed on the system (required for `/unlock`)
  - macOS (Homebrew): `brew install qpdf`
  - Linux (Debian/Ubuntu): `sudo apt-get update && sudo apt-get install -y qpdf`

---

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url> pdf-unlocker
cd pdf-unlocker
npm install
```

### 2. Ensure `qpdf` is installed

```bash
qpdf --version
```

If this fails, install `qpdf` using your OS package manager (see **Requirements**).

### 3. Run the server

```bash
npm start
```

By default the service listens on **port `3000`** (or `process.env.PORT` if set).

Health check:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

---

## API Reference

### `GET /health`

- **Description**: Basic health check.
- **Response**:
  - `200 OK`
    - JSON: `{ "status": "ok" }`

---

### `POST /unlock`

**Decrypt a password‑protected PDF.**

- **Content-Type**: `application/json`

#### Request body

```json
{
  "password": "your-pdf-password",
  "fileBase64": "<base64-encoded-pdf>",
  "returnBase64": true
}
```

- **`password`** (string, required): The PDF password.
- **`fileBase64`** (string, required): The **entire PDF file encoded as base64**.
- **`returnBase64`** (boolean, optional):
  - `false` or omitted → **binary PDF download**.
  - `true` → JSON with a base64 string.

#### Successful responses

- **If `returnBase64` is falsy/omitted**
  - `200 OK`
  - **Headers**:
    - `Content-Type: application/pdf`
    - `Content-Disposition: attachment; filename=unlocked.pdf`
  - **Body**: binary PDF.

- **If `returnBase64` is `true`**
  - `200 OK`
  - **Body**:
    ```json
    {
      "success": true,
      "fileBase64": "<base64-of-decrypted-pdf>"
    }
    ```

#### Error responses

- `400 Bad Request` – Missing input:
  ```json
  { "error": "Missing 'password' or 'fileBase64' in body" }
  ```
- `500 Internal Server Error` – Decryption failed or `qpdf` error:
  ```json
  {
    "error": "Failed to decrypt PDF",
    "details": "qpdf error output..."
  }
  ```
- `500 Internal Server Error` – Unexpected:
  ```json
  {
    "error": "Unexpected server error",
    "details": "..."
  }
  ```

#### Example: using `curl` with returnBase64

```bash
PDF_B64=$(base64 -i locked.pdf | tr -d '\n')

curl -X POST http://localhost:3000/unlock \
  -H "Content-Type: application/json" \
  -d "{
    \"password\": \"your-pdf-password\",
    \"fileBase64\": \"${PDF_B64}\",
    \"returnBase64\": true
  }"
```

---

### `POST /extract-pdfs`

**Extract PDFs from a ZIP archive and return only PDF files.**

- **Content-Type**: `application/json`

#### Request body

```json
{
  "zipBase64": "<base64-encoded-zip>",
  "returnBase64": true
}
```

- **`zipBase64`** (string, required): The ZIP file encoded as base64.
- **`returnBase64`** (boolean, optional):
  - `false` or omitted → returns **one PDF as binary** (the first PDF found).
  - `true` → returns **all PDFs as base64** in JSON.

#### Successful responses

- **If `returnBase64` is falsy/omitted**
  - `200 OK`
  - **Headers**:
    - `Content-Type: application/pdf`
    - `Content-Disposition: attachment; filename=<first-pdf-name>.pdf`
  - **Body**: binary for the first PDF found inside the ZIP.

- **If `returnBase64` is `true`**
  - `200 OK`
  - **Body**:
    ```json
    {
      "success": true,
      "files": [
        {
          "filename": "document1.pdf",
          "fileBase64": "<base64-of-document1>"
        },
        {
          "filename": "document2.pdf",
          "fileBase64": "<base64-of-document2>"
        }
      ]
    }
    ```

#### Error responses

- `400 Bad Request` – Missing input:
  ```json
  { "error": "Missing 'zipBase64' in body" }
  ```
- `404 Not Found` – ZIP contains no PDFs:
  ```json
  { "error": "No PDF files found in ZIP" }
  ```
- `500 Internal Server Error` – Extraction failure or invalid ZIP:
  ```json
  {
    "error": "Failed to extract PDFs from ZIP",
    "details": "..."
  }
  ```

#### Example: extracting PDFs from a ZIP

```bash
ZIP_B64=$(base64 -i documents.zip | tr -d '\n')

curl -X POST http://localhost:3000/extract-pdfs \
  -H "Content-Type: application/json" \
  -d "{
    \"zipBase64\": \"${ZIP_B64}\",
    \"returnBase64\": true
  }"
```

---

## Docker

This repo includes a `Dockerfile` so you can run the service in a container.

### Build the image

```bash
docker build -t pdf-unlocker .
```

### Run the container

```bash
docker run --rm -p 3000:3000 pdf-unlocker
```

If your base image doesn’t already include `qpdf`, make sure the `Dockerfile` installs it. Once running, use the same endpoints:

- `GET http://localhost:3000/health`
- `POST http://localhost:3000/unlock`
- `POST http://localhost:3000/extract-pdfs`

---

## Implementation Overview

The core logic lives in `server.js`:

- Uses **Express** with JSON body parsing (50 MB limit by default).
- Writes the incoming PDF to a temporary file, runs `qpdf --decrypt`, then streams the result back.
- Uses **`adm-zip`** to inspect ZIP entries in memory and filter out only `.pdf` files.
- Cleans up temporary files after decryption.

This keeps the service small and easy to reason about while still being powerful enough for real‑world automation pipelines.

---

## Use Cases

- **Automated document pipelines**:
  - Unlock and normalize incoming password‑protected PDFs before feeding them into OCR, parsing, or ML systems.
- **Bulk ZIP ingestion**:
  - Upload ZIPs of mixed file types, extract only PDFs for downstream processing.
- **Integrations**:
  - Use from other services (Node, Python, Go, etc.) as a simple HTTP microservice.

---

## Contributing / Ideas

If you have ideas to improve this service, here are some natural next steps:

- Add **rate limiting** or authentication for public deployments.
- Support **streaming uploads** for very large PDFs/ZIPs.
- Add optional **per‑file status** when extracting PDFs from ZIPs.

Feel free to open issues or pull requests in the repository.

---

## Author

Built and maintained by **Santiago Carranca**.

If you’re interested in using this in production or integrating it into your workflow, feel free to reach out or open a GitHub issue. This project is intentionally small, clear, and production‑oriented so you can quickly understand the code and build on top of it.
