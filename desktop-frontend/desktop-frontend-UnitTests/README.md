# Desktop Frontend Unit Tests

This folder contains the module-level unit tests for the desktop frontend. The tests focus on core behavior that can be validated without manual GUI interaction, including routing, validation, component behavior, API client logic, and export/report metadata handling.

## What This Module Tests

The test suite exists to verify that the desktop frontend:

- validates graph and canvas rules correctly
- formats labels and metadata consistently
- routes connections properly
- keeps component widget and library behavior stable
- loads canvas resources correctly
- communicates with the API client as expected
- renders export metadata and report footer data correctly

## Implemented Test Cases

Current test modules in this folder include:

- `test_validation.py`: graph validation behavior
- `test_label_generation.py`: label formatting and metadata loading
- `test_routing.py`: connection and pathfinding behavior
- `test_component_widget.py`: component widget behavior
- `test_component_library.py`: component library behavior
- `test_component_resize.py`: component resizing and dimension logic
- `test_canvas_resources.py`: canvas resource utility behavior
- `test_api_client.py`: API client behavior
- `test_export.py`: export metadata, image/PDF export, and report footer behavior

## Dependencies and Setup

Before running tests, make sure:

- Python 3.x is installed
- the desktop frontend virtual environment is activated
- packages from [../requirements.txt](../requirements.txt) are installed

Recommended setup from the repository root:

```bash
cd desktop-frontend
python -m venv env
source env/bin/activate
pip install -r requirements.txt
```

On Windows, activate with:

```bash
env\Scripts\activate
```

## How to Run the Tests

### Run the full test folder

From the repository root:

```bash
cd desktop-frontend
python -m unittest discover -s desktop-frontend-UnitTests -p "test_*.py" -v
```

### Run the export test module only

```bash
python -m unittest desktop-frontend-UnitTests.test_export -v
```

### Run a single test file

```bash
python -m unittest desktop-frontend-UnitTests.test_validation -v
```

## Expected Results

Successful runs should finish without failures and print `OK` at the end.

For the full test suite, the expected result is:

- over 50 tests executed (currently 58)
- all assertions passing
- output similar to `Ran 58 tests in ...` followed by `OK`

## Notes and Limitations

- Several tests use mocking so they can run in headless environments without a visible Qt window.
- Some tests depend on local application state or mocked backend responses.
- The export tests verify composition and metadata handling, not pixel-perfect rendering.
- If a test touches API-facing code, the backend may need to be configured for the surrounding workflow even if the test itself is isolated.

## Maintenance Notes

- Add new test modules here whenever desktop frontend behavior is covered by unit tests.
- Update both this README and the main [desktop-frontend/README.md](../README.md) when new runtime dependencies or test workflows are introduced.
