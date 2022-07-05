var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
const handlebars = require('express-handlebars');
const hbs = require('nodemailer-express-handlebars');
const Handlebars = require('hbs');
const path = require('path');
var sgTransport = require('nodemailer-sendgrid-transport');
const AWS = require('aws-sdk');
const breaklines = require('../utils/breaklines');

AWS.config.region = 'us-west-2';
AWS.config.credentials = new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET);

var options = {
    auth: {
        api_user: 'hguaymas',
        api_key: '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'
    }
}

module.exports = {
    /*transporter: nodemailer.createTransport(smtpTransport({
        service: 'gmail',
        auth: {
            user: 'soporte@anunciatesalta.com.ar', // generated ethereal user
            pass: 'O1n3tl4s'  // generated ethereal password
        }
    })),*/
    /*transporter: nodemailer.createTransport(sgTransport({
        auth: {
            api_user: 'hguaymas',
            api_key: '4tl4s1320'
        }
    })),*/
    transporter: function() {
        AWS.config.update({region: 'us-west-2'});
        var transporter = nodemailer.createTransport({
            SES: new AWS.SES({
                apiVersion: '2010-12-01'
            })
        });
        var viewEngine = handlebars.create({
            helpers: {
                breakLines: breaklines.breakLines()
            }
        });
        //attach the plugin to the nodemailer transporter
        transporter.use('compile', hbs({
            viewEngine: viewEngine,
            viewPath: path.resolve(__dirname, '../views/emails')
        }));
        return transporter;
    },
    attachments: {
        filename: process.env.AWS_EMAIL_LOGO || 'logo_4.png',
        path: 'https://d24ybofanksy1z.cloudfront.net/' + (process.env.AWS_EMAIL_LOGO  || 'logo_4.png'),
        cid: 'logo_compraventasalta_mail@compraventasalta.com.ar' //same cid value as in the html img src
    },
    from: '"CompraVenta Salta" <soporte@compraventasalta.com.ar>',
    viewEngine: handlebars.create({
        helpers: {
            nl2br: function (text, isXhtml) {
                var breakTag = (isXhtml || typeof isXhtml === 'undefined') ? '<br/>' : '<br/>';
                return new Handlebars.SafeString((text + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2'));
            }
        }
    }),
    sendMail: async (options) => {
        AWS.config.update({region: 'us-west-2'});
        var transporter = nodemailer.createTransport({
            SES: new AWS.SES({
                apiVersion: '2010-12-01',
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET,
                region: 'us-west-2',
            })
        });
        var viewEngine = handlebars.create({
            helpers: {
                breakLines: breaklines.breakLines(),
                nl2br: function (text, isXhtml) {
                    var breakTag = (isXhtml || typeof isXhtml === 'undefined') ? '<br/>' : '<br/>';
                    return new Handlebars.SafeString((text + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2'));
                }
            }
        });
        transporter.use('compile', hbs({
            viewEngine: viewEngine,
            viewPath: path.resolve(__dirname, '../views/emails')
        }));
        var mailOptions = {
            from: options.from || '"CompraVentaSalta" <soporte@compraventasalta.com.ar>', // sender address
            to: options.to, // list of receivers
            subject: options.subject, // Subject line
            text: options.text, // plain text body
            template: options.template,
            context: options.context,
            attachments: [{
                filename: process.env.AWS_EMAIL_LOGO || 'logo_4.png',
                path: 'https://d24ybofanksy1z.cloudfront.net/' + (process.env.AWS_EMAIL_LOGO || 'logo_4.png'),
                cid: 'logo_compraventasalta_mail@compraventasalta.com.ar' //same cid value as in the html img src
            }]
        };
        if (options.attachments) {
            mailOptions.attachments.push(options.attachments);
        }
        return await transporter.sendMail(mailOptions);
    }
};
