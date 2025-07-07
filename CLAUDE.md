# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vulcan is a PDF rendering service built with Deno and Express. It provides an HTTP API that accepts base64-encoded HTML and returns PDF files generated using Puppeteer.

## Development Commands

- **Start development server**: `deno task dev` (runs with --watch flag)
- **Run directly**: `deno run src/index.ts`

## Architecture

### Core Components

- **src/index.ts**: Main application entry point
  - Express server setup with JSON middleware
  - PDF generation endpoint at POST `/pdf`
  - Accepts `PDFRequest` with base64-encoded HTML
  - Returns PDF as attachment with random UUID filename

- **src/puppeteer.ts**: PDF rendering logic
  - `renderPDF(html: string)` function handles PDF generation
  - Creates temporary HTML files in `/tmp/` directory
  - Uses Puppeteer with specific Chrome flags for PDF rendering
  - Configured with 10mm margins and background printing enabled

### Configuration

- **Environment Variables**:
  - `BASE_URL`: API base URL (default: "api.example.com/v1")
  - `PORT`: HTTP server port (default: 5739)
  - `STORAGE_DIR`: Directory for storing PDFs when download=false (default: "/tmp/vulcan-pdfs")
  - `STORAGE_BASE_URL`: Base URL for serving stored PDFs (default: "http://localhost:{PORT}/files")

- **Dependencies** (deno.json):
  - Express.js for HTTP server
  - Puppeteer for PDF generation
  - Standard Deno assertions for testing

### PDF Generation Details

The service creates PDFs with:
- 10mm margins on all sides
- Background printing enabled
- Chrome launched with security flags disabled for local file access
- Temporary HTML files stored in `/tmp/` with UUID filenames

### API Endpoints

**POST `/pdf`**
- Request body: `{ html: string, options?: PDFRouteOptions }`
- HTML must be base64 encoded
- Options:
  - `download?: boolean` - If true (default), serves PDF as download; if false, stores PDF and returns download link
- Response:
  - If `download=true`: Returns PDF file as attachment
  - If `download=false`: Returns JSON with `{ success: true, filename, downloadUrl, message }`
- Error handling for missing/invalid HTML

**GET `/files/:filename`**
- Serves stored PDF files from the configured storage directory
- Returns 404 if file not found

## Development Notes

- Uses Deno with npm imports for Node.js packages
- Express router pattern for API endpoints
- Puppeteer configured for server environments with sandbox disabled
- UUID-based temporary file naming for concurrent requests
- Automatic storage directory creation on startup
- Temporary HTML files are cleaned up after PDF generation
- File storage mode allows separation of PDF generation from serving