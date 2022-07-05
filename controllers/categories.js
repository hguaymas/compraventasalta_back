var Category = require('../models/category');
var fs = require('fs');
const fse = require('fs-extra');
var config = require('../config/config.js');
const AWS = require('aws-sdk');
const bucketName = "anunciatesalta-images";
const pathCdn = process.env.PATH_CDN || 'https://d24ybofanksy1z.cloudfront.net';
AWS.config.region = 'sa-east-1';
AWS.config.credentials = new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID,process.env.AWS_SECRET);
//accessKeyId y secret se configura mediante ENV

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function s3Delete(file) {
    const s3 = new AWS.S3({
        params: {
            Bucket: bucketName
        }
    });
    const filename = file.replace(/^.*[\\\/]/, '');
    console.log('Imagen a borrar: ' + filename)
    return s3
        .deleteObject({
            Bucket: bucketName,
            Key: 'categories/'+filename
        })
        .promise();
}

async function s3Upload(file) {
    const s3 = new AWS.S3({
        params: {
            Bucket: bucketName
        }
    });
    const filename = file.path.replace(/^.*[\\\/]/, '');
    const tmp_path = file.path;
    console.log('filename', filename);
    console.log('tmp_path', tmp_path);

    const fileStream = await fs.createReadStream(tmp_path);
    console.log('fileStream', fileStream);

    return s3
        .upload({
            Bucket: bucketName,
            Key: 'categories/'+filename,
            ACL: 'public-read',
            Body: fileStream,
            ContentType: file.type
        })
        .promise();
}


exports.createCategory = async (req, res, next) => {

    var category = new Category(req.body);

    if(req.files && req.files.icon) {
            const image = req.files.icon;
            try {

                const uploadedImage = await s3Upload(image);
                console.log(uploadedImage);
                var icon = {
                        originalFilename: image.originalFilename,
                        mimeType: image.type,
                        size: image.size,
                        filename: image.name,
                        path: uploadedImage.Location,
                        pathCdn: pathCdn + '/' + uploadedImage.key,
                        relativePath: uploadedImage.key
                    };
                category.icon = icon;
                fs.unlinkSync(image.path);
                console.log(image);
            } catch (err) {
                console.error(err);
                return res.status(500).json({
                    title: 'Ocurrió un error guardando el icono de la categoria',
                    error: err
                });
            }
    }
    try {
        const categoryCreated = await category.save();
        res.status(201).json(categoryCreated);
    } catch(err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error guardando la categoria',
            error: err
        });
    }
};

exports.getCategory = function (req, res, next) {
    Category.findOne({
        '_id': req.params.id
    })
        .exec(function (err, category) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener la categoría',
                    error: err
                });
            }
            res.status(200).json(category)
        });
};


exports.getCategoryBySlug = async (req, res, next) => {
    const categorySlug = req.params.slug;
    try {
        let cat = await Category.findOne({slug: categorySlug});
        let tree = await cat.getArrayTree();
        res.status(200).json(tree);

    } catch(err) {
        return res.status(500).json({
            title: 'Error al obtener la categoría "' + categorySlug + '"',
            error: err
        });
    }
};

exports.listCategories = function (req, res, next) {
    Category.GetFullArrayTree(function (err, categories) {
        if (err) {
            return res.status(500).json({
                title: 'Error al obtener categorías',
                error: err
            });
        }
        if(!Array.isArray(categories)) {
            categories = [];
        }
        res.status(200).json(categories)
    });
};

exports.updateCategory = async (req, res, next) => {
    console.log(req.files);
    try {
        var category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(500).json({
                title: 'No se encontró la Categoría!',
                error: {message: 'Categoría no encontrada'}
            });
        } else {

            category.name = req.body.name;
            category.description = req.body.description;
            category.color = req.body.color;
            category.selectable = req.body.selectable;
            category.hasPrice = req.body.hasPrice;
            category.parentId = req.body.parentId;
            category.metaKeywords = req.body.metaKeywords;

            if (req.files && req.files.icon) {
                console.log('Hay icono nuevo');
                try {
                    if (category.icon && category.icon !== 'undefined') {
                        const deletedImage = await s3Delete(category.icon.path);
                        console.log('imagen borrada: ' + deletedImage);
                    }
                    const image = req.files.icon;
                    const uploadedImage = await s3Upload(image);
                    console.log(uploadedImage);
                    var icon = {
                        originalFilename: image.originalFilename,
                        mimeType: image.type,
                        size: image.size,
                        filename: image.name,
                        path: uploadedImage.Location,
                        pathCdn: pathCdn + '/' + uploadedImage.key,
                    };
                    category.icon = icon;
                    fs.unlinkSync(image.path);
                    console.log(image);
                } catch (err) {
                    console.error(err);
                    return res.status(500).json({
                        title: 'Ocurrió un error actualizando el icono',
                        error: err
                    });
                }
            }
            try {
                if (category.icon && category.icon !== 'undefined' && req.body.iconChanged === 'true') {
                    const deletedImage = await s3Delete(category.icon.path);
                    category.icon = null;
                    console.log('imagen borrada: ' + deletedImage);

                }
                const categoryUpdated = await category.save();
                res.status(200).json(categoryUpdated);
            } catch (err) {
                console.error(err);
                return res.status(500).json({
                    title: 'Ocurrió un error actualizando la categoria',
                    error: err
                });
            }
        }
    } catch(err) {
        console.log(err)
        return res.status(500).json({
            title: 'Ocurrió un error recuperando la categoria',
            error: err
        });
    }
};

exports.deleteCategory = function (req, res, next) {
    Category.findById(req.params.id, function (err, category) {
        if (err) {
            return res.status(500).json({
                title: 'Ocurrió un error recuperando la categoría',
                error: err
            });
        }
        if (!category) {
            return res.status(500).json({
                title: 'Categoría no encontrada',
                error: {
                    message: 'No se ha encontrado la categoría'
                }
            });
        }
        var icon_path = category.icon ? category.icon.path : null;
        category.remove(function (err, result) {
            if (err) {
                return res.status(500).json({
                    title: 'Ocurrió un error eliminando la categoría',
                    error: err
                });
            }
            if (icon_path) {
                fs.unlinkSync(icon_path);
            }

            res.status(200).json(category);

        });
    });
};

   
