module.exports = {
    'secret': 'eypZAZy0CY^g9%KreypZAZy0CY^g9%Kr',
    'roles': {
        ADMINISTRATOR: 'ADMINISTRATOR',
        USER: 'USER'
    },
    oauth: {
        facebook: {
            clientID: process.env.FACEBOOK_APP_ID || '648565348905581',
            clientSecret: process.env.FACEBOOK_APP_SECRET || 'f71614235f7e7bf055d31b2faa3680cc'
        }
    }
}
