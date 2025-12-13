# Django API Project

[![Python](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/django-4.2-green.svg)](https://www.djangoproject.com/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](LICENSE)

A simple Django project with JWT authentication API endpoints.

---

## Table of Contents
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [API Documentation](#api-documentation)
  - [Hello World](#1-hello-world)
  - [Authentication Endpoints](#2-authentication-endpoints)
    - [Register User](#21-register-user)
    - [Login User](#22-login-user)
    - [Refresh Access Token](#23-refresh-access-token)
- [Authentication Flow](#authentication-flow-summary)

---

## Setup

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd <repo-folder>
````

2. **Create virtual environment**

```bash
python -m venv env
```

3. **Activate virtual environment**

* Windows:

```bash
env\Scripts\activate
```

* Linux / Mac:

```bash
source env/bin/activate
```

4. **Install dependencies**

```bash
pip install -r requirements.txt
```

5. **Run migrations**

```bash
python manage.py migrate
```

6. **Create superuser (optional)**

```bash
python manage.py createsuperuser
```

---

## Running the Project

```bash
python manage.py runserver
```

Access the API at:

```
http://127.0.0.1:8000/api/
```

---

## API Documentation

### 1. Hello World

* **Endpoint:** `/hello/`
* **Method:** `GET`
* **Description:** Simple test endpoint to check if API is working.
* **Request Example:** None
* **Response Example:**

```json
{
  "message": "Hello, world!"
}
```

---

### 2. Authentication Endpoints

#### 2.1 Register User

* **Endpoint:** `/auth/register/`
* **Method:** `POST`
* **Description:** Create a new user account.
* **Request Body:**

```json
{
  "username": "your_username",
  "email": "your_email@example.com",
  "password": "your_password"
}
```

* **Response Example (Success):**

```json
{
    "message": "User registered successfully",
    "user": {
        "id": 3,
        "username": "your_username",
        "email": "your_email@example.com"
    }
}
```

* **Status Code:** `201 Created`

---

#### 2.2 Login User

* **Endpoint:** `/auth/login/`
* **Method:** `POST`
* **Description:** Authenticate user and return JWT tokens.
* **Request Body:**

```json
{
  "username": "your_username",
  "password": "your_password"
}
```

* **Response Example (Success):**

```json
{
  "refresh": "<refresh_token>",
  "access": "<access_token>"
}
```

* **Status Code:** `200 OK`

---

#### 2.3 Refresh Access Token

* **Endpoint:** `/auth/refresh/`
* **Method:** `POST`
* **Description:** Get a new access token using the refresh token.
* **Request Body:**

```json
{
  "refresh": "<refresh_token>"
}
```

* **Response Example (Success):**

```json
{
  "access": "<new_access_token>"
}
```

* **Status Code:** `200 OK`

---

## Authentication Flow Summary

1. **Register** → create user account.
2. **Login** → get `access` and `refresh` tokens.
3. **Access protected endpoints** → use `access` token in `Authorization: Bearer <access>` header.
4. **Refresh** → get new `access` token using `refresh` token.

---

## 3. Components

### 3.1 Import

1. First create a superuser

```bash
python manage.py createsuperuser
```

2. Login with superuser in admin dashboard (baseurl\admin\)

3. Proceed to components list click import zip and import the components zip ( Components zip must follow this folder structure)

   ```json
   components
   - components.csv
   -svg
        - ------.svg
   -png
        - ------.png 


#### 3.2 Fetch Components

* **Endpoint:** `/components/`
* **Method:** `GET`
* **Description:** Fetch Components

* **Response Example (Success):**

```json
{
    "components": [
        {
            "id": 1341,
            "svg_url": null,
            "png_url": null,
            "s_no": "101",
            "parent": "General",
            "name": "Insulation/Tracing",
            "legend": "",
            "suffix": "",
            "object": "Insulation",
            "svg": null,
            "png": null,
            "grips": ""
        },
       {
            "id": 1345,
            "svg_url": "http://127.0.0.1:8000/media/components/Inflow_Line_wPTKkEg.svg",
            "png_url": "http://127.0.0.1:8000/media/components/Inflow_Line_e9o9LWU.png",
            "s_no": "301",
            "parent": "Piping",
            "name": "Inflow Line",
            "legend": "",
            "suffix": "",
            "object": "InflowLine",
            "svg": "http://127.0.0.1:8000/media/components/Inflow_Line_wPTKkEg.svg",
            "png": "http://127.0.0.1:8000/media/components/Inflow_Line_e9o9LWU.png",
            "grips": ""
        },
]
```

* **Status Code:** `200 OK`
