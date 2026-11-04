require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');

const Book = require('./models/Book');
const { CATEGORIES } = require('./models/Book');

const app = express();
app.use(express.json());

// ---------- uploads folder ----------
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// ---------- Frontend (public/index.html) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Multer (book cover image) ----------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    fileFilter: (req, file, cb) => {
        const ok = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase());
        if (!ok) {
            const err = new Error('Only jpg, jpeg, png or webp images are allowed');
            err.code = 'INVALID_FILE_TYPE';
            return cb(err);
        }
        cb(null, true);
    }
});

function removeFile(filename) {
    if (!filename) return;
    fs.unlink(path.join(uploadDir, path.basename(filename)), () => { });
}

// ---------- Helpers ----------
function toTags(tags) {
    if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
    if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean);
    return [];
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- Validation ----------
function checkValidation(req, res, next) {
    const result = validationResult(req);
    if (!result.isEmpty()) {
        if (req.file) removeFile(req.file.filename);
        return res.status(400).json({
            message: 'Validation failed',
            errors: result.array().map(({ path, msg }) => ({ field: path, message: msg }))
        });
    }
    next();
}

const tagsRule = v => Array.isArray(v) || typeof v === 'string';

const bookRules = [
    body('title').trim().notEmpty().withMessage('Title is required')
        .isLength({ min: 2, max: 120 }).withMessage('Title must be 2-120 characters'),
    body('author').trim().notEmpty().withMessage('Author is required'),
    body('isbn').trim().matches(/^[0-9-]{10,17}$/)
        .withMessage('ISBN must be 10-17 digits (hyphen allowed)'),
    body('category').isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a number >= 0'),
    body('stock').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Stock must be a whole number >= 0'),
    body('tags').optional({ values: 'falsy' }).custom(tagsRule).withMessage('Tags must be text or an array'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description max 1000 characters')
];

const updateRules = [
    body('title').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Title must be 2-120 characters'),
    body('author').optional().trim().notEmpty().withMessage('Author cannot be empty'),
    body('isbn').optional().trim().matches(/^[0-9-]{10,17}$/).withMessage('ISBN must be 10-17 digits (hyphen allowed)'),
    body('category').optional().isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a number >= 0'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a whole number >= 0'),
    body('tags').optional().custom(tagsRule).withMessage('Tags must be text or an array'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description max 1000 characters')
];

const idRule = param('id').isMongoId().withMessage('A valid book ID is required');

// ---------- Routes ----------
app.get('/api/health', (req, res) => res.json({ message: 'Book Store API is running' }));

// CATEGORIES (used by the frontend dropdowns)
app.get('/api/categories', (req, res) => res.json({ data: CATEGORIES }));

// CREATE
app.post('/api/books', upload.single('coverImage'), bookRules, checkValidation, async (req, res) => {
    try {
        const { title, author, isbn, category, price, stock, tags, description } = req.body;
        const book = await Book.create({
            title, author, isbn, category, price,
            stock: stock || 0,
            tags: toTags(tags),
            description: description || '',
            coverImage: req.file ? req.file.filename : ''
        });
        res.status(201).json({ message: 'Book created', id: book._id });
    } catch (err) {
        if (req.file) removeFile(req.file.filename);
        if (err.code === 11000) return res.status(409).json({ message: 'ISBN already exists' });
        res.status(500).json({ message: 'Unable to create book' });
    }
});

// READ ALL (search + filter + sort + pagination)
app.get('/api/books', async (req, res) => {
    try {
        const filter = {};

        const search = String(req.query.search || '').trim();
        if (search) {
            const term = escapeRegex(search);
            filter.$or = [
                { title: { $regex: term, $options: 'i' } },
                { author: { $regex: term, $options: 'i' } },
                { isbn: { $regex: term, $options: 'i' } }
            ];
        }

        if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;

        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);
        if (!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)) {
            filter.price = {};
            if (!Number.isNaN(minPrice)) filter.price.$gte = minPrice;
            if (!Number.isNaN(maxPrice)) filter.price.$lte = maxPrice;
        }

        const allowedSort = ['title', 'author', 'price', 'stock', 'createdAt'];
        const sortBy = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            Book.find(filter).sort({ [sortBy]: order }).skip(skip).limit(limit).lean(),
            Book.countDocuments(filter)
        ]);

        res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data });
    } catch (err) {
        res.status(500).json({ message: 'Unable to fetch books' });
    }
});

// READ ONE
app.get('/api/books/:id', idRule, checkValidation, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        res.json({ data: book });
    } catch (err) {
        res.status(500).json({ message: 'Unable to fetch book' });
    }
});

// UPDATE
app.put('/api/books/:id', upload.single('coverImage'), idRule, updateRules, checkValidation, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            if (req.file) removeFile(req.file.filename);
            return res.status(404).json({ message: 'Book not found' });
        }

        const allowed = ['title', 'author', 'isbn', 'category', 'price', 'stock', 'description'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) book[key] = req.body[key];
        }
        if (req.body.tags !== undefined) book.tags = toTags(req.body.tags);

        let oldFile = '';
        if (req.file) {
            oldFile = book.coverImage;
            book.coverImage = req.file.filename;
        }

        await book.save();
        removeFile(oldFile);
        res.json({ message: 'Book updated', id: book._id });
    } catch (err) {
        if (req.file) removeFile(req.file.filename);
        if (err.code === 11000) return res.status(409).json({ message: 'ISBN already exists' });
        res.status(500).json({ message: 'Unable to update book' });
    }
});

// DELETE
app.delete('/api/books/:id', idRule, checkValidation, async (req, res) => {
    try {
        const book = await Book.findByIdAndDelete(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        removeFile(book.coverImage);
        res.json({ message: 'Book deleted', id: book._id });
    } catch (err) {
        res.status(500).json({ message: 'Unable to delete book' });
    }
});

// ---------- Error handler (Multer errors) ----------
app.use((err, req, res, next) => {
    if (req.file) removeFile(req.file.filename);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 2 MB)' : err.message });
    }
    if (err.code === 'INVALID_FILE_TYPE') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server error' });
});

// ---------- Connect DB then start server ----------

mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(process.env.PORT || 5000,
    () => console.log(`Server and database ready on port ${process.env.PORT || 5000}`)))
  .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
