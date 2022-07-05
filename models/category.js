var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var mongooseUniqueValidator = require('mongoose-unique-validator');
var slug = require('mongoose-slug-generator');
var materializedPlugin = require('mongoose-materialized');
var mongoosastic = require('mongoosastic');
mongoose.plugin(slug);

var schema = new Schema({
    name: { type: String, required: true, unique: true, es_indexed:true, es_boost:2.0, es_type:'text' },
    description: { type: String, required: false },
    slug: {type: String, slug: ["name"], unique: true, es_indexed:true, es_boost:2.0, es_type:'text'},
    icon: {
        type: {
            originalFilename: {type: String, required: false},
            mimeType: {type: String, required: false},
            size: {type: String, required: false},
            filename: {type: String, required: false},
            path: {type: String, required: false}
        },
        required: false
    },
    color: { type: String, required: false },
    selectable: { type: Boolean, required: false, default: true },
    hasPrice: { type: Boolean, required: false, default: false },
    requiredImage: { type: Boolean, required: false, default: false },
    footerText: { type: String, required: false },
    metaKeywords:    { type: String, required: false},
    metaDescription:    { type: String, required: false},
    metaTitle:    { type: String, required: false},
    order:    { type: Number, required: false},
    dynamicFields: {
        type: [{
            label: {type: String, required: true},
            name: {type: String, required: true},
            value: {type: String, required: true},
            fieldType: {type: String, required: true},
            choices: [
                {
                    label: {type: String, required: true},
                    value: {type: String, required: true}
                }
            ],
            multiple: {type: Boolean, required: false, default: false},
            expanded: {type: Boolean, required: false, default: false},
            maxLength: {type: Number, required: false},
            size: {type: Number, required: false},
            required: {type: Boolean, required: true, default: false},
            filterable: {type: Boolean, required: false, default: false},
            sortable: {type: Boolean, required: false, default: false}
        }],
        required: false,
        es_indexed: false
    }
}, {collection: 'categories'});

schema.plugin(mongooseUniqueValidator);
schema.plugin(materializedPlugin);
schema.plugin(mongoosastic);
const Category = mongoose.model('Category', schema);
var stream = Category.synchronize();

module.exports = Category;