import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

import pytest

from app.core.permissions import reset_role_permissions_cache


@pytest.fixture(autouse=True)
def default_role_permissions():
    """Role permissions are cached per process; don't let one test's edits leak into the next"""
    reset_role_permissions_cache()
    yield
    reset_role_permissions_cache()
