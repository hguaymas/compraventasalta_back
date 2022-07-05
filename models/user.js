var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var Schema = mongoose.Schema;
var mongooseUniqueValidator = require('mongoose-unique-validator');


const ROLE_USER = 'user';
const ROLE_ADMIN = 'admin';
const ROLE_SUPER_ADMIN = 'super-admin';

var userSchema = new Schema({
    username: {type: String, required: false},
    visibleName: {type: String, required: false},
    email: {type: String, required: true, unique: true, lowercase: true},
    defaultPhoto: {type:String, enum: ['upload', 'facebook'], default: 'upload', required: true},
    photo: {
        type: {
            originalFilename: {type: String, required: false},
            mimeType: {type: String, required: false},
            size: {type: String, required: false},
            filename: {type: String, required: false},
            path: {type: String, required: false},
        },
        required: false
    },
    phone: {type: String, required: false},
    city: {type: Schema.Types.ObjectId, ref: 'City', required: false},
    isEnabled: {type: Boolean, required: true, default: false},
    accountActivated: {type: Boolean, required: true, default: false},
    lastLogin: {type: Date, required: false},
    methods: {type: [String], enum: ["local", "facebook", "twitter"]},
    verified: {type: Boolean, required: true, default: false},
    verifiedDate: {type: Date, required: false},
    password: {type: String, required: false},
    ipFrom: {type: String, required: false},
    facebook: {
        type: {
            id: {type: String, required: true},
            photo: {type: String, required: false}
        },
        required: false
    },
    roles: [
        {type: String, required: true}
    ],
    confirmationToken: {type: String, required: false},
    confirmationExpirationDate: {type: Date, required: false},
    passwordRequestedToken: {type: String, required: false},
    passwordRequestedExp: {type: Date, required: false}

}, {collection: 'users', timestamps: true, usePushEach: true});

userSchema.plugin(mongooseUniqueValidator, { message: 'El email ingresado ya se encuentra en uso' });

userSchema.pre('save', async function(next) {
    try {
        if(!this.username) {
            var str=this.email;
            var nameMatch = str.match(/^([^@]*)@/);
            this.username = nameMatch ? nameMatch[1] : null;
            this.visibleName = this.username;
            //var firstName = this.firstName.replace(/\w\S*/g, function(txt){
            //return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            //});
            //this.username =  firstName + ' ' + this.lastName.charAt(0).toUpperCase() + '.';
        } else {
            var names = this.username.split(' ');
            if (names[1]) {
                names[1] = names[1].charAt(0) + '.'
            }
            this.visibleName =  names.join(' ');
        }

        if (this.methods.indexOf('local') === -1) {
            next();
        }

        if (this.isModified('methods') && this.methods.indexOf('facebook') !== -1) {
            this.verified = true;
            this.verifiedDate = new Date();
        }

        if (this.password && !this.isModified('password')) {
            console.log('Hay local password pero NO MODIFICADO');
            return next();
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(this.password, salt);
        this.password = passwordHash;
        console.log('password modificado');
        next();
    } catch(error) {
        next(error);
    }
});

userSchema.methods.isPasswordRequestNonExpired = async function(ttl){
        return this.passwordRequestedAt && this.passwordRequestedAt.getTime() + ttl > Date.now();
};

userSchema.methods.comparePassword = async function(passwordAttempt){
    try {
        return await bcrypt.compare(passwordAttempt, this.password);
    } catch (error) {
        throw new Error(error);
    }

};

userSchema.methods.hasRole = async function(role){
    try {
        console.log('Tiene rol ' + role + '?');
        console.log(this.roles.indexOf(role) !== -1);
        return await this.roles.indexOf(role) !== -1;
    } catch (error) {
        throw new Error(error);
    }

};


module.exports = mongoose.model('User', userSchema);