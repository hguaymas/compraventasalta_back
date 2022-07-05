const passport = require('passport');
const User = require('../models/user');
const config = require('./auth.js');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const FacebookTokenStrategy = require('passport-facebook-token');

const localOptions = {
    usernameField: 'email'
};

passport.use(new LocalStrategy(localOptions, async (email, password, done) => {
    try {
        const user = await User.findOne({email: email});

        if (!user) {
            return done(null, false, {message: 'El usuario/email ingresado es incorrecto'});
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return done(null, false, {flash: 'Email y/o contraseña incorrectas'});
        }

        return done(null, user);

    } catch (error) {
        console.log(error);
        done(error, false);
    }
//https://www.youtube.com/watch?v=Peww_cdgka4

}));

const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromHeader(),
    secretOrKey: config.secret
};

passport.use(new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
        const user = await User.findById(payload._id);

        if (!user) {
            return done(null, false);
        }

        done(null, user);

    } catch (error) {
        done(error, false);
    }
}));


passport.use('facebookToken', new FacebookTokenStrategy({
    clientID: config.oauth.facebook.clientID,
    clientSecret: config.oauth.facebook.clientSecret,
    //callbackURL     : config.facebook.callbackURL,
    //profileFields   : [ "id", "birthday", "displayName", "gender", "email", "picture" ],
    scope           : [ "email", "groups_show_list", "publish_to_groups any"]
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('profile', profile);
        console.log('accessToken', accessToken);
        console.log('refreshToken', refreshToken);

        const existingFacebookUser = await User.findOne({"facebook.id": profile.id });
        console.log('existingFacebookUser',existingFacebookUser);
        if (existingFacebookUser) {
            existingFacebookUser.email = profile.emails[0].value;
            existingFacebookUser.facebook = {
                id: profile.id,
                photo: profile.photos[0].value
            };
            await existingFacebookUser.save();
            return done(null, existingFacebookUser);
        } else {
            const existingUser = await User.findOne({email: profile.emails[0].value });
            console.log('existingUser',existingUser);
            if(existingUser) {
                existingUser.facebook = {
                    id: profile.id,
                    photo: profile.photos[0].value
                };
                if(existingUser.methods.indexOf('facebook') === -1) {
                    existingUser.methods.push('facebook');
                }
                if(existingUser.roles.indexOf(config.roles.USER) === -1)  {
                    existingUser.roles.push(config.roles.USER);
                }
                await existingUser.save();
                return done(null, existingUser);
            }
            const newUser = new User({
                firstName: profile._json.first_name,
                lastName: profile._json.last_name,
                email: profile.emails[0].value,
                isEnabled: true,
                accountActivated: true,
                methods: ['facebook'],
                facebook: {
                    id: profile.id
                }
            });
            await newUser.save();
            done(null, newUser, 'Perfectirijillo');
        }
    } catch(error) {
        console.log(error);
        done(error, false, 'Error de token');
    }
}));
