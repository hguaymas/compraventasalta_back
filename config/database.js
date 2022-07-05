module.exports = {
    'server': process.env.DB_SERVER || 'mongodb://admin:O1n3tl4s-@cluster0-shard-00-00-oa0qc.mongodb.net:27017,cluster0-shard-00-01-oa0qc.mongodb.net:27017,cluster0-shard-00-02-oa0qc.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin',
    'database_name': process.env.DB_NAME || 'anunciate_salta'
}