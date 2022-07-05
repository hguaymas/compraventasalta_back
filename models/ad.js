var mongoose = require('mongoose');
var mexp = require('mongoose-elasticsearch-xp');
var mongoosastic = require('mongoosastic');
var slug = require('mongoose-slug-generator');
const mongoosePaginate = require('mongoose-paginate');
mongoose.plugin(slug);

var Schema = mongoose.Schema;
var Category = require('./category');
var City = require('./city');

const AD_STATUS = ["ACTIVE", "HIDDEN", "PENDING", "EXPIRED", "DELETED", "FINISHED", "REJECTED"];
const AD_CURRENCY = ["$", "USD"];
const AD_PRICE_TYPE = ["NEGOTIABLE", "FIXED", 'FREE'];

var imageSchema = new Schema({
    originalFilename: {type: String, required: false, es_type:'text'},
    mimeType: {type: String, required: false, es_type:'text'},
    size: {type: String, required: false, es_type:'text'},
    filename: {type: String, required: false, es_type:'text'},
    path: {type: String, required: false, es_type:'text'},
    relativePath: {type: String, required: false, es_type:'text'},
    pathCdn: {type: String, required: false, es_type:'text'}
}, { _id : false });

var adSchema = new Schema({
    title: {type: String, required: true, es_indexed:true, es_boost:2.0, es_type:'text'},
    content: {type: String, required: true, es_indexed:true, es_boost: 2.0, es_type:'text'},
    slug: {type: String, slug: ["title"], unique: true, es_indexed:true, index: true, es_type:'text'},
    mainImage: {type: imageSchema, required: false, es_indexed: true},
    images: {type: [imageSchema], es_indexed: true},
    cityId: {type:  Schema.Types.ObjectId, required: false, es_indexed:true, es_type:'keyword'},
    city: {type: Schema.Types.ObjectId, ref: 'City', es_schema: City.schema, required: false, es_indexed:true},
    categoryId: {type:  Schema.Types.ObjectId, required: true, es_indexed:true, es_type:'keyword'},
    category: {type: Schema.Types.ObjectId, ref: 'Category', es_schema: Category.schema, required: true, es_indexed:true},
    subcategory: {type: Schema.Types.ObjectId, ref: 'Category', es_schema: Category.schema, required: true, es_indexed:true},
    user: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    enabled: {type: Boolean, required: true, default: true},
    status: {type: String, enum: AD_STATUS, default: 'ACTIVE', index: true, es_indexed:true, es_type:'text'},
    republishedDate: {type: Date, required: false, es_indexed:true},
    reminderDate: {type: Date, required: false},
    reminderTimes: {type: Number, required: false},
    price: {type: Number, required: false, es_indexed:true, es_type:'double'},
    currency: {type: String, enum: AD_CURRENCY, default: '$', es_indexed:true, es_type:'keyword'},
    priceType: {type: String, enum: AD_PRICE_TYPE, default: 'NEGOTIABLE', es_indexed:true, es_type:'text'},
    ipFrom: {type: String, required: false},
    verified: {type: Boolean, required: true, default: false},
    verifiedDate: {type: Date, required: false},
    finished: {type: Boolean, required: true, default: false},
    finishedDate: {type: Date, required: false},
    createdAt: {type: Date, required: true, es_indexed:true},
    updatedAt: {type: Date, required: true, es_indexed:true},
    extraFields: [{
        name: {type: String, required: true, es_type:'text'},
        value: {type: String, required: true, es_indexed:true, es_type:'text'}
    }],
    imported: {type: Boolean, required: false, default: false}
}, {collection: 'ads', usePushEach: true});
// adSchema.plugin(mexp);
adSchema.plugin(mongoosePaginate);
adSchema.plugin(mongoosastic, {
    populate: [
        {path: 'category', select: '_id name slug'},
        {path: 'subcategory', select: '_id name slug'},
        {path: 'city', select: '_id name slug'}
    ]
});
const Ad = mongoose.model('Ad', adSchema);

Ad.createMapping({
    "analysis" : {
        "analyzer":{
            "content":{
                "type":"standard",
                "stopwords":"_spanish_"
            }
        }
    }
},function(err, mapping){
    if (err) {
        console.error(err);
    }
    console.log('Mapping completed!');
});

/*var stream = Ad.synchronize();
var count = 0;
stream.on('data', function(err, doc){
    count++;
});
stream.on('close', function(){
    console.log('indexed ' + count + ' documents!');
});
stream.on('error', function(err){
    console.log(err);
});*/

module.exports = Ad;
