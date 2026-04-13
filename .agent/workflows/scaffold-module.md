---
description: Scaffold a new Python module with boilerplate (docstring, imports, logger, type hints)
---


## Steps

### 1. Ask for module name and purpose
- Ask the user: "What is the module name and what does it do?"

### 2. Create the module file
- Create the file in the correct folder based on the module type (scraper/, nlp/, recommender/, database/)
- Add module-level docstring with: purpose, author placeholder, date
- Add standard imports: logging, typing, os
- Add a logger: `logger = logging.getLogger(__name__)`
- Add a placeholder function with type hints and docstring

### 3. Create the matching test file
- Create tests/test_{module_name}.py
- Add one placeholder test that imports the module and asserts True