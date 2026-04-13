---
description:  Generate pytest unit tests for a given Python module
---


## Steps

### 1. Ask which module to test
- Ask: "Which module should I generate tests for?"

### 2. Read the module
- Read all functions and their signatures from the target module

### 3. Generate tests
- Create at least 3 tests per function
- Use clear test names: test_{function_name}_{scenario}
- Include: happy path, edge case (empty input), error case

### 4. Run the tests
// turbo
- Run: pytest tests/test_{module_name}.py -v
- Report which tests pass or fail