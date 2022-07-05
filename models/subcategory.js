var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Category = require('./category');
var slug = require('mongoose-slug-generator');
mongoose.plugin(slug);


var schema = new Schema({
    name: { type: String, required: true },
    description: { type: String, required: false },
    slug: {type: String, slug: ["name"], unique: true, es_indexed:true},
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    dynamicFields: [{
        label:  { type: String, required: true },
        fieldType:     { type: String, required: true },
        choices:        { type: Array, required: false },
        multiple:       { type: Boolean, required: false, default: false },
        expanded:       { type: Boolean, required: false, default: false },
        maxLength:     { type: Number, required: false },
        size:           { type: Number, required: false },
        required:      { type: Boolean, required: true, default: false },
        filterable:      { type: Boolean, required: false, default: false },
        sortable:      { type: Boolean, required: false, default: false }
    }]
}, {collection: 'subcategories'});

module.exports = mongoose.model('Subcategory', schema);