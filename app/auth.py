"""Supabase Auth helpers for Streamlit.

Manages login, register, logout, and session state.
"""

from typing import Optional

import streamlit as st

from database.supabase_client import get_client


def render_auth_ui() -> bool:
    """Render login/register form in the Streamlit sidebar.

    Returns True if the user is authenticated, False otherwise.
    Stores session in st.session_state["supabase_session"].
    """
    client = get_client()

    # Already authenticated
    if st.session_state.get("supabase_session"):
        user = st.session_state["supabase_session"].user
        st.sidebar.success(f"✅ Signed in as\n**{user.email}**")
        if st.sidebar.button("🚪 Sign Out"):
            client.auth.sign_out()
            del st.session_state["supabase_session"]
            st.rerun()
        return True

    st.sidebar.markdown("---")
    st.sidebar.subheader("🔐 Account")
    tab_login, tab_register = st.sidebar.tabs(["Login", "Register"])

    with tab_login:
        email = st.text_input("Email", key="login_email")
        password = st.text_input(
            "Password", type="password", key="login_pass"
        )
        if st.button("Login", key="btn_login"):
            try:
                session = client.auth.sign_in_with_password(
                    {"email": email, "password": password}
                )
                st.session_state["supabase_session"] = session.session
                st.rerun()
            except Exception as e:
                st.error(f"Login failed: {e}")

    with tab_register:
        email_r = st.text_input("Email", key="reg_email")
        password_r = st.text_input(
            "Password (min 6 chars)", type="password", key="reg_pass"
        )
        if st.button("Create Account", key="btn_register"):
            try:
                client.auth.sign_up(
                    {"email": email_r, "password": password_r}
                )
                st.success(
                    "✅ Account created! Check your email to confirm, "
                    "then login."
                )
            except Exception as e:
                st.error(f"Registration failed: {e}")

    return False


def get_current_user_id() -> Optional[str]:
    """Return the current user's Supabase UUID, or None."""
    session = st.session_state.get("supabase_session")
    if session:
        return session.user.id
    return None
