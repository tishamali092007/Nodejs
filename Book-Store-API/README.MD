# BookStore – Book Management System

A full-stack web application to manage a bookstore catalog. It has a REST API built with **Node.js, Express and MongoDB**, and an admin dashboard built with plain **HTML, CSS and JavaScript**. Both are served by the same server, so there is nothing extra to configure.

---

## Explaination Video

Watch a 3-minute walkthrough of the project:

https://drive.google.com/file/d/1pspa96jmr7iXAefPixl1UD9CTKPNuRxf/view?usp=sharing

---

## Screenshots

### Dashboard Overview

![Dashboard Overview](https://github.com/jesskp0886-spec/Node-js/blob/05e52f4d3c6ac26d6870dee73c8e45847f210162/Book-Store-API/Img-1.png)

*The book table.*

![Add Book Form](https://github.com/jesskp0886-spec/Node-js/blob/05e52f4d3c6ac26d6870dee73c8e45847f210162/Book-Store-API/Img-2.png)

---

## Table of Contents

- [Demo Video](#demo-video)
- [Screenshots](#screenshots)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Reference](#api-reference)
- [Validation Rules](#validation-rules)
- [Frontend Overview](#frontend-overview)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)
- [License](#license)

---

## Features

**Catalog management**
- Add, view, edit and delete books
- Upload a cover image for each book (JPG, PNG or WebP, up to 2 MB)
- Automatic clean-up of old cover files when a book is updated or deleted

**Search and browsing**
- Search by title, author or ISBN
- Filter by category
- Sort by title, author, price, stock or date added
- Pagination with 5, 10, 20 or 50 books per page

**Dashboard**
- Overview cards: total books, categories, total stock and low-stock books
- Stock status labels: in stock, low stock (5 or fewer) and out of stock
- Responsive layout for desktop, tablet and mobile

**Reliability**
- Server-side validation with clear, field-level error messages
- Duplicate ISBN protection
- The website still loads if the database is offline, and shows a clear message
- Automatic database reconnect every 10 seconds

---

## Tech Stack

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| Runtime    | Node.js                                         |
| Server     | Express 5                                       |
| Database   | MongoDB with Mongoose 9                         |
| Uploads    | Multer                                          |
| Validation | express-validator                               |
| Config     | dotenv                                          |
| Frontend   | HTML5, CSS3, JavaScript (ES modules), no framework |

---

## Project Structure

```
Book-Store-API/
├── models/
│   └── book.js            Mongoose schema and category list
├── public/                Frontend (served as static files)
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── api.js         API client (fetch wrapper)
│       └── app.js         UI logic
├── screenshots/           README images (dashboard.png, add-book.png)
├── uploads/               Uploaded book covers
├── server.js              Express app, routes and database connection
├── package.json
└── .env                   Environment variables (not committed)
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- A MongoDB database. [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier) or a local MongoDB both work.

### Installation

```bash
git clone <your-repository-url>
cd Book-Store-API
npm install
```

### Configuration

Create a `.env` file in the project root (see [Environment Variables](#environment-variables)):

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/bookstore
```

### Run the app

```bash
npm start
```

You should see:

```
Server running at http://localhost:5000
MongoDB connected
```

Open **http://localhost:5000** in your browser.

To check the server and database status, open **http://localhost:5000/api/health**.

---

## Environment Variables

| Variable    | Required | Default | Description                           |
| ----------- | -------- | ------- | ------------------------------------- |
| `PORT`      | No       | `5000`  | Port the server listens on            |
| `MONGO_URI` | Yes      | –       | MongoDB connection string             |

---

## Available Scripts

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `npm start`   | Start the server with Node.js                    |
| `npm run dev` | Start the server with nodemon (auto-restart)     |

---

## API Reference

Base URL: `http://localhost:5000`

All responses are JSON. Create and update requests use `multipart/form-data` so a cover image can be sent together with the book data.

### Endpoints

| Method | Endpoint           | Description                         |
| ------ | ------------------ | ----------------------------------- |
| GET    | `/api/health`      | Server and database status          |
| GET    | `/api/categories`  | List of allowed categories          |
| GET    | `/api/books`       | List books (search, filter, sort, paginate) |
| GET    | `/api/books/:id`   | Get one book                        |
| POST   | `/api/books`       | Create a book                       |
| PUT    | `/api/books/:id`   | Update a book                       |
| DELETE | `/api/books/:id`   | Delete a book                       |

Uploaded covers are available at `/uploads/<filename>`.

### List books

`GET /api/books`

| Query parameter | Description                                                       | Default     |
| --------------- | ----------------------------------------------------------------- | ----------- |
| `search`        | Matches title, author or ISBN (case-insensitive)                  | –           |
| `category`      | One of the allowed categories                                     | –           |
| `minPrice`      | Minimum price                                                     | –           |
| `maxPrice`      | Maximum price                                                     | –           |
| `sortBy`        | `title`, `author`, `price`, `stock` or `createdAt`                | `createdAt` |
| `order`         | `asc` or `desc`                                                   | `desc`      |
| `page`          | Page number                                                       | `1`         |
| `limit`         | Books per page (maximum 100)                                      | `10`        |

Example:

```
GET /api/books?search=clean&category=Technology&sortBy=price&order=asc&page=1&limit=10
```

Response:

```json
{
  "page": 1,
  "limit": 10,
  "total": 1,
  "totalPages": 1,
  "data": [
    {
      "_id": "665f1c2e9b1d8a0012a4c111",
      "title": "Clean Code",
      "author": "Robert C. Martin",
      "isbn": "978-0132350884",
      "category": "Technology",
      "price": 899,
      "stock": 12,
      "tags": ["programming", "best-practices"],
      "description": "A handbook of agile software craftsmanship.",
      "coverImage": "1793771989307-770785239.jpg",
      "createdAt": "2026-11-04T05:59:49.307Z",
      "updatedAt": "2026-11-04T05:59:49.307Z"
    }
  ]
}
```

### Create a book

`POST /api/books` (multipart/form-data)

| Field         | Type   | Required | Notes                                    |
| ------------- | ------ | -------- | ---------------------------------------- |
| `title`       | text   | Yes      | 2–120 characters                         |
| `author`      | text   | Yes      |                                          |
| `isbn`        | text   | Yes      | 10–17 digits, hyphens allowed, unique    |
| `category`    | text   | Yes      | One of the allowed categories            |
| `price`       | number | Yes      | 0 or more                                |
| `stock`       | number | No       | Whole number, 0 or more (default 0)      |
| `tags`        | text   | No       | Comma-separated                          |
| `description` | text   | No       | Up to 1000 characters                    |
| `coverImage`  | file   | No       | JPG, JPEG, PNG or WebP, up to 2 MB       |

Example with cURL:

```bash
curl -X POST http://localhost:5000/api/books \
  -F "title=Clean Code" \
  -F "author=Robert C. Martin" \
  -F "isbn=978-0132350884" \
  -F "category=Technology" \
  -F "price=899" \
  -F "stock=12" \
  -F "tags=programming,best-practices" \
  -F "coverImage=@./cover.jpg"
```

Success response (`201`):

```json
{ "message": "Book created", "id": "665f1c2e9b1d8a0012a4c111" }
```

### Update a book

`PUT /api/books/:id` accepts the same fields as create. Every field is optional, and only the fields you send are changed. Sending a new `coverImage` replaces the old one.

### Delete a book

`DELETE /api/books/:id` removes the book and its cover image.

### Categories

`Fiction`, `Non-Fiction`, `Education`, `Science`, `History`, `Technology`, `Other`

### Status codes

| Code | Meaning                                              |
| ---- | ---------------------------------------------------- |
| 200  | Success                                              |
| 201  | Book created                                         |
| 400  | Validation failed, invalid file type or file too large |
| 404  | Book not found                                       |
| 409  | ISBN already exists                                  |
| 500  | Server error                                         |
| 503  | Database is not connected                            |

Validation error example (`400`):

```json
{
  "message": "Validation failed",
  "errors": [
    { "field": "isbn", "message": "ISBN must be 10-17 digits (hyphen allowed)" }
  ]
}
```

---

## Validation Rules

Validation runs in the browser and again on the server.

- **Title:** 2–120 characters
- **Author:** required
- **ISBN:** 10–17 characters, digits and hyphens only, must be unique
- **Category:** must be one of the allowed categories
- **Price:** number, 0 or more
- **Stock:** whole number, 0 or more
- **Description:** up to 1000 characters
- **Cover image:** `.jpg`, `.jpeg`, `.png` or `.webp`, maximum 2 MB

---

## Frontend Overview

The frontend lives in the `public/` folder and is served by Express, so it uses the same origin as the API and needs no CORS setup.

- **Overview page:** greeting, four summary cards and the book table
- **All Books page:** the book table only (open it from the sidebar)
- **Add / Edit dialog:** form with cover preview and inline error messages
- **Details dialog:** full book information
- **Delete confirmation:** asks before removing a book
- **Currency:** prices are shown in Indian Rupees (₹). To change this, edit the `Intl.NumberFormat` settings in `public/js/app.js`.

Always open the app through the server (`http://localhost:5000`). Opening `index.html` directly from your file system, or with a tool like Live Server, will not reach the API.

---

## Troubleshooting

| Problem | What to do |
| ------- | ---------- |
| Page shows "Failed to fetch" | Make sure the server is running (`npm start`) and you opened `http://localhost:5000`. |
| `/api/health` shows `"database":"disconnected"` | The MongoDB connection is failing. Check `MONGO_URI` in `.env`. |
| `MongoDB connection failed` in the terminal | In MongoDB Atlas, go to **Network Access** and add your IP address. Also check the database user and password. |
| Password contains special characters such as `@` or `:` | URL-encode them in `MONGO_URI` (for example, `@` becomes `%40`). |
| `querySrv ECONNREFUSED` | A DNS problem. Try a different network. The server already sets public DNS servers at startup. |
| `EADDRINUSE` | Port 5000 is already in use. Change `PORT` in `.env`. |
| Image upload fails | Use a JPG, PNG or WebP file smaller than 2 MB. |

---

## Security Notes

- Never commit your `.env` file. Add it to `.gitignore`:

  ```
  .env
  node_modules/
  ```
- If your database password has been shared or committed by mistake, change it in MongoDB Atlas right away.
- This project has no login system. Before using it in production, add authentication and restrict who can create, edit and delete books.

---

## License

This project is licensed under the ISC License.
