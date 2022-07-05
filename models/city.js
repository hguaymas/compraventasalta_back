var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var mongooseUniqueValidator = require('mongoose-unique-validator');
var slug = require('mongoose-slug-generator');
var mongoosastic = require('mongoosastic');
mongoose.plugin(slug);

var schema = new Schema({
    name: { type: String, required: true, unique: true, es_indexed:true, es_boost:2.0, es_type:'text' },
    description: { type: String, required: false },
    slug: {type: String, slug: ["name"], unique: true, es_indexed:true, es_boost:2.0, es_type:'text'},
    footerText: { type: String, required: false },
}, {collection: 'cities'});

schema.plugin(mongooseUniqueValidator);
schema.plugin(mongoosastic);
const City = mongoose.model('City', schema);
var stream = City.synchronize();
module.exports = City;