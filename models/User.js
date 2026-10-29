const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: { type: String, required: true, minlength: 8 },
    role: {
        type: String,
        enum: ['client', 'editor'],
        required: true
    },
    company: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
});

userSchema.methods.toSafeObject = function toSafeObject() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        company: this.company || undefined,
        createdAt: this.createdAt
    };
};

module.exports = mongoose.model('User', userSchema);
