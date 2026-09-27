"""A state module published under another name (__virtualname__), for the
function-check tests (#64)."""
__virtualname__ = "vault_ext"


def __virtual__():
    return __virtualname__


def secret_present(name, value=None):
    return {"name": name, "result": True, "changes": {}, "comment": ""}
