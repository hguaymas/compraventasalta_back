var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    readed: { type: Boolean, required: false, default: false },
    notificationDate: { type: Date, required: true },
    text: { type: String, required: true },
    link: { type: String, required: false },
    code: { type: String, required: true },
    readedAt: { type: Date, required: false },
}, {collection: 'notifications', timestamps: true, usePushEach: true});

module.exports = mongoose.model('Notification', schema);