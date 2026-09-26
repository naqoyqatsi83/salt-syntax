__virtualname__ = "mycorp"


def present(name):
    return {"name": name, "result": True, "changes": {}, "comment": ""}
