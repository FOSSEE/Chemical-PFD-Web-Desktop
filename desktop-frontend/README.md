# Chemical PFD Desktop Frontend

[![Python](https://img.shields.io/badge/python-3.x-blue.svg)](https://www.python.org/)
[![PyQt5](https://img.shields.io/badge/PyQt-5.x-green.svg)](https://riverbankcomputing.com/software/pyqt/intro)

<div align="center">

Desktop application for creating, editing, exporting, and managing Chemical Process Flow Diagrams with a native PyQt5 interface.

</div>

## Table of Contents
- [Overview](#overview)
- [What This Module Does](#what-this-module-does)
- [Project Structure](#project-structure)
- [Dependencies and Setup](#dependencies-and-setup)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Expected Results](#expected-results)
- [Notes and Limitations](#notes-and-limitations)

## Overview

The desktop frontend is the native **PyQt5** client for the Chemical PFD system. It provides the working canvas, component library, routing tools, export support, and desktop-specific UI flows for users who need a richer local application than the web interface.

## What This Module Does

The desktop frontend is responsible for:

- launching the native application entry point
- showing the landing and navigation screens
- rendering the PFD canvas and diagram elements
- handling component selection, placement, and connection routing
- loading and managing API-backed project data
- exporting diagrams to image and PDF formats
- generating report PDFs for diagram-related output
- applying the desktop UI theme, dialogs, and helper widgets

## Project Structure

```text
desktop-frontend/
├── main.py                  # Desktop application entry point
├── src/                     # Core application code
│   ├── api_client.py        # Backend API integration
│   ├── canvas_screen.py     # Canvas UI and export actions
│   ├── component_library.py # Component palette and browsing
│   ├── component_widget.py  # Component widget behavior
│   ├── auto_router.py       # Connection routing logic
│   ├── landing_page.py      # Landing screen
│   ├── screens.py           # Screen definitions and navigation
│   └── theme_manager.py     # Theme handling
├── ui/                      # Qt Designer forms and assets
├── tests/                   # Desktop runtime tests
└── desktop-frontend-UnitTests/ # Module-level unit tests
```

## Dependencies and Setup

### Required Environment

- Python 3.x
- A virtual environment is recommended
- Backend API available and configured if you want to run the full app workflow

### Python Dependencies

Install the packages listed in [requirements.txt](requirements.txt):

- PyQt5
- requests
- pandas
- openpyxl
- PyMuPDF
- xlsxwriter
- reportlab

### Setup Steps

From the repository root:

```bash
cd desktop-frontend
python -m venv env
```

Activate the environment:

```bash
source env/bin/activate
```

On Windows, use:

```bash
env\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

## Running the Application

Before starting the desktop app, make sure the backend service is running if your workflow needs API access.

Start the desktop frontend:

```bash
python main.py
```

## Testing

The desktop frontend includes module-level unit tests under [desktop-frontend-UnitTests](desktop-frontend-UnitTests/README.md).

### Implemented Test Cases

The current export test module, [test_export.py](desktop-frontend-UnitTests/test_export.py), covers:

- export metadata extraction
- fallback handling for missing project/user data
- date formatting in export footers
- title block drawing behavior
- composed export image generation with footer space
- JPG/PNG image export
- PDF export
- report PDF metadata handling

### How to Run the Tests

From the repository root:

```bash
cd desktop-frontend
python -m unittest desktop-frontend-UnitTests.test_export -v
```

To run the full desktop unit test package:

```bash
python -m unittest discover -s desktop-frontend-UnitTests -p "test_*.py" -v
```

If you prefer the folder-level README, see [desktop-frontend-UnitTests/README.md](desktop-frontend-UnitTests/README.md) for the full test list and commands.

## Notes and Limitations

- The export tests are mock-based, so they do not require an active Qt display or manual GUI interaction.
- Some tests rely on application state helpers such as the current user and current project name.
- Report and export behavior may differ slightly depending on backend data availability and the logged-in user.
- The desktop application expects the backend to be running for features that fetch or save live project data.
- The unit tests verify the export pipeline and metadata handling, not visual pixel-perfect rendering.

## Development Notes

- UI forms in [ui/](ui/) can be edited with Qt Designer.
- Keep new desktop features documented here if they affect setup, testing, export behavior, or runtime dependencies.
