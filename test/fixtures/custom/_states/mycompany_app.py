"""A formula's own state module, for the function-check tests (#64)."""
__func_alias__ = {"list_": "list"}


def deployed(name, version=None):
    return {"name": name, "result": True, "changes": {}, "comment": ""}


def removed(name):
    return {"name": name, "result": True, "changes": {}, "comment": ""}


def list_(name):
    return {"name": name, "result": True, "changes": {}, "comment": ""}


def _helper():
    pass


def mod_watch(name, **kwargs):
    pass
