var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var mongooseUniqueValidator = require('mongoose-unique-validator');
const REASONS = ["ILLEGAL", "SPAM", 'DUPLICATE', 'CATEGORY', 'RULES'];
var schema = new Schema({
    ad: {type: Schema.Types.ObjectId, ref: 'Ad', required: true},
    email: {type: String, required: true, unique: true, lowercase: true},
    reason: {type: String, enum: REASONS, required: true, index: true},
    message: {type: String, required: true}
}, {collection: 'ad_reports', timestamps: true});

module.exports = mongoose.model('AdReport', schema);