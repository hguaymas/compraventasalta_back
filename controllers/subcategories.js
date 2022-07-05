var Subcategory = require('../models/subcategory');

exports.createSubcategory = function(req, res, next) {

    var subcategory = new Subcategory({
        name: req.body.name
    });
    
    subcategory.save(function(err, result) {
        if (err) {
            return res.status(500).json({
                title: 'Ocurrió un error guardando la subcategoría',
                error: err
            });
        }
        res.status(201).json({
            subcategory: 'Se ha creado la subcategoría exitosamente',
            obj: result
        });
    });


};



exports.listSubcategories = function(req, res, next) {
    var category_slug = req.query.category_slug;
    var query = {};
    if(category_slug) {
        query.category = category_slug;
    };
    Subcategory.find(query)
    .populate('category', 'name')
        .exec(function(err, subcategories) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener subcategorías',
                    error: err
                });
            }
            res.status(200).json({
                title: 'Success!',
                obj: subcategories
            })
        });
};

exports.updateSubcategory = function(req, res, next) {
    Subcategory.findByIdAndUpdate(req.params.id, function(err, subcategory) {
        if (err) {
            return res.status(500).json({
                title: 'An error ocurred',
                error: err
            });
        }
        if (!subcategory) {
            return res.status(500).json({
                title: 'No se encontró la Subcategoría!',
                error: {message: 'Subcategoría no encontrada'}
            });
        } else {
            res.status(200).json({
                subcategory: 'Subcategoría actualizada',
                obj: subcategory
            });
        }
    });
};

exports.deleteSubcategory = function(req, res, next) {

};

   
