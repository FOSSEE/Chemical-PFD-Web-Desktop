import requests
import src.app_state as app_state

DEFAULT_TIMEOUT = 5  # seconds


class ApiError(Exception):
    pass


def login(username: str, password: str):
    """
    Call Django /api/auth/login/ (JWT) and return access, refresh.
    """
    url = f"{app_state.BACKEND_BASE_URL}/api/auth/login/"

    try:
        resp = requests.post(
            url,
            json={
                "username": username,
                "password": password,
            },
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        raise ApiError(f"Could not reach server: {e}")

    if resp.status_code == 200:
        data = resp.json()
        # SimpleJWT default keys: "access", "refresh"
        if "access" not in data or "refresh" not in data:
            raise ApiError("Unexpected response from server.")
        return data["access"], data["refresh"]

    elif resp.status_code in (400, 401):
        try:
            detail = resp.json().get("detail", "Invalid credentials.")
        except Exception:
            detail = "Invalid credentials."
        raise ApiError(detail)

    else:
        raise ApiError(f"Server error: {resp.status_code}")


def get_components():
    """
    Fetch list of components from /api/components/
    """
    url = f"{app_state.BACKEND_BASE_URL}/api/components/"
    try:
        headers = {}
        if app_state.access_token:
            headers["Authorization"] = f"Bearer {app_state.access_token}"
        
        resp = requests.get(url, headers=headers, timeout=DEFAULT_TIMEOUT)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"Failed to fetch components: {e}")
    return []


def register(username: str, email: str, password: str):
    """
    Call Django /api/auth/register/ and return JSON if needed.
    We only care if it succeeds; otherwise raise ApiError.
    """
    url = f"{app_state.BACKEND_BASE_URL}/api/auth/register/"

    try:
        resp = requests.post(
            url,
            json={
                "username": username,
                "email": email,
                "password": password,
            },
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        raise ApiError(f"Could not reach server: {e}")

    # Success: 200 or 201
    if resp.status_code in (200, 201):
        try:
            return resp.json()
        except ValueError:
            return {}

    # Try to read a useful error message
    try:
        data = resp.json()
    except ValueError:
        data = {}

    msg = (
        data.get("detail")
        or data.get("message")
        or str(data)
        or f"Registration failed (status {resp.status_code})."
    )
    raise ApiError(msg)