module.exports = {
    path_tmp: './uploads/tmp',
    path_icons: 'uploads/images/icons',
    pathCdn: process.env.PATH_CDN || 'https://d24ybofanksy1z.cloudfront.net',
    republishTimeQty: process.env.REPUBLISH_TIME_QTY || 1,
    remindTimeQty: process.env.REMIND_TIME_QTY || 15,
    remindQty: process.env.REMIND_TIME_QTY || 3,
    republishTimeUnit: process.env.REPUBLISH_TIME_UNIT || 'months',
    remindTimeUnit: process.env.REMIND_TIME_UNIT || 'days',
    republishCron: process.env.REPUBLISH_CRON || '30 11 * * *'
}