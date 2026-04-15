"""Supabase client singleton for the job recommender app.

Loads credentials from .env and exposes a single client instance.
"""

import os
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_client: Optional[Client] = None
_service_client: Optional[Client] = None


def get_client() -> Client:
    """Return the singleton Supabase client. Creates it on first call."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            raise EnvironmentError(
                "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
            )
        _client = create_client(url, key)
    return _client


def get_service_client() -> Client:
    """Return the singleton service-role client for administrative tasks."""
    global _service_client
    if _service_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise EnvironmentError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
            )
        _service_client = create_client(url, key)
    return _service_client
