import ast
from pathlib import Path


def test_inner_layers_do_not_depend_on_http_or_database_adapters():
    for layer in ("domain", "application"):
        for path in Path("app", layer).rglob("*.py"):
            tree = ast.parse(path.read_text())
            imports = []
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom):
                    imports.append(node.module or "")
                elif isinstance(node, ast.Import):
                    imports.extend(alias.name for alias in node.names)
            for module in imports:
                assert not module.startswith((
                    "app.api", "app.infrastructure", "app.core", "fastapi",
                    "pymongo", "bson", "jwt", "pwdlib", "pydantic",
                )), (path, module)
                if layer == "domain":
                    assert not module.startswith("app.application"), (path, module)
