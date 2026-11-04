const mongoose = require('mongoose');

const CATEGORIES = ['Fiction', 'Non-Fiction', 'Education', 'Science', 'History', 'Technology', 'Other'];

const bookSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    author:      { type: String, required: true, trim: true },
    isbn:        { type: String, required: true, unique: true, trim: true },
    category:    { type: String, enum: CATEGORIES, required: true },
    price:       { type: Number, required: true, min: 0 },
    stock:       { type: Number, default: 0, min: 0 },
    tags:        { type: [String], default: [] },
    description: { type: String, default: '', trim: true },
    coverImage:  { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
module.exports.CATEGORIES = CATEGORIES;