var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var mongooseUniqueValidator = require('mongoose-unique-validator');

var schema = new Schema({
    ad: {type: Schema.Types.ObjectId, ref: 'Ad', required: true},
    userFrom: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    userTo: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    readedFrom: { type: Boolean, required: false, default: false },
    readedTo: { type: Boolean, required: false, default: false },
    chat: [{
        author: {type: Schema.Types.ObjectId, ref: 'User', required: true},
        messageDate: { type: Date, required: true },
        text: { type: String, required: true },
        images: [
            {
                originalFilename: {type: String, required: false, es_type:'text'},
                mimeType: {type: String, required: false, es_type:'text'},
                size: {type: String, required: false, es_type:'text'},
                filename: {type: String, required: false, es_type:'text'},
                path: {type: String, required: false, es_type:'text'},
                relativePath: {type: String, required: false, es_type:'text'},
                pathCdn: {type: String, required: false, es_type:'text'}
            }
        ],
        map: {
            type: {
                lat: {type: String, required: true},
                long: {type: String, required: true},
                address: {type: String, required: false}
            },
            required: false
        }
    }]
}, {collection: 'messages', timestamps: true, usePushEach: true});

module.exports = mongoose.model('Message', schema);